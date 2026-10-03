import { Hono } from "hono";
import { Env, getSupabase } from "../db";
import { verifyJwt } from "../auth";

export const challengesRouter = new Hono<{ Bindings: Env }>();

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

// GET /api/challenges
challengesRouter.get("/", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ detail: "Non autorizzato." }, 401);

  const supabase = getSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const isCouple = user.role === "couple";
  const includeInactive = c.req.query("include_inactive") === "true";

  let query = supabase.from("challenges").select("*").eq("event_id", user.event_id);
  if (!isCouple || !includeInactive) {
    query = query.eq("active", true);
  }
  const { data: challenges, error } = await query.order("type").order("id");
  if (error) return c.json({ detail: error.message }, 500);

  const { data: done } = await supabase
    .from("user_submissions")
    .select("challenge_id, answer_text")
    .eq("user_id", user.id);

  const doneMap = new Map((done || []).map((d: any) => [d.challenge_id, d]));

  const result = (challenges || []).map((ch: any) => {
    const rawOptions = ch.vote_options || [];
    const config =
      rawOptions.length > 0 && typeof rawOptions[0] === "string"
        ? { options: rawOptions.map((opt: string) => ({ id: opt, text: opt })) }
        : { options: rawOptions };

    const submission = doneMap.get(ch.id);
    const entry: any = {
      ...ch,
      id: Number(ch.id),
      challenge_type: ch.type,
      config,
      completed: !!submission,
    };

    if (submission) {
      entry.my_answer = submission.answer_text;
      if (ch.type === "quiz") {
        const userAns = (submission.answer_text || "").trim().toLowerCase();
        const corrAns = (ch.correct_answer || "").trim().toLowerCase();
        entry.is_correct = userAns === corrAns;
        entry.points_awarded = entry.is_correct ? ch.points : 0;
      } else if (ch.type === "vote") {
        entry.my_vote = submission.answer_text;
      }
    } else {
      if (ch.type === "quiz" && !isCouple) {
        delete entry.correct_answer;
      }
    }

    return entry;
  });

  return c.json(result);
});

// GET /api/challenges/:id
challengesRouter.get("/:id", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ detail: "Non autorizzato." }, 401);

  const supabase = getSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const challengeId = Number(c.req.param("id"));

  const { data: ch } = await supabase
    .from("challenges")
    .select("*")
    .eq("id", challengeId)
    .eq("event_id", user.event_id)
    .maybeSingle();

  if (!ch) return c.json({ detail: "Sfida non trovata." }, 404);
  return c.json(ch);
});

// POST /api/challenges
challengesRouter.post("/", async (c) => {
  const user = await getUser(c);
  if (!user || user.role !== "couple") return c.json({ detail: "Accesso consentito solo agli sposi." }, 403);

  const body = await c.req.json();
  const supabase = getSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  const { data: created, error } = await supabase
    .from("challenges")
    .insert({
      event_id: user.event_id,
      title: body.title,
      description: body.description || "",
      points: body.points || 0,
      type: body.type,
      active: body.active ?? true,
      correct_answer: body.correct_answer || null,
      vote_options: body.vote_options || null,
    })
    .select()
    .single();

  if (error) return c.json({ detail: error.message }, 500);
  return c.json(created);
});

// POST /api/challenges/bulk
challengesRouter.post("/bulk", async (c) => {
  const user = await getUser(c);
  if (!user || user.role !== "couple") return c.json({ detail: "Accesso consentito solo agli sposi." }, 403);

  const list = await c.req.json();
  const supabase = getSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  const rows = list.map((item: any) => ({
    event_id: user.event_id,
    title: item.title,
    description: item.description || "",
    points: item.points || 0,
    type: item.type,
    active: item.active ?? true,
    correct_answer: item.correct_answer || null,
    vote_options: item.vote_options || null,
  }));

  const { data: inserted, error } = await supabase.from("challenges").insert(rows).select();
  if (error) return c.json({ detail: error.message }, 500);

  return c.json({ count: inserted.length, challenges: inserted });
});

// PATCH /api/challenges/:id
challengesRouter.patch("/:id", async (c) => {
  const user = await getUser(c);
  if (!user || user.role !== "couple") return c.json({ detail: "Accesso consentito solo agli sposi." }, 403);

  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const supabase = getSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  const { data: updated, error } = await supabase
    .from("challenges")
    .update(body)
    .eq("id", id)
    .eq("event_id", user.event_id)
    .select()
    .single();

  if (error) return c.json({ detail: error.message }, 500);
  return c.json(updated);
});

// DELETE /api/challenges/:id
challengesRouter.delete("/:id", async (c) => {
  const user = await getUser(c);
  if (!user || user.role !== "couple") return c.json({ detail: "Accesso consentito solo agli sposi." }, 403);

  const id = Number(c.req.param("id"));
  const supabase = getSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  const { error } = await supabase.from("challenges").delete().eq("id", id).eq("event_id", user.event_id);
  if (error) return c.json({ detail: error.message }, 500);

  return c.json({ success: true, deleted_id: id });
});
