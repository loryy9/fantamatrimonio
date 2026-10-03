import { Hono } from "hono";
import { Env, getSupabase } from "../db";
import { verifyJwt, generateInviteCode } from "../auth";

export const eventsRouter = new Hono<{ Bindings: Env }>();

async function getAuth(c: any) {
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  return await verifyJwt(token, c.env.JWT_SECRET || "default_jwt_secret");
}

// GET /api/events/preview/:inviteCode
eventsRouter.get("/preview/:inviteCode", async (c) => {
  const code = c.req.param("inviteCode").trim().toUpperCase();
  const supabase = getSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  const { data: event, error } = await supabase
    .from("events")
    .select("id, spouse1_name, spouse2_name, enable_timer, start_time, end_time, invite_code")
    .ilike("invite_code", code)
    .maybeSingle();

  if (error || !event) return c.json({ detail: "Evento non trovato" }, 404);
  return c.json(event);
});

// POST /api/events
eventsRouter.post("/", async (c) => {
  const body = await c.req.json();
  const auth = await getAuth(c);

  const spouse1 = (body.spouse1_name || "").trim();
  const spouse2 = (body.spouse2_name || "").trim();
  const coupleFirst = (body.couple_first_name || spouse1).trim().toLowerCase();
  const coupleLast = (body.couple_last_name || spouse2).trim().toLowerCase();
  const enableTimer = !!body.enable_timer;
  const startTime = body.start_time || null;
  const endTime = body.end_time || null;

  if (!spouse1 || !spouse2) {
    return c.json({ detail: "I nomi degli sposi sono obbligatori." }, 400);
  }

  const inviteCode = generateInviteCode(6);
  const supabase = getSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  const { data: event, error: eventErr } = await supabase
    .from("events")
    .insert({
      spouse1_name: spouse1,
      spouse2_name: spouse2,
      enable_timer: enableTimer,
      start_time: startTime,
      end_time: endTime,
      invite_code: inviteCode,
    })
    .select()
    .single();

  if (eventErr) return c.json({ detail: eventErr.message }, 500);

  const { data: coupleUser } = await supabase
    .from("users")
    .insert({
      event_id: event.id,
      first_name: coupleFirst,
      last_name: coupleLast,
      secret_word: "sposi",
      role: "couple",
      account_id: auth?.sub || null,
    })
    .select()
    .single();

  return c.json({
    event,
    couple_user: coupleUser,
    invite_code: event.invite_code,
  });
});

// GET /api/events/me
eventsRouter.get("/me", async (c) => {
  const auth = await getAuth(c);
  if (!auth) return c.json({ detail: "Non autorizzato." }, 401);

  const supabase = getSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  let eventId = auth.event_id;

  if (!eventId && auth.type === "account") {
    const { data: user } = await supabase
      .from("users")
      .select("event_id")
      .eq("account_id", auth.sub)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    eventId = user?.event_id;
  }

  if (!eventId) return c.json({ detail: "Nessun evento associato." }, 404);

  const { data: event } = await supabase.from("events").select("*").eq("id", eventId).single();
  return c.json(event);
});

// PATCH /api/events/me
eventsRouter.patch("/me", async (c) => {
  const auth = await getAuth(c);
  if (!auth) return c.json({ detail: "Non autorizzato." }, 401);

  const body = await c.req.json();
  const supabase = getSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  const updates: any = {};
  if (body.spouse1_name !== undefined) updates.spouse1_name = body.spouse1_name;
  if (body.spouse2_name !== undefined) updates.spouse2_name = body.spouse2_name;
  if (body.enable_timer !== undefined) updates.enable_timer = body.enable_timer;
  if (body.start_time !== undefined) updates.start_time = body.start_time;
  if (body.end_time !== undefined) updates.end_time = body.end_time;

  const { data: event, error } = await supabase
    .from("events")
    .update(updates)
    .eq("id", auth.event_id)
    .select()
    .single();

  if (error) return c.json({ detail: error.message }, 500);
  return c.json(event);
});

// GET /api/events/me/invite
eventsRouter.get("/me/invite", async (c) => {
  const auth = await getAuth(c);
  if (!auth) return c.json({ detail: "Non autorizzato." }, 401);

  const supabase = getSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const { data: event } = await supabase.from("events").select("invite_code").eq("id", auth.event_id).single();
  return c.json({ invite_code: event?.invite_code });
});
