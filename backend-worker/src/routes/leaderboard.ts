import { Hono } from "hono";
import { Env, getDb } from "../db";
import { verifyJwt } from "../auth";

export const leaderboardRouter = new Hono<{ Bindings: Env }>();

async function getUser(c: any) {
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const payload = await verifyJwt(token, c.env.JWT_SECRET || "default_jwt_secret");
  if (!payload || !payload.sub) return null;
  return await getDb(c.env).one("SELECT * FROM users WHERE id = $1", [payload.sub]);
}

// GET /api/leaderboard
leaderboardRouter.get("/", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ detail: "Non autorizzato." }, 401);

  const users = await getDb(c.env).all(
    `SELECT id, first_name, last_name, total_points FROM users
     WHERE event_id = $1 AND role = 'guest'
     ORDER BY total_points DESC, first_name ASC`,
    [user.event_id]
  );

  return c.json(
    users.map((u: any, idx: number) => ({
      rank: idx + 1,
      id: String(u.id),
      first_name: u.first_name,
      last_name: u.last_name,
      name: `${u.first_name} ${u.last_name}`,
      total_points: u.total_points || 0,
    }))
  );
});

// GET /api/leaderboard/:userId
leaderboardRouter.get("/:userId", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ detail: "Non autorizzato." }, 401);

  const targetId = c.req.param("userId");
  const db = getDb(c.env);

  const targetUser = await db.one(
    "SELECT id, first_name, last_name, total_points FROM users WHERE id = $1 AND event_id = $2",
    [targetId, user.event_id]
  );

  if (!targetUser) return c.json({ detail: "Utente non trovato." }, 404);

  const breakdown = await db.all(
    `SELECT s.id, s.answer_text, s.image_url, s.created_at, c.title, c.type, c.points
     FROM user_submissions s JOIN challenges c ON c.id = s.challenge_id
     WHERE s.user_id = $1
     ORDER BY s.created_at DESC`,
    [targetId]
  );

  const pointsByType: Record<string, number> = {};
  for (const row of breakdown) {
    const t = row.type || "other";
    const pts = row.points || 0;
    pointsByType[t] = (pointsByType[t] || 0) + pts;
  }

  return c.json({
    id: String(targetUser.id),
    first_name: targetUser.first_name,
    last_name: targetUser.last_name,
    name: `${targetUser.first_name} ${targetUser.last_name}`,
    total_points: targetUser.total_points || 0,
    points_by_type: pointsByType,
    submissions: breakdown.map((r: any) => ({
      id: String(r.id),
      challenge_title: r.title,
      challenge_type: r.type,
      points: r.points || 0,
      points_awarded: r.points || 0,
      answer_text: r.answer_text,
      image_url: r.image_url,
      created_at: r.created_at,
    })),
  });
});
