/**
 * Rotte di autenticazione.
 * POST /api/auth/login                 -> login leggero ospiti (email verificata o nickname + parola segreta)
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

const router = new Hono<AppEnv>();

const str = z.string().nullish();

const LoginRequest = z.object({
  invite_code: z.string(),
  nickname: str,
  email: str,
  verification_code: str,
  no_email: z.boolean().default(false),
  secret_word: str,
  first_name: str,
  last_name: str,
  is_couple: z.boolean().default(false),
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
  verification_code: str,
});
const LoginSecureRequest = z.object({ email: z.string(), password: z.string() });
const UpgradeRequest = z.object({
  email: z.string(),
  password: z.string(),
  display_name: str,
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

/** Sessione attiva dell'utente (la piu' lunga) oppure una nuova valida 30 giorni. */
async function getOrCreateSession(db: Db, userId: string): Promise<string> {
  const sess = await db.queryOne(
    "SELECT token FROM sessions WHERE user_id = $1 AND expires_at > NOW() ORDER BY expires_at DESC LIMIT 1",
    [userId],
  );
  if (sess) return sess.token;
  const token = crypto.randomUUID();
  await db.execute(
    "INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL '30 days')",
    [userId, token],
  );
  return token;
}

// ── LOGIN OSPITI ────────────────────────────────────────────────────────────

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

  // Un account gia' autenticato puo' partecipare senza OTP: bastano codice e nickname.
  const authorization = c.req.header("authorization");
  if (!body.is_couple && !body.no_email && authorization?.startsWith("Bearer ")) {
    const token = authorization.slice("Bearer ".length).trim();
    if (isJwt(token)) {
      const payload = await decodeJwt(cfg, token);
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
            isNew = true;
            user = await db.execute(
              `INSERT INTO users (event_id, role, first_name, last_name, secret_word, account_id, email)
               VALUES ($1, 'guest', $2, '', '', $3, $4) RETURNING *`,
              [event.id, nick, accountId, account.email],
            );
          } else if (nick !== user.first_name) {
            user = await db.execute("UPDATE users SET first_name = $1 WHERE id = $2 RETURNING *", [nick, user.id]);
          }
        }
      }
    }
  }

  if (user) {
    // Accesso completato sopra per account autenticato.
  } else if (body.is_couple) {
    // 1. Accesso sposi (parola segreta sposi)
    const word = normalize(body.secret_word ?? "");
    if (!coupleUser) throw new ApiError(404, "Nessun account sposi trovato per questo matrimonio.");
    if (word !== normalize(coupleUser.secret_word)) {
      throw new ApiError(
        401,
        "Parola segreta sposi non corretta. Inserisci la parola impostata durante la creazione del matrimonio.",
      );
    }
    user = coupleUser;
  } else if (body.no_email) {
    // 2. Modalita' SENZA EMAIL (nickname + parola segreta personale)
    const nick = (body.nickname || body.first_name || "").trim();
    const word = normalize(body.secret_word ?? "");
    if (!nick) throw new ApiError(422, "Inserisci un nickname (es. Zia Pina, Nonno Bruno).");
    if (!word) throw new ApiError(422, "Inserisci una parola segreta personale per poter rientrare.");

    user = await db.queryOne(
      "SELECT * FROM users WHERE event_id = $1 AND LOWER(first_name) = $2 AND LOWER(secret_word) = $3 AND role = 'guest'",
      [event.id, nick.toLowerCase(), word],
    );
    if (!user) {
      isNew = true;
      user = await db.execute(
        `INSERT INTO users (event_id, role, first_name, last_name, secret_word, email)
         VALUES ($1, 'guest', $2, '', $3, NULL) RETURNING *`,
        [event.id, nick, word],
      );
    }
  } else if (body.email) {
    // 3. Modalita' CON EMAIL VERIFICATA
    const email = normalizeEmail(body.email);
    const codeInput = (body.verification_code ?? "").trim();
    if (!codeInput || codeInput.length !== 6) {
      throw new ApiError(422, "Inserisci il codice di verifica a 6 cifre inviato alla tua email.");
    }
    if (!(await verifyCode(db, email, codeInput, "join_guest", true))) {
      throw new ApiError(400, "Codice di verifica email non valido o scaduto.");
    }

    user = await db.queryOne(
      "SELECT * FROM users WHERE event_id = $1 AND LOWER(email) = $2 AND role = 'guest'",
      [event.id, email],
    );
    const nick = (body.nickname || body.first_name || "").trim();

    if (user) {
      // Ospite gia' registrato alla festa: aggiorna il nickname se fornito
      if (nick && nick !== user.first_name) {
        user = await db.execute("UPDATE users SET first_name = $1 WHERE id = $2 RETURNING *", [nick, user.id]);
      }
    } else {
      if (!nick) {
        throw new ApiError(422, "Inserisci il tuo nickname per partecipare (es. Zia Pina, Fratello sposa).");
      }
      isNew = true;
      user = await db.execute(
        `INSERT INTO users (event_id, role, first_name, last_name, secret_word, email)
         VALUES ($1, 'guest', $2, '', '', $3) RETURNING *`,
        [event.id, nick, email],
      );

      // Programma il reminder per creare l'account dopo N giorni
      const sendAfter = new Date(Date.now() + cfg.registrationReminderDays * 86_400_000);
      await db.execute(
        "INSERT INTO registration_reminders (user_id, event_id, email, send_after) VALUES ($1, $2, $3, $4)",
        [user!.id, event.id, email, sendAfter],
      );
      if (cfg.registrationReminderDays <= 0) {
        runInBackground(c, (bgDb, bgCfg) => processDueReminders(bgDb, bgCfg));
      }
    }
  } else if (body.first_name && body.secret_word) {
    // 4. Compatibilita' legacy (nome + cognome + parola segreta)
    const first = normalize(body.first_name);
    const last = normalize(body.last_name ?? "");
    const word = normalize(body.secret_word);
    user = await db.queryOne(
      "SELECT * FROM users WHERE event_id = $1 AND LOWER(first_name) = $2 AND LOWER(last_name) = $3 AND LOWER(secret_word) = $4",
      [event.id, first, last, word],
    );
    if (!user) {
      isNew = true;
      user = await db.execute(
        `INSERT INTO users (event_id, role, first_name, last_name, secret_word, email)
         VALUES ($1, 'guest', $2, $3, $4, NULL) RETURNING *`,
        [event.id, body.first_name.trim(), last, word],
      );
    }
  } else {
    throw new ApiError(
      422,
      "Inserisci la tua email verificata oppure seleziona l'opzione 'Non possiedo un indirizzo email'.",
    );
  }

  const u = user!;
  const token = crypto.randomUUID();
  await db.execute("INSERT INTO sessions (token, user_id, account_id) VALUES ($1, $2, $3)", [
    token,
    u.id,
    accountId || u.account_id || null,
  ]);

  const result: Row = { token, is_new: isNew, user: userOut(u), event: eventOut(event) };

  // Se l'utente ha un account collegato aggiungiamo anche il JWT
  if (u.account_id) {
    result.jwt = await createJwt(cfg, String(u.account_id));
    const account = await db.queryOne("SELECT * FROM accounts WHERE id = $1", [u.account_id]);
    if (account) result.account = accountOut(account);
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
  if (body.purpose === "join_guest") {
    const existingAccount = await db.queryOne("SELECT id, password_hash FROM accounts WHERE email = $1", [email]);
    if (existingAccount?.password_hash) {
      throw new ApiError(409, "Questa email appartiene già a un account. Effettua il login con email e password.");
    }

    const existingGuest = await db.queryOne(
      "SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1",
      [email],
    );
    if (existingGuest && !body.confirm_existing) {
      return c.json({
        success: false,
        requires_confirmation: true,
        message:
          "Questa email è già associata a un invitato. Sei sicuro di voler inviare un nuovo codice per partecipare a un altro matrimonio?",
      });
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
    `INSERT INTO accounts (email, password_hash, display_name, is_verified, registered_at)
     VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
    [email, await hashPassword(body.password), body.display_name.trim(), true],
  );

  return c.json({ jwt: await createJwt(cfg, String(account!.id)), account: accountOut(account!) });
});

/** Login con email + password. Ritorna JWT + account + lista eventi. */
router.post("/login-secure", async (c) => {
  const db = c.get("db");
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
    jwt: await createJwt(c.get("cfg"), String(account.id)),
    account: accountOut(account),
    events: events.map(eventOut),
  });
});

/**
 * Un utente con session token puo' "upgradare" creando un account permanente.
 * Collega il suo user (e tutti gli user con la stessa email) all'account.
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
    const display = body.display_name || `${current.first_name} ${current.last_name}`;
    account = await db.execute(
      `INSERT INTO accounts (email, password_hash, display_name, is_verified, registered_at)
       VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
      [email, await hashPassword(body.password), display.trim(), isVerified],
    );
  }

  await db.execute("UPDATE users SET account_id = $1 WHERE id = $2 AND account_id IS NULL", [account!.id, current.id]);
  await db.execute("UPDATE users SET account_id = $1 WHERE email = $2 AND account_id IS NULL", [account!.id, email]);

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

  const sessionToken = await getOrCreateSession(db, user.id);

  // Account gia' completamente registrato: JWT diretto
  if (account?.password_hash) {
    return c.json({
      valid: true,
      already_registered: true,
      jwt: await createJwt(cfg, String(account.id)),
      account: accountOut(account),
      user: userOut(user),
      event: event ? eventOut(event) : null,
      token: sessionToken,
    });
  }

  const first = user.first_name || "";
  const last = user.last_name || "";
  return c.json({
    valid: true,
    already_registered: false,
    email: email || user.email || "",
    first_name: first,
    last_name: last,
    display_name: `${first} ${last}`.trim(),
    event: event ? eventOut(event) : null,
    user: userOut(user),
    token: sessionToken,
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

  if (!email && user.email) email = String(user.email).trim().toLowerCase();
  if (!email) throw new ApiError(422, "Email non associata a questo invito.");

  const first = (body.first_name ?? "").trim() || user.first_name || "";
  const last = (body.last_name ?? "").trim() || user.last_name || "";
  if (!first || !last) {
    throw new ApiError(422, "Nome e cognome sono obbligatori per completare la registrazione.");
  }
  const display = (body.display_name ?? "").trim() || `${first} ${last}`.trim();

  await db.execute("UPDATE users SET first_name = $1, last_name = $2 WHERE id = $3", [first, last, user.id]);
  user.first_name = first;
  user.last_name = last;

  const passwordHash = await hashPassword(body.password);
  const existing = await db.queryOne("SELECT * FROM accounts WHERE email = $1", [email]);
  let account: Row | null;
  if (existing) {
    account = await db.queryOne(
      `UPDATE accounts SET password_hash = $1, display_name = $2, is_verified = TRUE WHERE id = $3 RETURNING *`,
      [passwordHash, display, existing.id],
    );
  } else {
    account = await db.execute(
      `INSERT INTO accounts (email, password_hash, display_name, is_verified, registered_at)
       VALUES ($1, $2, $3, TRUE, NOW()) RETURNING *`,
      [email, passwordHash, display],
    );
  }

  await db.execute("UPDATE users SET account_id = $1 WHERE id = $2", [account!.id, user.id]);
  await db.execute("UPDATE users SET account_id = $1 WHERE email = $2 AND account_id IS NULL", [account!.id, email]);
  await db.execute("UPDATE registration_reminders SET sent_at = NOW() WHERE email = $1", [email]);

  const sessionToken = await getOrCreateSession(db, user.id);
  const event = await db.queryOne("SELECT * FROM events WHERE id = $1", [eventId || user.event_id]);

  return c.json({
    jwt: await createJwt(cfg, String(account!.id)),
    account: accountOut(account!),
    user: userOut(user),
    event: event ? eventOut(event) : null,
    token: sessionToken,
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
    if (user) {
      event = await db.queryOne("SELECT * FROM events WHERE id = $1", [user.event_id]);
      sessionToken = await getOrCreateSession(db, user.id);
    }

    return c.json({
      account: accountOut(account),
      user: user ? userOut(user) : null,
      event: event ? eventOut(event) : null,
      token: sessionToken,
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

  return c.json({
    user: userOut(row),
    event: event ? eventOut(event) : null,
    account: account ? accountOut(account) : null,
  });
});

export default router;
