/**
 * Rotte per la creazione e gestione degli eventi (matrimoni).
 * POST   /api/events                  -> crea un matrimonio + account sposi
 * GET    /api/events/preview/:code    -> anteprima pubblica dal codice invito
 * GET    /api/events/me               -> configurazione dell'evento corrente
 * PATCH  /api/events/me               -> aggiorna la configurazione (solo sposi)
 * GET    /api/events/me/invite        -> codice invito
 * GET    /api/events/me/stats         -> statistiche (solo sposi)
 * DELETE /api/events/me               -> elimina il matrimonio (solo sposi)
 */
import { Hono } from "hono";
import { z } from "zod";
import { createJwt, decodeJwt, hashPassword, isJwt, requireCouple, requireUser, verifyPassword } from "../auth";
import type { Row } from "../db";
import type { Env, AppEnv } from "../env";
import { ApiError } from "../errors";
import { generateInviteCode } from "../invite";
import { accountOut, eventOut, userOut } from "../serializers";
import { dateTime, normalize, parseJson, setFields } from "../util";
import { verifyCode } from "../verification";

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
  couple_first_name: z.string(),
  couple_last_name: z.string(),
  couple_secret_word: str, // facoltativo per retrocompatibilita' test
  couple_email: str,
  couple_password: str,
  verification_code: str, // OTP 6 cifre inviato via email
});

router.post("/", async (c) => {
  const db = c.get("db");
  const cfg = c.get("cfg");
  await checkRateLimit(c.env, c.req.header("cf-connecting-ip") ?? "unknown");

  const { data: body } = await parseJson(c, CreateEventRequest);

  if (body.enable_timer && body.start_time && body.end_time && body.end_time <= body.start_time) {
    throw new ApiError(422, "L'orario di fine deve essere successivo a quello di inizio.");
  }

  const first = normalize(body.couple_first_name);
  const last = normalize(body.couple_last_name);
  if (!body.spouse1_name.trim() || !body.spouse2_name.trim() || !first || !last) {
    throw new ApiError(422, "I nomi degli sposi e il referente sono obbligatori.");
  }

  let accountId: string | null = null;
  let jwtToken: string | null = null;
  let accountData: Row | null = null;
  let coupleEmail = body.couple_email ? body.couple_email.trim().toLowerCase() : null;
  const couplePassword = body.couple_password || null;

  // 1. Utente gia' loggato con JWT
  const authorization = c.req.header("authorization");
  if (authorization?.startsWith("Bearer ")) {
    const tokenStr = authorization.slice("Bearer ".length).trim();
    if (isJwt(tokenStr)) {
      const payload = await decodeJwt(cfg, tokenStr);
      if (payload && payload.type === "account") {
        const existing = await db.queryOne("SELECT * FROM accounts WHERE id = $1", [String(payload.sub)]);
        if (existing) {
          accountId = existing.id;
          accountData = accountOut(existing);
          jwtToken = tokenStr;
          coupleEmail = existing.email;
        }
      }
    }
  }

  // 2. Se non gia' loggato, email e password sono obbligatorie
  if (!accountId) {
    if (!coupleEmail || !couplePassword) {
      // Fallback retrocompatibilita' (suite di test con couple_secret_word)
      if (!body.couple_secret_word) {
        throw new ApiError(422, "Email e password sono obbligatorie per creare l'account degli sposi.");
      }
    } else {
      if (couplePassword.length < 6) throw new ApiError(422, "La password deve essere di almeno 6 caratteri.");

      const existingAccount = await db.queryOne("SELECT * FROM accounts WHERE email = $1", [coupleEmail]);
      if (existingAccount) {
        if (!existingAccount.password_hash || !(await verifyPassword(couplePassword, existingAccount.password_hash))) {
          throw new ApiError(
            409,
            "Esiste già un account con questa email. Inserisci la password corretta o accedi prima.",
          );
        }
        accountId = existingAccount.id;
        jwtToken = await createJwt(cfg, String(accountId));
        accountData = accountOut(existingAccount);
      } else {
        let isVerified = false;
        if (body.verification_code) {
          if (!(await verifyCode(db, coupleEmail, body.verification_code, "register_couple", true))) {
            throw new ApiError(400, "Codice di verifica non valido o scaduto.");
          }
          isVerified = true;
        } else if (!body.couple_secret_word) {
          throw new ApiError(400, "Il codice di verifica inviato via email è obbligatorio.");
        }

        const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
        const account = await db.execute(
          `INSERT INTO accounts (email, password_hash, display_name, is_verified, registered_at)
           VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
          [coupleEmail, await hashPassword(couplePassword), `${cap(first)} ${cap(last)}`, isVerified],
        );
        accountId = account!.id;
        jwtToken = await createJwt(cfg, String(accountId));
        accountData = accountOut(account!);
      }
    }
  }

  const word = body.couple_secret_word ? normalize(body.couple_secret_word) : "sposi";

  let created: { event: Row; user: Row; token: string } | null = null;
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
          `INSERT INTO users (event_id, role, first_name, last_name, secret_word, account_id, email)
           VALUES ($1, 'couple', $2, $3, $4, $5, $6) RETURNING *`,
          [event.id, first, last, word, accountId, coupleEmail],
        ))!;
        const token = crypto.randomUUID();
        await tx.execute("INSERT INTO sessions (token, user_id, account_id) VALUES ($1, $2, $3)", [
          token,
          user.id,
          accountId,
        ]);
        return { event, user, token };
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
