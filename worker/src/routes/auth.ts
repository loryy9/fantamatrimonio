/**
 * Rotte di autenticazione. Ogni utente (sposi e invitati) ha un account.
 * GET  /api/auth/providers             -> provider social abilitati (client id pubblici)
 * POST /api/auth/send-verification-code / verify-code -> OTP email
 * POST /api/auth/register              -> registrazione (nome, cognome, email, password, nickname facoltativo)
 * POST /api/auth/login-secure          -> login email + password -> JWT
 * POST /api/auth/social                -> login/registrazione con Google o Facebook -> JWT
 * POST /api/auth/join                  -> l'account entra in un matrimonio con il codice invito
 * POST /api/auth/refresh               -> refresh del token di sessione
 * GET  /api/auth/me                    -> dati utente + evento correnti
 */
import { Hono } from "hono";
import { z } from "zod";
import { bearerToken, createJwt, decodeJwt, hashPassword, isJwt, requireAccount, verifyPassword } from "../auth";
import type { Db, Row } from "../db";
import type { AppEnv } from "../env";
import { ApiError } from "../errors";
import { accountOut, eventOut, userOut } from "../serializers";
import { parseJson } from "../util";
import { verifySocialToken } from "../social";
import { createAndSendCode, normalizeEmail, verifyCode } from "../verification";
import type { Config } from "../config";

const router = new Hono<AppEnv>();

const str = z.string().nullish();

const JoinRequest = z.object({
  invite_code: z.string(),
  nickname: str,
});

const RefreshRequest = z.object({
  refresh_token: z.string(),
});

const SendVerificationCodeRequest = z.object({
  email: z.string(),
  purpose: z.string().default("registration"),
  confirm_existing: z.boolean().default(false),
});
const VerifyCodeRequest = z.object({ email: z.string(), code: z.string(), purpose: z.string().default("registration") });
const RegisterRequest = z.object({
  email: z.string(),
  password: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  nickname: str,
  verification_code: str,
});
const LoginSecureRequest = z.object({ email: z.string(), password: z.string() });
const SocialRequest = z.object({
  provider: z.enum(["google", "facebook"]),
  token: z.string().min(1),
});

/** Crea una nuova sessione con access_token e refresh_token. */
async function createSession(db: Db, cfg: Config, userId: string, accountId?: string | null): Promise<{ token: string; refresh_token: string; expires_in: number }> {
  const token = crypto.randomUUID();
  const refreshToken = crypto.randomUUID();
  const ttlMinutes = cfg.accessTokenTtlMinutes;
  const refreshDays = cfg.refreshTokenTtlDays;

  await db.execute(
    `INSERT INTO sessions (token, user_id, account_id, refresh_token, expires_at, refresh_expires_at)
     VALUES ($1, $2, $3, $4, NOW() + ($5 || ' minutes')::INTERVAL, NOW() + ($6 || ' days')::INTERVAL)`,
    [token, userId, accountId || null, refreshToken, String(ttlMinutes), String(refreshDays)],
  );

  return { token, refresh_token: refreshToken, expires_in: ttlMinutes * 60 };
}

/** Sessione attiva dell'utente (la piu' lunga) oppure una nuova. */
async function getOrCreateSession(db: Db, cfg: Config, userId: string, accountId?: string | null): Promise<{ token: string; refresh_token: string; expires_in: number }> {
  const sess = await db.queryOne(
    "SELECT token, refresh_token FROM sessions WHERE user_id = $1 AND expires_at > NOW() ORDER BY expires_at DESC LIMIT 1",
    [userId],
  );
  if (sess?.token && sess?.refresh_token) {
    return { token: sess.token, refresh_token: sess.refresh_token, expires_in: cfg.accessTokenTtlMinutes * 60 };
  }
  return createSession(db, cfg, userId, accountId);
}

// ── ENTRA IN UN MATRIMONIO (account autenticato + codice invito) ────────────

/** Nickname di partenza per un nuovo profilo evento. */
const defaultNickname = (a: Row): string =>
  String(a.nickname || a.first_name || a.display_name || "Ospite").trim();

router.post("/join", requireAccount, async (c) => {
  const db = c.get("db");
  const cfg = c.get("cfg");
  const account = c.get("account");
  const { data: body } = await parseJson(c, JoinRequest);

  const code = body.invite_code.trim().toUpperCase();
  if (!code) throw new ApiError(422, "Inserisci il codice del matrimonio.");

  const event = await db.queryOne("SELECT * FROM events WHERE invite_code = $1", [code]);
  if (!event) throw new ApiError(404, "Codice matrimonio non trovato. Controlla il codice inserito.");

  const requested = (body.nickname ?? "").trim();
  const isTaken = async (nick: string, exceptUserId?: string) =>
    !!(await db.queryOne(
      "SELECT id FROM users WHERE event_id = $1 AND LOWER(nickname) = $2 AND ($3::uuid IS NULL OR id <> $3::uuid)",
      [event.id, nick.toLowerCase(), exceptUserId ?? null],
    ));

  let user = await db.queryOne("SELECT * FROM users WHERE event_id = $1 AND account_id = $2", [event.id, account.id]);
  let isNew = false;

  if (!user) {
    let nick = requested || defaultNickname(account);
    if (await isTaken(nick)) {
      if (requested) {
        throw new ApiError(409, {
          code: "NICKNAME_TAKEN",
          message: `Il nickname "${nick}" è già in uso per questo matrimonio. Scegline un altro.`,
          nickname: nick,
        });
      }
      // Nickname derivato dal profilo: aggiungiamo un numero finché è libero.
      const base = nick;
      let n = 2;
      while (n < 50 && (await isTaken(`${base} ${n}`))) n++;
      nick = `${base} ${n}`;
    }
    isNew = true;
    user = await db.execute(
      `INSERT INTO users (event_id, role, nickname, pin, account_id)
       VALUES ($1, 'guest', $2, NULL, $3) RETURNING *`,
      [event.id, nick, account.id],
    );
  } else if (requested && user.role !== "couple" && requested !== user.nickname) {
    if (await isTaken(requested, String(user.id))) {
      throw new ApiError(409, {
        code: "NICKNAME_TAKEN",
        message: `Il nickname "${requested}" è già in uso per questo matrimonio. Scegline un altro.`,
        nickname: requested,
      });
    }
    user = await db.execute("UPDATE users SET nickname = $1 WHERE id = $2 RETURNING *", [requested, user.id]);
  }

  const u = user!;
  const session = await createSession(db, cfg, u.id, account.id);
  return c.json({
    token: session.token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    is_new: isNew,
    user: userOut(u),
    event: eventOut(event),
    jwt: await createJwt(cfg, String(account.id)),
    account: accountOut(account),
  });
});

// ── REFRESH TOKEN ──────────────────────────────────────────────────────────

router.post("/refresh", async (c) => {
  const db = c.get("db");
  const cfg = c.get("cfg");
  const { data: body } = await parseJson(c, RefreshRequest);

  const refreshToken = body.refresh_token.trim();
  if (!refreshToken) throw new ApiError(422, "Refresh token mancante.");

  // Trova la sessione con questo refresh token (non scaduto)
  const sess = await db.queryOne(
    `SELECT s.*, u.id AS uid, u.event_id, u.role, u.account_id
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.refresh_token = $1 AND s.refresh_expires_at > NOW()`,
    [refreshToken],
  );
  if (!sess) throw new ApiError(401, "Refresh token non valido o scaduto. Effettua nuovamente l'accesso.");

  // Invalida la vecchia sessione
  await db.execute("DELETE FROM sessions WHERE refresh_token = $1", [refreshToken]);

  // Crea una nuova sessione
  const newSession = await createSession(db, cfg, sess.uid, sess.account_id);

  const result: Row = {
    token: newSession.token,
    refresh_token: newSession.refresh_token,
    expires_in: newSession.expires_in,
  };

  // Se ha un account, rinnova anche il JWT
  if (sess.account_id) {
    result.jwt = await createJwt(cfg, String(sess.account_id));
  }

  return c.json(result);
});

// ── OTP EMAIL ───────────────────────────────────────────────────────────────

/** Invia il codice di verifica a 6 cifre prima di completare la registrazione. */
router.post("/send-verification-code", async (c) => {
  const db = c.get("db");
  const { data: body } = await parseJson(c, SendVerificationCodeRequest);
  const email = normalizeEmail(body.email);
  if (body.purpose === "register_couple" || body.purpose === "register_account") {
    const existing = await db.queryOne("SELECT id, password_hash FROM accounts WHERE email = $1", [email]);
    if (existing && body.purpose === "register_account") {
      throw new ApiError(
        409,
        existing.password_hash
          ? "Esiste già un account con questa email. Prova ad accedere."
          : "Questa email è già registrata con Google o Facebook. Accedi con il pulsante corrispondente.",
      );
    }
  }
  return c.json(await createAndSendCode(db, c.get("cfg"), email, body.purpose));
});

/** Verifica la correttezza del codice senza consumarlo. */
router.post("/verify-code", async (c) => {
  const { data: body } = await parseJson(c, VerifyCodeRequest);
  if (!(await verifyCode(c.get("db"), body.email, body.code, body.purpose, false))) {
    throw new ApiError(400, "Codice di verifica non valido o scaduto.");
  }
  return c.json({ valid: true, message: "Codice verificato con successo." });
});

// ── ACCOUNT ─────────────────────────────────────────────────────────────────

/** Provider social abilitati: id pubblici necessari al frontend per mostrare i pulsanti. */
router.get("/providers", (c) => {
  const cfg = c.get("cfg");
  return c.json({
    google_client_id: cfg.googleClientId || null,
    facebook_app_id: cfg.facebookAppId && cfg.facebookAppSecret ? cfg.facebookAppId : null,
  });
});

/** Eventi a cui l'account partecipa (usato dopo il login). */
async function accountEvents(db: Db, accountId: string): Promise<Row[]> {
  return db.query(
    `SELECT DISTINCT e.* FROM events e
     JOIN users u ON u.event_id = e.id
     WHERE u.account_id = $1
     ORDER BY e.created_at DESC`,
    [accountId],
  );
}

/** Registrazione: nome, cognome, email (verificata via codice a 6 cifre), password, nickname facoltativo. */
router.post("/register", async (c) => {
  const db = c.get("db");
  const cfg = c.get("cfg");
  const { data: body } = await parseJson(c, RegisterRequest);

  const email = normalizeEmail(body.email);
  const first = body.first_name.trim();
  const last = body.last_name.trim();
  const nickname = (body.nickname ?? "").trim();
  if (!first || !last) throw new ApiError(422, "Nome e cognome sono obbligatori.");
  if (!email || !email.includes("@")) throw new ApiError(422, "Inserisci un indirizzo email valido.");
  if (!body.password || body.password.length < 6) {
    throw new ApiError(422, "La password deve contenere almeno 6 caratteri.");
  }

  if (!body.verification_code) {
    throw new ApiError(400, "Il codice di verifica inviato via email è obbligatorio.");
  }
  if (!(await verifyCode(db, email, body.verification_code, "register_account", true))) {
    throw new ApiError(400, "Codice di verifica non valido o scaduto.");
  }

  if (await db.queryOne("SELECT id FROM accounts WHERE email = $1", [email])) {
    throw new ApiError(409, "Esiste già un account con questa email.");
  }

  const account = await db.execute(
    `INSERT INTO accounts (email, password_hash, display_name, first_name, last_name, nickname, is_verified, registered_at)
     VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW()) RETURNING *`,
    [email, await hashPassword(body.password), `${first} ${last}`, first, last, nickname || null],
  );

  return c.json({ jwt: await createJwt(cfg, String(account!.id)), account: accountOut(account!), events: [] });
});

/** Login con email + password. Ritorna JWT + account + lista eventi. */
router.post("/login-secure", async (c) => {
  const db = c.get("db");
  const cfg = c.get("cfg");
  const { data: body } = await parseJson(c, LoginSecureRequest);

  const email = normalizeEmail(body.email);
  if (!email || !body.password) throw new ApiError(422, "Email e password sono obbligatorie.");

  const account = await db.queryOne("SELECT * FROM accounts WHERE email = $1", [email]);
  if (account && !account.password_hash) {
    throw new ApiError(401, "Questo account è stato creato con Google o Facebook. Usa il pulsante corrispondente per accedere.");
  }
  if (!account || !(await verifyPassword(body.password, account.password_hash))) {
    throw new ApiError(401, "Email o password non corretti.");
  }

  return c.json({
    jwt: await createJwt(cfg, String(account.id)),
    account: accountOut(account),
    events: (await accountEvents(db, account.id)).map(eventOut),
  });
});

/**
 * Login/registrazione con Google o Facebook.
 * 1. identita' gia' collegata -> accesso
 * 2. email verificata dal provider uguale a un account esistente -> collega e accedi
 * 3. altrimenti crea un nuovo account (senza password).
 */
router.post("/social", async (c) => {
  const db = c.get("db");
  const cfg = c.get("cfg");
  const { data: body } = await parseJson(c, SocialRequest);
  const profile = await verifySocialToken(cfg, body.provider, body.token);

  let account: Row | null = null;
  const identity = await db.queryOne(
    "SELECT account_id FROM account_identities WHERE provider = $1 AND provider_user_id = $2",
    [profile.provider, profile.providerUserId],
  );
  if (identity) account = await db.queryOne("SELECT * FROM accounts WHERE id = $1", [identity.account_id]);

  if (!account) {
    if (!profile.email || !profile.emailVerified) {
      throw new ApiError(
        422,
        `${body.provider === "google" ? "Google" : "Facebook"} non ha fornito un'email verificata. Registrati con email e password.`,
      );
    }
    account = await db.queryOne("SELECT * FROM accounts WHERE email = $1", [profile.email]);
    if (account) {
      // L'email e' verificata dal provider: colleghiamo l'identita' e segniamo l'account come verificato.
      account = await db.queryOne("UPDATE accounts SET is_verified = TRUE WHERE id = $1 RETURNING *", [account.id]);
    } else {
      const first = profile.firstName || profile.email.split("@")[0];
      account = await db.execute(
        `INSERT INTO accounts (email, password_hash, display_name, first_name, last_name, is_verified, registered_at)
         VALUES ($1, NULL, $2, $3, $4, TRUE, NOW()) RETURNING *`,
        [profile.email, `${first} ${profile.lastName}`.trim(), first, profile.lastName || null],
      );
    }
    await db.execute(
      `INSERT INTO account_identities (account_id, provider, provider_user_id) VALUES ($1, $2, $3)
       ON CONFLICT (provider, provider_user_id) DO NOTHING`,
      [account!.id, profile.provider, profile.providerUserId],
    );
  }

  return c.json({
    jwt: await createJwt(cfg, String(account!.id)),
    account: accountOut(account!),
    events: (await accountEvents(db, account!.id)).map(eventOut),
  });
});

// ── ME ──────────────────────────────────────────────────────────────────────

/** Dati aggiornati di utente, evento e account correnti. */
router.get("/me", async (c) => {
  const db = c.get("db");
  const cfg = c.get("cfg");
  const token = bearerToken(c.req.header("authorization"));
  const eventId = c.req.query("event_id");

  if (isJwt(token)) {
    // JWT: account permanente
    const payload = await decodeJwt(cfg, token);
    if (!payload || payload.type !== "account") throw new ApiError(401, "Token JWT non valido o scaduto.");

    const accountId = String(payload.sub);
    const account = await db.queryOne("SELECT * FROM accounts WHERE id = $1", [accountId]);
    if (!account) throw new ApiError(404, "Account non trovato.");

    const user = eventId
      ? await db.queryOne("SELECT * FROM users WHERE account_id = $1 AND event_id = $2", [accountId, eventId])
      : await db.queryOne("SELECT * FROM users WHERE account_id = $1 ORDER BY created_at DESC LIMIT 1", [accountId]);

    let event: Row | null = null;
    let sessionToken: string | null = null;
    let refreshToken: string | null = null;
    if (user) {
      event = await db.queryOne("SELECT * FROM events WHERE id = $1", [user.event_id]);
      const sess = await getOrCreateSession(db, cfg, user.id, accountId);
      sessionToken = sess.token;
      refreshToken = sess.refresh_token;
    }

    return c.json({
      account: accountOut(account),
      user: user ? userOut(user) : null,
      event: event ? eventOut(event) : null,
      token: sessionToken,
      refresh_token: refreshToken,
    });
  }

  // Session token UUID (ospite temporaneo)
  const row = await db.queryOne(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token],
  );
  if (!row) throw new ApiError(401, "Sessione scaduta o non trovata.");

  const event = await db.queryOne("SELECT * FROM events WHERE id = $1", [row.event_id]);
  const account = row.account_id ? await db.queryOne("SELECT * FROM accounts WHERE id = $1", [row.account_id]) : null;

  // Cerca anche il refresh_token della sessione corrente
  const sessionData = await db.queryOne(
    "SELECT refresh_token FROM sessions WHERE token = $1",
    [token],
  );

  return c.json({
    user: userOut(row),
    event: event ? eventOut(event) : null,
    account: account ? accountOut(account) : null,
    refresh_token: sessionData?.refresh_token || null,
  });
});

export default router;
