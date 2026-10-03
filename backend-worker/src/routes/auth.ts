import { Hono } from "hono";
import { Env, getSupabase } from "../db";
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

  const supabase = getSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  const { data: event, error: eventErr } = await supabase
    .from("events")
    .select("*")
    .ilike("invite_code", inviteCode)
    .single();

  if (eventErr || !event) {
    return c.json({ detail: "Codice evento non valido o matrimonio inesistente." }, 404);
  }

  if (firstName && lastName) {
    let { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("event_id", event.id)
      .ilike("first_name", firstName)
      .ilike("last_name", lastName)
      .maybeSingle();

    if (!user) {
      const { data: newUser, error: createErr } = await supabase
        .from("users")
        .insert({
          event_id: event.id,
          first_name: firstName,
          last_name: lastName,
          secret_word: secretWord || "ospite",
          role: isCouple ? "couple" : "guest",
        })
        .select()
        .single();

      if (createErr) {
        return c.json({ detail: createErr.message }, 500);
      }
      user = newUser;
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

  const supabase = getSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  const { data: existing } = await supabase
    .from("accounts")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    return c.json({ detail: "Un account con questa email esiste già." }, 409);
  }

  const passwordHash = hashPassword(password);
  const { data: account, error } = await supabase
    .from("accounts")
    .insert({
      email,
      password_hash: passwordHash,
      display_name: displayName,
      is_verified: true,
    })
    .select()
    .single();

  if (error) return c.json({ detail: error.message }, 500);

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

  const supabase = getSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const { data: account } = await supabase.from("accounts").select("*").eq("email", email).maybeSingle();

  if (!account || !verifyPassword(password, account.password_hash)) {
    return c.json({ detail: "Credenziali non valide." }, 401);
  }

  const token = await createJwt({ sub: account.id, type: "account" }, c.env.JWT_SECRET || "default_jwt_secret");

  // Cerca tutti gli eventi dell'account
  const { data: userRows } = await supabase
    .from("users")
    .select("event_id, events(*)")
    .eq("account_id", account.id);

  const events = (userRows || []).map((r: any) => r.events).filter(Boolean);

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

  const supabase = getSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  if (payload.type === "account") {
    const { data: account } = await supabase.from("accounts").select("*").eq("id", payload.sub).single();
    return c.json({ account });
  }

  const { data: user } = await supabase.from("users").select("*").eq("id", payload.sub).single();
  if (!user) return c.json({ detail: "Utente non trovato." }, 404);

  const { data: event } = await supabase.from("events").select("*").eq("id", user.event_id).single();

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
  const supabase = getSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  await supabase.from("email_verification_codes").insert({
    email,
    code,
    purpose,
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  });

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

  const supabase = getSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const { data: row } = await supabase
    .from("email_verification_codes")
    .select("id")
    .eq("email", email)
    .eq("code", code)
    .eq("purpose", purpose)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) {
    return c.json({ detail: "Codice non valido o scaduto." }, 400);
  }

  return c.json({ valid: true, message: "Codice verificato con successo." });
});
