import { Hono } from "hono";
import { Env, getDb } from "../db";
import { verifyJwt } from "../auth";
import { publish } from "../realtime";

export const submissionsRouter = new Hono<{ Bindings: Env }>();

async function getUser(c: any) {
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const payload = await verifyJwt(token, c.env.JWT_SECRET || "default_jwt_secret");
  if (!payload || !payload.sub) return null;
  return await getDb(c.env).one("SELECT * FROM users WHERE id = $1", [payload.sub]);
}

// Stessa forma degli elementi di GET /gallery
function galleryPhoto(user: any, ch: any, sub: any) {
  const first = user.first_name || "";
  const last = user.last_name || "";
  return {
    id: String(sub.id),
    user_id: String(user.id),
    image_url: sub.image_url,
    photo_url: sub.image_url,
    created_at: sub.created_at,
    first_name: first,
    last_name: last,
    author: `${first} ${last}`.trim(),
    challenge_type: ch.type,
    challenge_title: ch.title,
  };
}

// Notifica i client del matrimonio senza ritardare la risposta HTTP
function notify(c: any, user: any, message: Parameters<typeof publish>[2]) {
  c.executionCtx.waitUntil(publish(c.env, user.event_id, message));
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

  const db = getDb(c.env);

  let photoChallenge = await db.one(
    `SELECT * FROM challenges
     WHERE type = 'photo' AND active = TRUE AND event_id = $1
     ORDER BY points DESC LIMIT 1`,
    [user.event_id]
  );

  if (!photoChallenge) {
    photoChallenge = await db.one(
      `INSERT INTO challenges (event_id, title, description, points, type, active)
       VALUES ($1, 'Galleria Foto', 'Condividi uno scatto del matrimonio', 10, 'photo', TRUE)
       RETURNING *`,
      [user.event_id]
    );
  }

  const ext = file.name.split(".").pop() || "jpg";
  const filename = `${crypto.randomUUID()}.${ext}`;
  const fileBuffer = await file.arrayBuffer();

  await c.env.PHOTOS_BUCKET.put(filename, fileBuffer, {
    httpMetadata: { contentType: file.type || "image/jpeg" },
  });

  const imageUrl = `${new URL(c.req.url).origin}/api/photos/${filename}`;

  const submission = await db.one(
    `INSERT INTO user_submissions (user_id, challenge_id, image_url)
     VALUES ($1, $2, $3) RETURNING id, image_url, created_at`,
    [user.id, photoChallenge.id, imageUrl]
  );

  notify(c, user, { type: "photo_added", topic: "gallery", photo: galleryPhoto(user, photoChallenge, submission) });
  if (awardPoints) notify(c, user, { type: "leaderboard_changed", topic: "leaderboard" });

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
  const db = getDb(c.env);

  const ch = await db.one(
    "SELECT * FROM challenges WHERE id = $1 AND event_id = $2 AND type = 'hunt' AND active = TRUE",
    [challengeId, user.event_id]
  );

  if (!ch) return c.json({ detail: "Sfida caccia fotografica non trovata o non attiva." }, 404);

  const alreadyDone = await db.one(
    "SELECT id FROM user_submissions WHERE user_id = $1 AND challenge_id = $2",
    [user.id, challengeId]
  );

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

  const submission = await db.one(
    `INSERT INTO user_submissions (user_id, challenge_id, image_url)
     VALUES ($1, $2, $3) RETURNING id, image_url, created_at`,
    [user.id, challengeId, imageUrl]
  );

  notify(c, user, { type: "photo_added", topic: "gallery", photo: galleryPhoto(user, ch, submission) });
  notify(c, user, { type: "leaderboard_changed", topic: "leaderboard" });

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
  const db = getDb(c.env);

  const ch = await db.one(
    "SELECT * FROM challenges WHERE id = $1 AND event_id = $2 AND type = 'vote' AND active = TRUE",
    [challengeId, user.event_id]
  );

  if (!ch) return c.json({ detail: "Sfida di voto non valida." }, 404);

  const body = await c.req.json();
  const chosenOpt = (body.text || body.answer || body.option || body.option_id || "").trim();
  if (!chosenOpt) return c.json({ detail: "Opzione non valida." }, 422);

  const existing = await db.one(
    "SELECT id FROM user_submissions WHERE user_id = $1 AND challenge_id = $2",
    [user.id, challengeId]
  );

  if (existing) {
    await db.all("UPDATE user_submissions SET answer_text = $1 WHERE id = $2", [chosenOpt, existing.id]);
    return c.json({ message: "Voto aggiornato!", option: chosenOpt, points_awarded: 0, status: "updated" });
  }

  await db.all(
    "INSERT INTO user_submissions (user_id, challenge_id, answer_text) VALUES ($1, $2, $3)",
    [user.id, challengeId, chosenOpt]
  );

  notify(c, user, { type: "leaderboard_changed", topic: "leaderboard" });

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
  const db = getDb(c.env);

  const ch = await db.one(
    "SELECT * FROM challenges WHERE id = $1 AND event_id = $2 AND type = 'quiz' AND active = TRUE",
    [challengeId, user.event_id]
  );

  if (!ch) return c.json({ detail: "Domanda quiz non valida." }, 404);

  const already = await db.one(
    "SELECT id FROM user_submissions WHERE user_id = $1 AND challenge_id = $2",
    [user.id, challengeId]
  );

  if (already) return c.json({ detail: "Hai già risposto a questa domanda." }, 409);

  const body = await c.req.json();
  const answer = (body.answer || "").trim();
  const isCorrect = answer.toLowerCase() === (ch.correct_answer || "").trim().toLowerCase();

  await db.all(
    "INSERT INTO user_submissions (user_id, challenge_id, answer_text) VALUES ($1, $2, $3)",
    [user.id, challengeId, answer]
  );

  notify(c, user, { type: "leaderboard_changed", topic: "leaderboard" });

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

  const photos = await getDb(c.env).all(
    `SELECT s.id, s.user_id, s.image_url, s.created_at,
            u.first_name, u.last_name, c.type AS challenge_type, c.title AS challenge_title
     FROM user_submissions s
     JOIN users u ON u.id = s.user_id
     JOIN challenges c ON c.id = s.challenge_id
     WHERE s.image_url IS NOT NULL AND c.event_id = $1
     ORDER BY s.created_at DESC`,
    [user.event_id]
  );

  return c.json(
    photos.map((p: any) => ({
      id: String(p.id),
      user_id: String(p.user_id),
      image_url: p.image_url,
      photo_url: p.image_url,
      created_at: p.created_at,
      first_name: p.first_name || "",
      last_name: p.last_name || "",
      author: `${p.first_name || ""} ${p.last_name || ""}`.trim(),
      challenge_type: p.challenge_type,
      challenge_title: p.challenge_title,
    }))
  );
});

// GET /api/submissions/mine
submissionsRouter.get("/mine", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ detail: "Non autorizzato." }, 401);

  const rows = await getDb(c.env).all(
    `SELECT s.id, s.challenge_id, s.image_url, s.answer_text, s.created_at,
            c.title, c.type, c.points, c.correct_answer
     FROM user_submissions s JOIN challenges c ON c.id = s.challenge_id
     WHERE s.user_id = $1
     ORDER BY s.created_at DESC`,
    [user.id]
  );

  return c.json(
    rows.map((r: any) => {
      const isQuiz = r.type === "quiz";
      const userAns = (r.answer_text || "").trim().toLowerCase();
      const corrAns = (r.correct_answer || "").trim().toLowerCase();
      const isCorrect = isQuiz ? userAns === corrAns : true;
      return {
        id: String(r.id),
        challenge_id: r.challenge_id,
        challenge_title: r.title,
        challenge_type: r.type,
        points: r.points,
        points_awarded: isCorrect ? r.points : 0,
        is_correct: isQuiz ? isCorrect : null,
        correct_answer: isQuiz ? r.correct_answer : null,
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
  const db = getDb(c.env);

  const sub = await db.one("SELECT * FROM user_submissions WHERE id = $1", [submissionId]);
  if (!sub) return c.json({ detail: "Foto non trovata." }, 404);
  if (String(sub.user_id) !== String(user.id)) return c.json({ detail: "Non autorizzato." }, 403);

  await db.all("DELETE FROM user_submissions WHERE id = $1", [submissionId]);

  if (sub.image_url) {
    const filename = sub.image_url.split("/").pop()?.split("?")[0];
    if (filename) {
      await c.env.PHOTOS_BUCKET.delete(filename);
    }
  }

  if (sub.image_url) notify(c, user, { type: "photo_removed", topic: "gallery", id: String(submissionId) });
  notify(c, user, { type: "leaderboard_changed", topic: "leaderboard" });

  return c.json({ success: true, deleted_id: submissionId });
});
