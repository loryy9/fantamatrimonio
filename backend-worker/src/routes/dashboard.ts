import { Hono } from "hono";
import { Env, getDb } from "../db";
import { verifyJwt } from "../auth";

export const dashboardRouter = new Hono<{ Bindings: Env }>();

async function getAccount(c: any) {
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const payload = await verifyJwt(token, c.env.JWT_SECRET || "default_jwt_secret");
  if (!payload || !payload.sub || payload.type !== "account") return null;
  return await getDb(c.env).one("SELECT * FROM accounts WHERE id = $1", [payload.sub]);
}

// GET /api/dashboard/events
dashboardRouter.get("/events", async (c) => {
  const account = await getAccount(c);
  if (!account) return c.json({ detail: "Non autorizzato." }, 401);

  const usersWithEvents = await getDb(c.env).all(
    `SELECT u.id, u.role, u.total_points, u.first_name, u.last_name, u.event_id, to_jsonb(e) AS events
     FROM users u JOIN events e ON e.id = u.event_id
     WHERE u.account_id = $1
     ORDER BY u.created_at DESC`,
    [account.id]
  );

  return c.json(
    usersWithEvents.map((u: any) => ({
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
  const db = getDb(c.env);

  const event = await db.one("SELECT * FROM events WHERE id = $1", [eventId]);
  if (!event) return c.json({ detail: "Evento non trovato." }, 404);

  const participants = await db.all(
    `SELECT id, first_name, last_name, role, total_points FROM users
     WHERE event_id = $1 ORDER BY total_points DESC`,
    [eventId]
  );

  return c.json({
    event,
    participants: participants || [],
    photos: [],
    stats: {
      guests_count: participants.filter((p: any) => p.role === "guest").length,
      photos_count: 0,
    },
  });
});
