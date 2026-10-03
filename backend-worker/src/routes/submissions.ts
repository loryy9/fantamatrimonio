import { Hono } from "hono";
import { Env, getSupabase } from "../db";
import { verifyJwt } from "../auth";

export const submissionsRouter = new Hono<{ Bindings: Env }>();

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

// POST /api/submissions/photo
submissionsRouter.post("/photo", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ detail: "Non autorizzato." }, 401);

  const awardPoints = c.req.query("award_points") !== "false";
  const body = await c.req.parseBody();
  const file = body["file"];

  if (!file || !(file instanceof File)) {
    return c.json({ detail: "Nessun file fornito o non valido." }, 400);
  }

  const supabase = getSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  let { data: photoChallenge } = await supabase
    .from("challenges")
    .select("*")
    .eq("type", "photo")
    .eq("active", true)
    .eq("event_id", user.event_id)
    .order("points", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!photoChallenge) {
    const { data: created } = await supabase
      .from("challenges")
      .insert({
        event_id: user.event_id,
        title: "Galleria Foto",
        description: "Condividi uno scatto del matrimonio",
        points: 10,
        type: "photo",
        active: true,
      })
      .select()
      .single();
    photoChallenge = created;
  }

  const ext = file.name.split(".").pop() || "jpg";
  const filename = `${crypto.randomUUID()}.${ext}`;
  const fileBuffer = await file.arrayBuffer();

  await c.env.PHOTOS_BUCKET.put(filename, fileBuffer, {
    httpMetadata: { contentType: file.type || "image/jpeg" },
  });

  const imageUrl = `${new URL(c.req.url).origin}/api/photos/${filename}`;

  const { data: submission, error } = await supabase
    .from("user_submissions")
    .insert({
      user_id: user.id,
      challenge_id: photoChallenge.id,
      image_url: imageUrl,
    })
    .select("id, image_url, created_at")
    .single();

  if (error) return c.json({ detail: error.message }, 500);

  return c.json({
    id: String(submission.id),
    image_url: submission.image_url,
    points_awarded: awardPoints ? photoChallenge.points : 0,
    user: {
      first_name: user.first_name,
      last_name: user.last_name,
    },
  });
});

// POST /api/submissions/hunt/:id
submissionsRouter.post("/hunt/:challengeId", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ detail: "Non autorizzato." }, 401);

  const challengeId = Number(c.req.param("challengeId"));
  const supabase = getSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  const { data: ch } = await supabase
    .from("challenges")
    .select("*")
    .eq("id", challengeId)
    .eq("event_id", user.event_id)
    .eq("type", "hunt")
    .eq("active", true)
    .maybeSingle();

  if (!ch) return c.json({ detail: "Sfida caccia fotografica non trovata o non attiva." }, 404);

  const { data: alreadyDone } = await supabase
    .from("user_submissions")
    .select("id")
    .eq("user_id", user.id)
    .eq("challenge_id", challengeId)
    .maybeSingle();

  if (alreadyDone) return c.json({ detail: "Hai già completato questa missione!" }, 409);

  const body = await c.req.parseBody();
  const file = body["file"];
  if (!file || !(file instanceof File)) return c.json({ detail: "File mancante." }, 400);

  const ext = file.name.split(".").pop() || "jpg";
  const filename = `${crypto.randomUUID()}.${ext}`;
  const fileBuffer = await file.arrayBuffer();

  await c.env.PHOTOS_BUCKET.put(filename, fileBuffer, {
    httpMetadata: { contentType: file.type || "image/jpeg" },
  });

  const imageUrl = `${new URL(c.req.url).origin}/api/photos/${filename}`;

  const { data: submission, error } = await supabase
    .from("user_submissions")
    .insert({
      user_id: user.id,
      challenge_id: challengeId,
      image_url: imageUrl,
    })
    .select("id, image_url, created_at")
    .single();

  if (error) return c.json({ detail: error.message }, 500);

  return c.json({
    id: String(submission.id),
    image_url: submission.image_url,
    points_awarded: ch.points,
    message: "Missione completata! Punti assegnati.",
  });
});

// POST /api/submissions/vote/:id
submissionsRouter.post("/vote/:challengeId", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ detail: "Non autorizzato." }, 401);

  const challengeId = Number(c.req.param("challengeId"));
  const supabase = getSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  const { data: ch } = await supabase
    .from("challenges")
    .select("*")
    .eq("id", challengeId)
    .eq("event_id", user.event_id)
    .eq("type", "vote")
    .eq("active", true)
    .maybeSingle();

  if (!ch) return c.json({ detail: "Sfida di voto non valida." }, 404);

  const body = await c.req.json();
  const chosenOpt = (body.text || body.answer || body.option || body.option_id || "").trim();
  if (!chosenOpt) return c.json({ detail: "Opzione non valida." }, 422);

  const { data: existing } = await supabase
    .from("user_submissions")
    .select("id")
    .eq("user_id", user.id)
    .eq("challenge_id", challengeId)
    .maybeSingle();

  if (existing) {
    await supabase.from("user_submissions").update({ answer_text: chosenOpt }).eq("id", existing.id);
    return c.json({ message: "Voto aggiornato!", option: chosenOpt, points_awarded: 0, status: "updated" });
  }

  await supabase.from("user_submissions").insert({
    user_id: user.id,
    challenge_id: challengeId,
    answer_text: chosenOpt,
  });

  return c.json({
    message: `Salvato! Hai guadagnato ${ch.points} punti! 🎉`,
    option: chosenOpt,
    points_awarded: ch.points,
    status: "created",
  });
});

// POST /api/submissions/quiz/:id
submissionsRouter.post("/quiz/:challengeId", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ detail: "Non autorizzato." }, 401);

  const challengeId = Number(c.req.param("challengeId"));
  const supabase = getSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  const { data: ch } = await supabase
    .from("challenges")
    .select("*")
    .eq("id", challengeId)
    .eq("event_id", user.event_id)
    .eq("type", "quiz")
    .eq("active", true)
    .maybeSingle();

  if (!ch) return c.json({ detail: "Domanda quiz non valida." }, 404);

  const { data: already } = await supabase
    .from("user_submissions")
    .select("id")
    .eq("user_id", user.id)
    .eq("challenge_id", challengeId)
    .maybeSingle();

  if (already) return c.json({ detail: "Hai già risposto a questa domanda." }, 409);

  const body = await c.req.json();
  const answer = (body.answer || "").trim();
  const isCorrect = answer.toLowerCase() === (ch.correct_answer || "").trim().toLowerCase();

  await supabase.from("user_submissions").insert({
    user_id: user.id,
    challenge_id: challengeId,
    answer_text: answer,
  });

  return c.json({
    is_correct: isCorrect,
    correct: isCorrect,
    correct_answer: ch.correct_answer,
    points_awarded: isCorrect ? ch.points : 0,
    message: isCorrect ? "Risposta corretta! 🎉" : `Risposta errata! Era: ${ch.correct_answer}`,
  });
});

// GET /api/submissions/gallery
submissionsRouter.get("/gallery", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ detail: "Non autorizzato." }, 401);

  const supabase = getSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  const { data: photos, error } = await supabase
    .from("user_submissions")
    .select(`
      id,
      user_id,
      image_url,
      created_at,
      users:user_id (first_name, last_name),
      challenges:challenge_id (type, title, event_id)
    `)
    .not("image_url", "is", null)
    .eq("challenges.event_id", user.event_id)
    .order("created_at", { ascending: false });

  if (error) return c.json({ detail: error.message }, 500);

  const filtered = (photos || []).filter((p: any) => p.challenges && p.challenges.event_id === user.event_id);

  return c.json(
    filtered.map((p: any) => ({
      id: String(p.id),
      user_id: String(p.user_id),
      image_url: p.image_url,
      photo_url: p.image_url,
      created_at: p.created_at,
      first_name: p.users?.first_name || "",
      last_name: p.users?.last_name || "",
      author: `${p.users?.first_name || ""} ${p.users?.last_name || ""}`.trim(),
      challenge_type: p.challenges?.type,
      challenge_title: p.challenges?.title,
    }))
  );
});

// GET /api/submissions/mine
submissionsRouter.get("/mine", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ detail: "Non autorizzato." }, 401);

  const supabase = getSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  const { data: rows, error } = await supabase
    .from("user_submissions")
    .select(`
      id,
      challenge_id,
      image_url,
      answer_text,
      created_at,
      challenges:challenge_id (title, type, points, correct_answer)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return c.json({ detail: error.message }, 500);

  return c.json(
    (rows || []).map((r: any) => {
      const isQuiz = r.challenges?.type === "quiz";
      const userAns = (r.answer_text || "").trim().toLowerCase();
      const corrAns = (r.challenges?.correct_answer || "").trim().toLowerCase();
      const isCorrect = isQuiz ? userAns === corrAns : true;
      return {
        id: String(r.id),
        challenge_id: r.challenge_id,
        challenge_title: r.challenges?.title,
        challenge_type: r.challenges?.type,
        points: r.challenges?.points,
        points_awarded: isCorrect ? r.challenges?.points : 0,
        is_correct: isQuiz ? isCorrect : null,
        correct_answer: isQuiz ? r.challenges?.correct_answer : null,
        image_url: r.image_url,
        answer_text: r.answer_text,
        created_at: r.created_at,
      };
    })
  );
});

// DELETE /api/submissions/photo/:id
submissionsRouter.delete("/photo/:id", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ detail: "Non autorizzato." }, 401);

  const submissionId = c.req.param("id");
  const supabase = getSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  const { data: sub } = await supabase.from("user_submissions").select("*").eq("id", submissionId).maybeSingle();
  if (!sub) return c.json({ detail: "Foto non trovata." }, 404);
  if (String(sub.user_id) !== String(user.id)) return c.json({ detail: "Non autorizzato." }, 403);

  await supabase.from("user_submissions").delete().eq("id", submissionId);

  if (sub.image_url) {
    const filename = sub.image_url.split("/").pop()?.split("?")[0];
    if (filename) {
      await c.env.PHOTOS_BUCKET.delete(filename);
    }
  }

  return c.json({ success: true, deleted_id: submissionId });
});
