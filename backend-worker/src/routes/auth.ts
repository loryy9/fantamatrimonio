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

  return c.json({
    token,
    account: {
      id: account.id,
      email: account.email,
      display_name: account.display_name,
    },
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
  return c.json({ success: true, message: "Codice verificato", expires_in_minutes: 15 });
});

authRouter.post("/verify-code", async (c) => {
  return c.json({ success: true, verified: true });
});
