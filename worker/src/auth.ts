/**
 * Autenticazione delle richieste. Supporta due modalita':
 *  1. Session token (UUID): Bearer <token> -> lookup nella tabella sessions
 *  2. JWT: Bearer <jwt> -> decodifica e verifica del token firmato (HS256)
 * I token gia' emessi restano validi finche' JWT_SECRET non cambia.
 */
import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import type { MiddlewareHandler } from "hono";
import type { Config } from "./config";
import type { AppEnv } from "./env";
import { ApiError } from "./errors";
import type { Db, Row } from "./db";

// ── Password hashing (bcrypt, compatibile con gli hash esistenti $2b$) ──────

export const hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, 10);

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hashed);
  } catch {
    return false;
  }
}

// ── JWT ─────────────────────────────────────────────────────────────────────

function jwtKey(cfg: Config): Uint8Array {
  if (!cfg.jwtSecret) throw new Error("JWT_SECRET non configurato (wrangler secret put JWT_SECRET).");
  return new TextEncoder().encode(cfg.jwtSecret);
}

async function sign(cfg: Config, payload: JWTPayload, ttlSeconds: number): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(now + Math.round(ttlSeconds))
    .sign(jwtKey(cfg));
}

/** Crea un JWT firmato per un account registrato. */
export function createJwt(cfg: Config, accountId: string, extra?: JWTPayload): Promise<string> {
  return sign(cfg, { sub: accountId, type: "account", ...extra }, cfg.jwtExpireHours * 3600);
}

/** Decodifica un JWT. Ritorna il payload o null se non valido/scaduto. */
export async function decodeJwt(cfg: Config, token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, jwtKey(cfg), { algorithms: ["HS256"] });
    return payload;
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("JWT_SECRET")) throw e;
    return null;
  }
}

/** Token firmato per il link di recupero/completamento account inviato via email. */
export function createClaimToken(cfg: Config, userId: string, eventId: string, email: string, days = 30): Promise<string> {
  return sign(
    cfg,
    { sub: String(userId), event_id: String(eventId), email: email.trim().toLowerCase(), type: "claim_guest" },
    days * 86400,
  );
}

/** Euristica: i JWT hanno 3 segmenti separati da punti. */
export const isJwt = (token: string): boolean => token.split(".").length === 3;

function bearer(header: string | undefined): string {
  if (!header || !header.startsWith("Bearer ")) throw new ApiError(401, "Token mancante o non valido.");
  return header.slice("Bearer ".length).trim();
}

export const bearerToken = bearer;

const USER_COLS = "u.id, u.event_id, u.role, u.first_name, u.last_name, u.total_points, u.account_id";

/**
 * Risolve l'utente corrente dalla richiesta.
 * - JWT -> cerca il profilo dell'account per `event_id` (se fornito) oppure il piu' recente
 * - session token -> lookup in sessions
 */
export async function resolveUser(db: Db, cfg: Config, authorization: string | undefined, eventId: string | undefined): Promise<Row> {
  const token = bearer(authorization);

  if (isJwt(token)) {
    const payload = await decodeJwt(cfg, token);
    if (!payload || payload.type !== "account") throw new ApiError(401, "Token JWT non valido o scaduto.");
    const accountId = String(payload.sub);

    const row = eventId
      ? await db.queryOne(`SELECT ${USER_COLS} FROM users u WHERE u.account_id = $1 AND u.event_id = $2`, [accountId, eventId])
      : await db.queryOne(
          `SELECT ${USER_COLS} FROM users u WHERE u.account_id = $1 ORDER BY u.created_at DESC LIMIT 1`,
          [accountId],
        );
    if (!row) throw new ApiError(401, "Nessun profilo evento trovato per questo account.");
    row.account_id = accountId;
    return row;
  }

  const row = await db.queryOne(
    `SELECT ${USER_COLS}
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token],
  );
  if (!row) throw new ApiError(401, "Sessione scaduta o non trovata.");
  return row;
}

/** Richiede un utente autenticato -> c.get("user"). */
export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = await resolveUser(c.get("db"), c.get("cfg"), c.req.header("authorization"), c.req.query("event_id"));
  c.set("user", user);
  await next();
};

/** Richiede un utente con ruolo "couple" (sposi). */
export const requireCouple: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = await resolveUser(c.get("db"), c.get("cfg"), c.req.header("authorization"), c.req.query("event_id"));
  if (user.role !== "couple") throw new ApiError(403, "Solo gli sposi possono eseguire questa azione.");
  c.set("user", user);
  await next();
};

/** Richiede un account registrato (JWT, oppure sessione collegata a un account) -> c.get("account"). */
export const requireAccount: MiddlewareHandler<AppEnv> = async (c, next) => {
  const db = c.get("db");
  const cfg = c.get("cfg");
  const token = bearer(c.req.header("authorization"));

  let accountId: string;
  if (!isJwt(token)) {
    const row = await db.queryOne(
      `SELECT u.account_id FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = $1 AND s.expires_at > NOW() AND u.account_id IS NOT NULL`,
      [token],
    );
    if (!row?.account_id) {
      throw new ApiError(403, "Per accedere alla dashboard devi registrare il tuo account.");
    }
    accountId = String(row.account_id);
  } else {
    const payload = await decodeJwt(cfg, token);
    if (!payload || payload.type !== "account") throw new ApiError(401, "Token JWT non valido o scaduto.");
    accountId = String(payload.sub);
  }

  const account = await db.queryOne("SELECT * FROM accounts WHERE id = $1", [accountId]);
  if (!account) throw new ApiError(404, "Account non trovato.");
  c.set("account", account);
  await next();
};
