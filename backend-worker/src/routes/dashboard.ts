import { Hono } from "hono";
import { Env, getSupabase } from "../db";
import { verifyJwt } from "../auth";

export const dashboardRouter = new Hono<{ Bindings: Env }>();

async function getAccount(c: any) {
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const payload = await verifyJwt(token, c.env.JWT_SECRET || "default_jwt_secret");
  if (!payload || !payload.sub || payload.type !== "account") return null;
  const supabase = getSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const { data: account } = await supabase.from("accounts").select("*").eq("id", payload.sub).single();
  return account;
}

// GET /api/dashboard/events
dashboardRouter.get("/events", async (c) => {
  const account = await getAccount(c);
  if (!account) return c.json({ detail: "Non autorizzato." }, 401);

  const supabase = getSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  const { data: usersWithEvents, error } = await supabase
    .from("users")
    .select(`
      id,
      role,
      total_points,
      first_name,
      last_name,
      event_id,
      events:event_id (*)
    `)
    .eq("account_id", account.id)
    .order("created_at", { ascending: false });

  if (error) return c.json({ detail: error.message }, 500);

  return c.json(
    (usersWithEvents || []).map((u: any) => ({
      event: u.events,
      role: u.role,
      total_points: u.total_points,
      user_id: String(u.id),
      user_name: `${u.first_name} ${u.last_name}`,
      guests_count: 0,
      photos_count: 0,
    }))
  );
});

// GET /api/dashboard/events/:eventId
dashboardRouter.get("/events/:eventId", async (c) => {
  const account = await getAccount(c);
  if (!account) return c.json({ detail: "Non autorizzato." }, 401);

  const eventId = c.req.param("eventId");
  const supabase = getSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  const { data: event } = await supabase.from("events").select("*").eq("id", eventId).single();
  if (!event) return c.json({ detail: "Evento non trovato." }, 404);

  const { data: participants } = await supabase
    .from("users")
    .select("id, first_name, last_name, role, total_points")
    .eq("event_id", eventId)
    .order("total_points", { ascending: false });

  return c.json({
    event,
    participants: participants || [],
    photos: [],
    stats: {
      guests_count: (participants || []).filter((p: any) => p.role === "guest").length,
      photos_count: 0,
    },
  });
});
