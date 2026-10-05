import { Hono } from "hono";
import { Env, getDb } from "../db";
import { hashPassword, verifyPassword, createJwt, verifyJwt } from "../auth";

export const authRouter = new Hono<{ Bindings: Env }>();

// POST /api/auth/login (login con codice evento)
authRouter.post("/login", async (c) => {
  const body = await c.req.json();
  const inviteCode = (body.invite_code || "").trim().toUpperCase();
  const firstName = (body.first_name || "").trim().toLowerCase();
  const lastName = (body.last_name || "").trim().toLowerCase();
  const secretWord = (body.secret_word || "").trim().toLowerCase();
  const isCouple = !!body.is_couple;

  if (!inviteCode) {
    return c.json({ detail: "Codice evento obbligatorio." }, 400);
  }

  const db = getDb(c.env);

  const event = await db.one("SELECT * FROM events WHERE lower(invite_code) = lower($1) LIMIT 1", [inviteCode]);

  if (!event) {
    return c.json({ detail: "Codice evento non valido o matrimonio inesistente." }, 404);
  }

  if (firstName && lastName) {
    let user = await db.one(
      `SELECT * FROM users
       WHERE event_id = $1 AND lower(first_name) = lower($2) AND lower(last_name) = lower($3)
       LIMIT 1`,
      [event.id, firstName, lastName]
    );

    if (!user) {
      user = await db.one(
        `INSERT INTO users (event_id, first_name, last_name, secret_word, role)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [event.id, firstName, lastName, secretWord || "ospite", isCouple ? "couple" : "guest"]
      );
    }

    const token = await createJwt(
      {
        sub: user.id,
        event_id: event.id,
        role: user.role,
        type: "guest",
      },
      c.env.JWT_SECRET || "default_jwt_secret"
    );

    return c.json({
      token,
      jwt: token,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        total_points: user.total_points || 0,
      },
      event: {
        id: event.id,
        spouse1_name: event.spouse1_name,
        spouse2_name: event.spouse2_name,
        invite_code: event.invite_code,
      },
    });
  }

  return c.json({
    event: {
      id: event.id,
      spouse1_name: event.spouse1_name,
      spouse2_name: event.spouse2_name,
      invite_code: event.invite_code,
    },
  });
});

// POST /api/auth/register
authRouter.post("/register", async (c) => {
  const body = await c.req.json();
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  const displayName = body.display_name || "";

  if (!email || !password) {
    return c.json({ detail: "Email e password obbligatorie." }, 400);
  }

  const db = getDb(c.env);

  const existing = await db.one("SELECT id FROM accounts WHERE email = $1", [email]);

  if (existing) {
    return c.json({ detail: "Un account con questa email esiste già." }, 409);
  }

  const passwordHash = hashPassword(password);
  const account = await db.one(
    `INSERT INTO accounts (email, password_hash, display_name, is_verified)
     VALUES ($1, $2, $3, TRUE) RETURNING *`,
    [email, passwordHash, displayName]
  );

  const token = await createJwt({ sub: account.id, type: "account" }, c.env.JWT_SECRET || "default_jwt_secret");

  return c.json({
    token,
    jwt: token,
    account: {
      id: account.id,
      email: account.email,
      display_name: account.display_name,
    },
  });
});

// POST /api/auth/login-secure
authRouter.post("/login-secure", async (c) => {
  const body = await c.req.json();
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";

  const db = getDb(c.env);
  const account = await db.one("SELECT * FROM accounts WHERE email = $1", [email]);

  if (!account || !verifyPassword(password, account.password_hash)) {
    return c.json({ detail: "Credenziali non valide." }, 401);
  }

  const token = await createJwt({ sub: account.id, type: "account" }, c.env.JWT_SECRET || "default_jwt_secret");

  // Cerca tutti gli eventi dell'account
  const events = await db.all(
    `SELECT e.* FROM users u JOIN events e ON e.id = u.event_id WHERE u.account_id = $1`,
    [account.id]
  );

  return c.json({
    token,
    jwt: token,
    account: {
      id: account.id,
      email: account.email,
      display_name: account.display_name,
    },
    events,
  });
});

// GET /api/auth/me
authRouter.get("/me", async (c) => {
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) return c.json({ detail: "Non autenticato." }, 401);

  const payload = await verifyJwt(token, c.env.JWT_SECRET || "default_jwt_secret");
  if (!payload) return c.json({ detail: "Token non valido o scaduto." }, 401);

  const db = getDb(c.env);

  if (payload.type === "account") {
    const account = await db.one("SELECT * FROM accounts WHERE id = $1", [payload.sub]);
    return c.json({ account });
  }

  const user = await db.one("SELECT * FROM users WHERE id = $1", [payload.sub]);
  if (!user) return c.json({ detail: "Utente non trovato." }, 404);

  const event = await db.one("SELECT * FROM events WHERE id = $1", [user.event_id]);

  return c.json({
    user: {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      total_points: user.total_points,
    },
    event,
  });
});

authRouter.post("/send-verification-code", async (c) => {
  const body = await c.req.json();
  const email = (body.email || "").trim().toLowerCase();
  const purpose = body.purpose || "register_account";

  if (!email || !email.includes("@")) {
    return c.json({ detail: "Email non valida." }, 400);
  }

  // Genera codice OTP a 6 cifre
  const code = String(Math.floor(100000 + Math.random() * 900000));

  // Salva nel DB con scadenza 15 minuti
  const db = getDb(c.env);
  await db.all(
    "INSERT INTO email_verification_codes (email, code, purpose, expires_at) VALUES ($1, $2, $3, $4)",
    [email, code, purpose, new Date(Date.now() + 15 * 60 * 1000).toISOString()]
  );

  // ⚠️ MODALITÀ DEV: stampa il codice in console (guarda i log di wrangler)
  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║  📧 CODICE OTP PER: ${email}`);
  console.log(`║  🔑 CODICE: ${code}`);
  console.log(`║  📋 SCOPO: ${purpose}`);
  console.log(`╚══════════════════════════════════════╝\n`);

  return c.json({ success: true, message: `Codice inviato a ${email}`, expires_in_minutes: 15 });
});

authRouter.post("/verify-code", async (c) => {
  const body = await c.req.json();
  const email = (body.email || "").trim().toLowerCase();
  const code = (body.code || "").trim();
  const purpose = body.purpose || "register_account";

  const db = getDb(c.env);
  const row = await db.one(
    `SELECT id FROM email_verification_codes
     WHERE email = $1 AND code = $2 AND purpose = $3 AND used_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [email, code, purpose]
  );

  if (!row) {
    return c.json({ detail: "Codice non valido o scaduto." }, 400);
  }

  return c.json({ valid: true, message: "Codice verificato con successo." });
});
