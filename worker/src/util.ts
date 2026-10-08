import type { Context } from "hono";
import { z } from "zod";
import { ApiError } from "./errors";

/** Lowercase + trim per uniformare le stringhe di identita'. */
export const normalize = (s: string): string => s.trim().toLowerCase();

/** Come str.capitalize() di Python: prima lettera maiuscola, resto minuscolo. */
export const capitalize = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);

/** Intero casuale uniforme in [0, max) (rejection sampling, niente modulo bias). */
export function randomInt(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return buf[0] % max;
}

export function hmacHex(secret: string, message: string): Promise<string> {
  return crypto.subtle
    .importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    .then((key) => crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)))
    .then((sig) => [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join(""));
}

/** Confronto a tempo costante di due stringhe. */
export function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  const n = Math.max(ea.length, eb.length);
  for (let i = 0; i < n; i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

// ── Validazione (errore 422 con `detail` strutturato: loc/msg/type) ─────────────

/** Datetime ISO-8601 -> Date (accetta anche senza fuso, come Pydantic). */
export const dateTime = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: "Data/ora non valida" })
  .transform((s) => new Date(s));

function validationError(issues: z.core.$ZodIssue[], where: "body" | "query" | "path"): ApiError {
  return new ApiError(
    422,
    issues.map((i) => ({
      type: i.code,
      loc: [where, ...i.path],
      msg: `Campo non valido o mancante: ${i.path.join(".") || where}`,
    })),
  );
}

/**
 * Legge e valida il body JSON. Ritorna anche il JSON grezzo, necessario per replicare
 * `model_dump(exclude_unset=True)` (distinguere "campo assente" da "campo null").
 */
export async function parseJson<S extends z.ZodType>(
  c: Context,
  schema: S,
): Promise<{ data: z.infer<S>; raw: Record<string, unknown> }> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new ApiError(422, [{ type: "json_invalid", loc: ["body"], msg: "JSON non valido" }]);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw validationError(parsed.error.issues, "body");
  return { data: parsed.data, raw: (raw ?? {}) as Record<string, unknown> };
}

/** Solo i campi effettivamente inviati dal client (equivale a exclude_unset=True). */
export function setFields<T extends Record<string, unknown>>(
  data: T,
  raw: Record<string, unknown>,
  allowed: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of allowed) if (k in raw && k in data) out[k] = data[k];
  return out;
}

/** Parametro di path intero (422 se non valido). */
export function intParam(c: Context, name: string): number {
  const v = c.req.param(name);
  if (!/^-?\d+$/.test(v ?? "")) {
    throw new ApiError(422, [
      { type: "int_parsing", loc: ["path", name], msg: "Input should be a valid integer, unable to parse string as an integer" },
    ]);
  }
  return Number(v);
}

/** Query param booleano (true/false, 1/0, yes/no, on/off). */
export function queryBool(c: Context, name: string, dflt: boolean): boolean {
  const v = c.req.query(name);
  if (v === undefined) return dflt;
  const s = v.toLowerCase();
  if (["true", "1", "yes", "on", "t", "y"].includes(s)) return true;
  if (["false", "0", "no", "off", "f", "n"].includes(s)) return false;
  throw new ApiError(422, [
    { type: "bool_parsing", loc: ["query", name], msg: "Input should be a valid boolean, unable to interpret input" },
  ]);
}

/** Date -> ISO-8601 (null passa invariato). */
export function iso(d: Date | string | null | undefined): string | null {
  if (d === null || d === undefined) return null;
  return (d instanceof Date ? d : new Date(d)).toISOString();
}
