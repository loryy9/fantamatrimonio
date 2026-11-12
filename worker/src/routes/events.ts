/**
 * Rotte per la creazione e gestione degli eventi (matrimoni).
 * POST   /api/events                  -> crea un matrimonio (richiede un account autenticato)
 * GET    /api/events/preview/:code    -> anteprima pubblica dal codice invito
 * GET    /api/events/me               -> configurazione dell'evento corrente
 * PATCH  /api/events/me               -> aggiorna la configurazione (solo sposi)
 * GET    /api/events/me/invite        -> codice invito
 * GET    /api/events/me/stats         -> statistiche (solo sposi)
 * DELETE /api/events/me               -> elimina il matrimonio (solo sposi)
 */
import { Hono } from "hono";
import { z } from "zod";
import { decodeJwt, isJwt, requireCouple, requireUser } from "../auth";
import type { Row } from "../db";
import type { Env, AppEnv } from "../env";
import { ApiError } from "../errors";
import { generateInviteCode } from "../invite";
import { accountOut, eventOut, userOut } from "../serializers";
import { dateTime, parseJson, setFields } from "../util";

const router = new Hono<AppEnv>();

// ── Rate limit: max 5 creazioni evento per IP ogni ora ──────────────────────
// Con il binding RATE_LIMIT_KV e' condiviso tra tutte le istanze (consistenza eventuale);
// senza, e' best-effort in memoria e vale solo per l'isolate corrente.

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_S = 3600;
const memoryLog = new Map<string, number[]>();

async function checkRateLimit(env: Env, ip: string): Promise<void> {
  const now = Date.now() / 1000;
  const key = `events:create:${ip}`;

  let recent: number[];
  if (env.RATE_LIMIT_KV) {
    const stored = await env.RATE_LIMIT_KV.get<number[]>(key, "json");
    recent = (stored ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_S);
  } else {
    recent = (memoryLog.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_S);
  }

  if (recent.length >= RATE_LIMIT_MAX) {
    throw new ApiError(429, "Troppi matrimoni creati da questo indirizzo. Riprova più tardi.");
  }
  recent.push(now);

  if (env.RATE_LIMIT_KV) {
    await env.RATE_LIMIT_KV.put(key, JSON.stringify(recent), { expirationTtl: RATE_LIMIT_WINDOW_S });
  } else {
    memoryLog.set(key, recent);
  }
}

const str = z.string().nullish();

const CreateEventRequest = z.object({
  spouse1_name: z.string(),
  spouse2_name: z.string(),
  enable_timer: z.boolean().default(false),
  start_time: dateTime.nullish(),
  end_time: dateTime.nullish(),
});

router.post("/", async (c) => {
  const db = c.get("db");
  const cfg = c.get("cfg");
  await checkRateLimit(c.env, c.req.header("cf-connecting-ip") ?? "unknown");

  const { data: body } = await parseJson(c, CreateEventRequest);

  if (body.enable_timer && body.start_time && body.end_time && body.end_time <= body.start_time) {
    throw new ApiError(422, "L'orario di fine deve essere successivo a quello di inizio.");
  }
  if (body.enable_timer && body.start_time && body.start_time <= new Date()) {
    throw new ApiError(422, "L'inizio dei giochi deve essere nel futuro.");
  }

  if (!body.spouse1_name.trim() || !body.spouse2_name.trim()) {
    throw new ApiError(422, "I nomi degli sposi sono obbligatori.");
  }

  // Serve un account: chi crea il matrimonio deve aver gia' effettuato il login.
  const authorization = c.req.header("authorization");
  const tokenStr = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
  const payload = tokenStr && isJwt(tokenStr) ? await decodeJwt(cfg, tokenStr) : null;
  const existing =
    payload && payload.type === "account"
      ? await db.queryOne("SELECT * FROM accounts WHERE id = $1", [String(payload.sub)])
      : null;
  if (!existing) throw new ApiError(401, "Accedi o registrati per creare un matrimonio.");

  const accountId = existing.id as string;
  const jwtToken = tokenStr;
  const accountData: Row = accountOut(existing);
  const coupleName = String(existing.display_name || "").trim() || `${body.spouse1_name.trim()} & ${body.spouse2_name.trim()}`;

  let created: { event: Row; user: Row; token: string; refreshToken: string } | null = null;
  for (let attempt = 0; attempt < 5 && !created; attempt++) {
    const code = generateInviteCode();
    try {
      created = await db.transaction(async (tx) => {
        const event = (await tx.execute(
          `INSERT INTO events (spouse1_name, spouse2_name, enable_timer, start_time, end_time, invite_code)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [body.spouse1_name.trim(), body.spouse2_name.trim(), body.enable_timer, body.start_time ?? null, body.end_time ?? null, code],
        ))!;
        const user = (await tx.execute(
          `INSERT INTO users (event_id, role, nickname, pin, account_id)
           VALUES ($1, 'couple', $2, NULL, $3) RETURNING *`,
          [event.id, coupleName, accountId],
        ))!;
        const token = crypto.randomUUID();
        const refreshToken = crypto.randomUUID();
        await tx.execute(
          `INSERT INTO sessions (token, user_id, account_id, refresh_token, expires_at, refresh_expires_at)
           VALUES ($1, $2, $3, $4, NOW() + ($5 || ' minutes')::INTERVAL, NOW() + ($6 || ' days')::INTERVAL)`,
          [token, user.id, accountId, refreshToken, String(cfg.accessTokenTtlMinutes), String(cfg.refreshTokenTtlDays)],
        );
        return { event, user, token, refreshToken };
      });
    } catch (e) {
      // Collisione sul codice invito univoco: riprova con un nuovo codice
      const err = e as { message?: string; constraint_name?: string };
      if (`${err.message} ${err.constraint_name}`.toLowerCase().includes("invite_code")) continue;
      throw e;
    }
  }
  if (!created) throw new ApiError(500, "Impossibile generare un codice invito univoco. Riprova.");

  const result: Row = {
    token: created.token,
    refresh_token: created.refreshToken,
    expires_in: cfg.accessTokenTtlMinutes * 60,
    invite_code: created.event.invite_code,
    user: userOut(created.user),
    event: eventOut(created.event),
  };
  if (jwtToken) result.jwt = jwtToken;
  if (accountData) result.account = accountData;
  return c.json(result);
});

router.get("/preview/:invite_code", async (c) => {
  const code = c.req.param("invite_code").trim().toUpperCase();
  const event = await c
    .get("db")
    .queryOne("SELECT spouse1_name, spouse2_name, invite_code FROM events WHERE invite_code = $1", [code]);
  if (!event) throw new ApiError(404, "Matrimonio non trovato con questo codice.");
  return c.json({ spouse1_name: event.spouse1_name, spouse2_name: event.spouse2_name, invite_code: event.invite_code });
});

router.get("/me", requireUser, async (c) => {
  const event = await c.get("db").queryOne("SELECT * FROM events WHERE id = $1", [c.get("user").event_id]);
  if (!event) throw new ApiError(404, "Evento non trovato.");
  return c.json(eventOut(event));
});

const UpdateEventRequest = z.object({
  spouse1_name: z.string().nullish(),
  spouse2_name: z.string().nullish(),
  enable_timer: z.boolean().nullish(),
  start_time: dateTime.nullish(),
  end_time: dateTime.nullish(),
});

router.patch("/me", requireCouple, async (c) => {
  const db = c.get("db");
  const eventId = c.get("user").event_id;
  const { data, raw } = await parseJson(c, UpdateEventRequest);

  const event = await db.queryOne("SELECT * FROM events WHERE id = $1", [eventId]);
  if (!event) throw new ApiError(404, "Evento non trovato.");

  const updates = setFields(data, raw, ["spouse1_name", "spouse2_name", "enable_timer", "start_time", "end_time"]);
  if (Object.keys(updates).length === 0) return c.json(eventOut(event));

  for (const field of ["spouse1_name", "spouse2_name", "enable_timer"]) {
    if (field in updates && updates[field] == null) {
      throw new ApiError(422, `Il campo '${field}' non può essere nullo.`);
    }
  }

  const mergedTimer = "enable_timer" in updates ? updates.enable_timer : event.enable_timer;
  const mergedStart = ("start_time" in updates ? updates.start_time : event.start_time) as Date | null;
  const mergedEnd = ("end_time" in updates ? updates.end_time : event.end_time) as Date | null;
  if (mergedTimer && mergedStart && mergedEnd && mergedEnd.getTime() <= mergedStart.getTime()) {
    throw new ApiError(422, "L'orario di fine deve essere successivo a quello di inizio.");
  }

  // I nomi colonna provengono dalla allowlist sopra: mai da input utente.
  const params: (string | boolean | Date | null)[] = [];
  const sets = Object.entries(updates).map(([col, val]) => {
    params.push(val as string | boolean | Date | null);
    return `${col} = $${params.length}`;
  });
  params.push(eventId);

  const updated = await db.execute(`UPDATE events SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING *`, params);
  return c.json(eventOut(updated!));
});

router.get("/me/invite", requireUser, async (c) => {
  const event = await c.get("db").queryOne("SELECT invite_code FROM events WHERE id = $1", [c.get("user").event_id]);
  if (!event) throw new ApiError(404, "Evento non trovato.");
  return c.json({ invite_code: event.invite_code });
});

/** Statistiche per gli sposi: invitati, foto, quiz e momenti completati. */
router.get("/me/stats", requireCouple, async (c) => {
  const db = c.get("db");
  const eventId = c.get("user").event_id;

  const count = async (sql: string) => (await db.queryOne(sql, [eventId]))?.count ?? 0;

  const submissionsOfType = (cond: string) =>
    `SELECT COUNT(s.*) AS count FROM user_submissions s JOIN challenges c ON c.id = s.challenge_id WHERE c.event_id = $1 AND ${cond}`;

  return c.json({
    guests_count: await count("SELECT COUNT(*) AS count FROM users WHERE event_id = $1 AND role = 'guest'"),
    photos_count: await count(submissionsOfType("c.type IN ('photo', 'hunt') AND s.image_url IS NOT NULL")),
    quiz_count: await count(submissionsOfType("c.type = 'quiz'")),
    moments_count: await count(submissionsOfType("c.type = 'vote'")),
  });
});

/** Elimina definitivamente il matrimonio e, per CASCADE, tutti i record associati. */
router.delete("/me", requireCouple, async (c) => {
  const db = c.get("db");
  const eventId = c.get("user").event_id;

  const event = await db.queryOne("SELECT id, spouse1_name, spouse2_name, invite_code FROM events WHERE id = $1", [
    eventId,
  ]);
  if (!event) throw new ApiError(404, "Matrimonio non trovato.");

  await db.execute("DELETE FROM events WHERE id = $1", [eventId]);
  return c.json({
    success: true,
    message: `Matrimonio di ${event.spouse1_name} & ${event.spouse2_name} eliminato definitivamente dal database.`,
  });
});

export default router;
