import { Hono } from "hono";
import { Env, getSupabase } from "../db";
import { verifyJwt } from "../auth";

export const leaderboardRouter = new Hono<{ Bindings: Env }>();

async function getUser(c: any) {
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const payload = await verifyJwt(token, c.env.JWT_SECRET || "default_jwt_secret");
  if (!payload || !payload.sub) return null;
  const supabase = getSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const { data: user } = await supabase.from("users").select("*").eq("id", payload.sub).single();
  return user;
}

// GET /api/leaderboard
leaderboardRouter.get("/", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ detail: "Non autorizzato." }, 401);

  const supabase = getSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const { data: users, error } = await supabase
    .from("users")
    .select("id, first_name, last_name, total_points")
    .eq("event_id", user.event_id)
    .eq("role", "guest")
    .order("total_points", { ascending: false })
    .order("first_name", { ascending: true });

  if (error) return c.json({ detail: error.message }, 500);

  return c.json(
    (users || []).map((u: any, idx: number) => ({
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
  const supabase = getSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  const { data: targetUser } = await supabase
    .from("users")
    .select("id, first_name, last_name, total_points")
    .eq("id", targetId)
    .eq("event_id", user.event_id)
    .maybeSingle();

  if (!targetUser) return c.json({ detail: "Utente non trovato." }, 404);

  const { data: breakdown } = await supabase
    .from("user_submissions")
    .select(`
      id,
      answer_text,
      image_url,
      created_at,
      challenges:challenge_id (title, type, points)
    `)
    .eq("user_id", targetId)
    .order("created_at", { ascending: false });

  const pointsByType: Record<string, number> = {};
  for (const row of breakdown || []) {
    const t = (row.challenges as any)?.type || "other";
    const pts = (row.challenges as any)?.points || 0;
    pointsByType[t] = (pointsByType[t] || 0) + pts;
  }

  return c.json({
    id: String(targetUser.id),
    first_name: targetUser.first_name,
    last_name: targetUser.last_name,
    name: `${targetUser.first_name} ${targetUser.last_name}`,
    total_points: targetUser.total_points || 0,
    points_by_type: pointsByType,
    submissions: (breakdown || []).map((r: any) => ({
      id: String(r.id),
      challenge_title: (r.challenges as any)?.title,
      challenge_type: (r.challenges as any)?.type,
      points: (r.challenges as any)?.points || 0,
      points_awarded: (r.challenges as any)?.points || 0,
      answer_text: r.answer_text,
      image_url: r.image_url,
      created_at: r.created_at,
    })),
  });
});
