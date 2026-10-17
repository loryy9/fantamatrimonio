/**
 * Rotte di autenticazione.
 * POST /api/auth/login                 -> login invitato (nickname + PIN 4 cifre)
 * POST /api/auth/refresh               -> refresh del token di sessione
 * POST /api/auth/send-verification-code / verify-code -> OTP email
 * POST /api/auth/register              -> registrazione sicura (email + password)
 * POST /api/auth/login-secure          -> login email + password -> JWT
 * POST /api/auth/upgrade               -> l'ospite collega il suo user a un account
 * POST /api/auth/claim-info / complete-claim -> link di recupero inviato via email
 * GET  /api/auth/me                    -> dati utente + evento correnti
 */
import { Hono } from "hono";
import { z } from "zod";
import { bearerToken, createJwt, decodeJwt, hashPassword, isJwt, requireUser, verifyPassword } from "../auth";
import { runInBackground } from "../background";
import type { Db, Row } from "../db";
import { processDueReminders } from "../email";
import type { AppEnv } from "../env";
import { ApiError } from "../errors";
import { accountOut, eventOut, userOut } from "../serializers";
import { normalize, parseJson } from "../util";
import { createAndSendCode, normalizeEmail, verifyCode } from "../verification";
import type { Config } from "../config";

const router = new Hono<AppEnv>();

const str = z.string().nullish();

const LoginRequest = z.object({
  invite_code: z.string(),
  nickname: z.string(),
  pin: z.string(),
  is_couple: z.boolean().default(false),
  secret_word: str, // retrocompatibilità sposi
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
  display_name: z.string(),
  first_name: str,
  last_name: str,
  verification_code: str,
});
const LoginSecureRequest = z.object({ email: z.string(), password: z.string() });
const UpgradeRequest = z.object({
  email: z.string(),
  password: z.string(),
  display_name: str,
  first_name: str,
  last_name: str,
  verification_code: str,
});
const ClaimInfoRequest = z.object({ claim_token: z.string() });
const CompleteClaimRequest = z.object({
  claim_token: z.string(),
  password: z.string(),
  first_name: str,
  last_name: str,
  display_name: str,
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

// ── LOGIN INVITATI (nickname + PIN 4 cifre) ─────────────────────────────────

router.post("/login", async (c) => {
  const db = c.get("db");
  const cfg = c.get("cfg");
  const { data: body } = await parseJson(c, LoginRequest);

  const code = body.invite_code.trim().toUpperCase();
  if (!code) throw new ApiError(422, "Inserisci il codice del matrimonio.");

  const event = await db.queryOne("SELECT * FROM events WHERE invite_code = $1", [code]);
  if (!event) throw new ApiError(404, "Codice matrimonio non trovato. Controlla il codice inserito.");

  const coupleUser = await db.queryOne("SELECT * FROM users WHERE event_id = $1 AND role = 'couple'", [event.id]);

  let user: Row | null = null;
  let isNew = false;
  let accountId: string | null = null;

  // Un account già autenticato può partecipare con JWT: nickname basta.
  const authorization = c.req.header("authorization");
  if (!body.is_couple && authorization?.startsWith("Bearer ")) {
    const tokenStr = authorization.slice("Bearer ".length).trim();
    if (isJwt(tokenStr)) {
      const payload = await decodeJwt(cfg, tokenStr);
      if (payload?.type === "account") {
        const account = await db.queryOne("SELECT * FROM accounts WHERE id = $1", [String(payload.sub)]);
        if (account?.email) {
          accountId = String(account.id);
          const nick = (body.nickname || "").trim();
          if (!nick) throw new ApiError(422, "Inserisci un nickname per partecipare.");

          user = await db.queryOne(
            "SELECT * FROM users WHERE event_id = $1 AND account_id = $2",
            [event.id, accountId],
          );
          if (!user) {
            // Controlla se il nickname è già preso da un altro utente
            const existingNick = await db.queryOne(
              "SELECT id FROM users WHERE event_id = $1 AND LOWER(nickname) = $2 AND role = 'guest'",
              [event.id, nick.toLowerCase()],
            );
            if (existingNick) {
              throw new ApiError(409, `Il nickname "${nick}" è già in uso per questo matrimonio. Scegli un altro nome.`);
            }
            isNew = true;
            user = await db.execute(
              `INSERT INTO users (event_id, role, nickname, pin, account_id)
               VALUES ($1, 'guest', $2, $3, $4) RETURNING *`,
              [event.id, nick, body.pin || "0000", accountId],
            );
          } else if (nick !== user.nickname) {
            user = await db.execute("UPDATE users SET nickname = $1 WHERE id = $2 RETURNING *", [nick, user.id]);
          }
        }
      }
    }
  }

  if (user) {
    // Accesso completato sopra per account autenticato.
  } else if (body.is_couple) {
    throw new ApiError(
      401,
      "Per accedere come sposi, effettua l'accesso con la tua email e password.",
    );
  } else {
    // Login invitato: nickname + PIN 4 cifre
    const nick = (body.nickname || "").trim();
    const pin = (body.pin || "").trim();
    if (!nick) throw new ApiError(422, "Inserisci un nickname (es. Zia Pina, Nonno Bruno).");
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      throw new ApiError(422, "Inserisci un PIN di 4 cifre (es. il tuo anno di nascita).");
    }

    // Cerca un utente con questo nickname nello stesso evento
    const existing = await db.queryOne(
      "SELECT * FROM users WHERE event_id = $1 AND LOWER(nickname) = $2 AND role = 'guest'",
      [event.id, nick.toLowerCase()],
    );

    if (existing) {
      // Nickname esiste: controlla il PIN
      if (existing.pin !== pin) {
        throw new ApiError(409, {
          code: "NICKNAME_EXISTS",
          message: `Per questo matrimonio c'è già un "${nick}". Se sei tu che stai accedendo da un altro dispositivo, inserisci il tuo PIN corretto. Altrimenti, cambia nickname.`,
          nickname: nick,
        });
      }
      // PIN corretto: rientra con lo stesso utente
      user = existing;
    } else {
      // Nuovo utente
      isNew = true;
      user = await db.execute(
        `INSERT INTO users (event_id, role, nickname, pin)
         VALUES ($1, 'guest', $2, $3) RETURNING *`,
        [event.id, nick, pin],
      );
    }
  }

  const u = user!;
  const session = await createSession(db, cfg, u.id, accountId || u.account_id || null);

  const result: Row = {
    token: session.token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    is_new: isNew,
    user: userOut(u),
    event: eventOut(event),
  };

  // Se l'utente ha un account collegato aggiungiamo anche il JWT
  if (u.account_id) {
    result.jwt = await createJwt(cfg, String(u.account_id));
    const account = await db.queryOne("SELECT * FROM accounts WHERE id = $1", [u.account_id]);
    if (account) result.account = accountOut(account);
  }
  return c.json(result);
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
    const existing = await db.queryOne("SELECT id FROM accounts WHERE email = $1", [email]);
    if (existing && body.purpose === "register_account") {
      throw new ApiError(409, "Esiste già un account con questa email. Prova ad accedere.");
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

/** Registrazione sicura: account con email + password, verificato via codice a 6 cifre. */
router.post("/register", async (c) => {
  const db = c.get("db");
  const cfg = c.get("cfg");
  const { data: body } = await parseJson(c, RegisterRequest);

  const email = body.email.trim().toLowerCase();
  if (!email || !body.password || body.password.length < 6) {
    throw new ApiError(422, "Email e password (min 6 caratteri) sono obbligatori.");
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
    `INSERT INTO accounts (email, password_hash, display_name, first_name, last_name, is_verified, registered_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
    [email, await hashPassword(body.password), body.display_name.trim(), (body.first_name ?? "").trim() || null, (body.last_name ?? "").trim() || null, true],
  );

  return c.json({ jwt: await createJwt(cfg, String(account!.id)), account: accountOut(account!) });
});

/** Login con email + password. Ritorna JWT + account + lista eventi. */
router.post("/login-secure", async (c) => {
  const db = c.get("db");
  const cfg = c.get("cfg");
  const { data: body } = await parseJson(c, LoginSecureRequest);

  const email = body.email.trim().toLowerCase();
  if (!email || !body.password) throw new ApiError(422, "Email e password sono obbligatori.");

  const account = await db.queryOne("SELECT * FROM accounts WHERE email = $1", [email]);
  if (!account || !account.password_hash || !(await verifyPassword(body.password, account.password_hash))) {
    throw new ApiError(401, "Email o password non corretti.");
  }

  const events = await db.query(
    `SELECT DISTINCT e.* FROM events e
     JOIN users u ON u.event_id = e.id
     WHERE u.account_id = $1
     ORDER BY e.created_at DESC`,
    [account.id],
  );

  return c.json({
    jwt: await createJwt(cfg, String(account.id)),
    account: accountOut(account),
    events: events.map(eventOut),
  });
});

/**
 * Un utente con session token puo' "upgradare" creando un account permanente.
 * Collega il suo user (e tutti gli user con lo stesso account_id nullo) all'account.
 * Richiede: email, password, nome, cognome, verifica email.
 */
router.post("/upgrade", requireUser, async (c) => {
  const db = c.get("db");
  const cfg = c.get("cfg");
  const current = c.get("user");
  const { data: body } = await parseJson(c, UpgradeRequest);

  const email = body.email.trim().toLowerCase();
  if (!email || !body.password || body.password.length < 6) {
    throw new ApiError(422, "Email e password (min 6 caratteri) sono obbligatori.");
  }

  let isVerified = false;
  if (body.verification_code) {
    if (!(await verifyCode(db, email, body.verification_code, "upgrade_account", true))) {
      throw new ApiError(400, "Codice di verifica non valido o scaduto.");
    }
    isVerified = true;
  }

  let account = await db.queryOne("SELECT * FROM accounts WHERE email = $1", [email]);

  if (account) {
    if (!account.password_hash) throw new ApiError(409, "Account già esistente ma non completamente registrato.");
    if (!(await verifyPassword(body.password, account.password_hash))) {
      throw new ApiError(401, "Password non corretta per questo account.");
    }
    if (isVerified) await db.execute("UPDATE accounts SET is_verified = TRUE WHERE id = $1", [account.id]);
  } else {
    const display = body.display_name || current.nickname || "";
    const firstName = (body.first_name ?? "").trim();
    const lastName = (body.last_name ?? "").trim();
    account = await db.execute(
      `INSERT INTO accounts (email, password_hash, display_name, first_name, last_name, is_verified, registered_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
      [email, await hashPassword(body.password), display.trim(), firstName || null, lastName || null, isVerified],
    );
  }

  await db.execute("UPDATE users SET account_id = $1 WHERE id = $2 AND account_id IS NULL", [account!.id, current.id]);

  return c.json({
    jwt: await createJwt(cfg, String(account!.id)),
    account: accountOut(account!),
    user: userOut(current),
  });
});

// ── LINK DI RECUPERO (reminder via email) ───────────────────────────────────

/**
 * Risolve il link inviato via email: ritorna i dati dell'ospite e riattiva la sua sessione,
 * cosi' puo' confermare la password e collegare l'account permanente.
 */
router.post("/claim-info", async (c) => {
  const db = c.get("db");
  const cfg = c.get("cfg");
  const { data: body } = await parseJson(c, ClaimInfoRequest);

  const payload = await decodeJwt(cfg, body.claim_token);
  if (!payload || payload.type !== "claim_guest") {
    throw new ApiError(400, "Il link di recupero non è valido o è scaduto.");
  }

  const userId = String(payload.sub);
  const eventId = payload.event_id as string | undefined;
  const email = String(payload.email ?? "").trim().toLowerCase();

  const user = await db.queryOne("SELECT * FROM users WHERE id = $1", [userId]);
  if (!user) throw new ApiError(404, "Profilo utente non trovato.");

  const event = await db.queryOne("SELECT * FROM events WHERE id = $1", [eventId || user.event_id]);

  let account: Row | null = null;
  if (user.account_id) account = await db.queryOne("SELECT * FROM accounts WHERE id = $1", [user.account_id]);
  else if (email) account = await db.queryOne("SELECT * FROM accounts WHERE email = $1", [email]);

  const session = await getOrCreateSession(db, cfg, user.id);

  // Account gia' completamente registrato: JWT diretto
  if (account?.password_hash) {
    return c.json({
      valid: true,
      already_registered: true,
      jwt: await createJwt(cfg, String(account.id)),
      account: accountOut(account),
      user: userOut(user),
      event: event ? eventOut(event) : null,
      token: session.token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
    });
  }

  const nick = user.nickname || "";
  return c.json({
    valid: true,
    already_registered: false,
    email: email || "",
    first_name: nick,
    last_name: "",
    display_name: nick,
    event: event ? eventOut(event) : null,
    user: userOut(user),
    token: session.token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
  });
});

/**
 * Completa la registrazione dal link via email (email gia' verificata perche' aperta dal link firmato):
 * salva la password, collega l'utente e ritorna JWT e sessione per la dashboard.
 */
router.post("/complete-claim", async (c) => {
  const db = c.get("db");
  const cfg = c.get("cfg");
  const { data: body } = await parseJson(c, CompleteClaimRequest);

  const payload = await decodeJwt(cfg, body.claim_token);
  if (!payload || payload.type !== "claim_guest") {
    throw new ApiError(400, "Il link di recupero non è valido o è scaduto.");
  }
  if (!body.password || body.password.length < 6) {
    throw new ApiError(422, "La password deve contenere almeno 6 caratteri.");
  }

  const userId = String(payload.sub);
  const eventId = payload.event_id as string | undefined;
  let email = String(payload.email ?? "").trim().toLowerCase();

  const user = await db.queryOne("SELECT * FROM users WHERE id = $1", [userId]);
  if (!user) throw new ApiError(404, "Profilo utente non trovato.");

  if (!email) throw new ApiError(422, "Email non associata a questo invito.");

  const first = (body.first_name ?? "").trim() || user.nickname || "";
  const last = (body.last_name ?? "").trim() || "";
  if (!first) {
    throw new ApiError(422, "Il nome è obbligatorio per completare la registrazione.");
  }
  const display = (body.display_name ?? "").trim() || first;

  const passwordHash = await hashPassword(body.password);
  const existing = await db.queryOne("SELECT * FROM accounts WHERE email = $1", [email]);
  let account: Row | null;
  if (existing) {
    account = await db.queryOne(
      `UPDATE accounts SET password_hash = $1, display_name = $2, first_name = $3, last_name = $4, is_verified = TRUE WHERE id = $5 RETURNING *`,
      [passwordHash, display, first, last || null, existing.id],
    );
  } else {
    account = await db.execute(
      `INSERT INTO accounts (email, password_hash, display_name, first_name, last_name, is_verified, registered_at)
       VALUES ($1, $2, $3, $4, $5, TRUE, NOW()) RETURNING *`,
      [email, passwordHash, display, first, last || null],
    );
  }

  await db.execute("UPDATE users SET account_id = $1 WHERE id = $2", [account!.id, user.id]);
  await db.execute("UPDATE registration_reminders SET sent_at = NOW() WHERE email = $1", [email]);

  const session = await getOrCreateSession(db, cfg, user.id, account!.id);
  const event = await db.queryOne("SELECT * FROM events WHERE id = $1", [eventId || user.event_id]);

  return c.json({
    jwt: await createJwt(cfg, String(account!.id)),
    account: accountOut(account!),
    user: userOut(user),
    event: event ? eventOut(event) : null,
    token: session.token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
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
