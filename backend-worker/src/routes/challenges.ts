import { Hono } from "hono";
import { Env, getDb } from "../db";
import { verifyJwt } from "../auth";

export const challengesRouter = new Hono<{ Bindings: Env }>();

async function getUser(c: any) {
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const payload = await verifyJwt(token, c.env.JWT_SECRET || "default_jwt_secret");
  if (!payload || !payload.sub) return null;
  return await getDb(c.env).one("SELECT * FROM users WHERE id = $1", [payload.sub]);
}

// GET /api/challenges
challengesRouter.get("/", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ detail: "Non autorizzato." }, 401);

  const db = getDb(c.env);
  const isCouple = user.role === "couple";
  const includeInactive = c.req.query("include_inactive") === "true";

  const onlyActive = !isCouple || !includeInactive;
  const challenges = await db.all(
    `SELECT * FROM challenges
     WHERE event_id = $1 ${onlyActive ? "AND active = TRUE" : ""}
     ORDER BY type, id`,
    [user.event_id]
  );

  const done = await db.all(
    "SELECT challenge_id, answer_text FROM user_submissions WHERE user_id = $1",
    [user.id]
  );

  const doneMap = new Map(done.map((d: any) => [d.challenge_id, d]));

  const result = challenges.map((ch: any) => {
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

  const challengeId = Number(c.req.param("id"));

  const ch = await getDb(c.env).one(
    "SELECT * FROM challenges WHERE id = $1 AND event_id = $2",
    [challengeId, user.event_id]
  );

  if (!ch) return c.json({ detail: "Sfida non trovata." }, 404);
  return c.json(ch);
});

// POST /api/challenges
challengesRouter.post("/", async (c) => {
  const user = await getUser(c);
  if (!user || user.role !== "couple") return c.json({ detail: "Accesso consentito solo agli sposi." }, 403);

  const body = await c.req.json();

  const created = await getDb(c.env).one(
    `INSERT INTO challenges (event_id, title, description, points, type, active, correct_answer, vote_options)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb) RETURNING *`,
    [
      user.event_id,
      body.title,
      body.description || "",
      body.points || 0,
      body.type,
      body.active ?? true,
      body.correct_answer || null,
      body.vote_options ? JSON.stringify(body.vote_options) : null,
    ]
  );
  return c.json(created);
});

// POST /api/challenges/bulk
challengesRouter.post("/bulk", async (c) => {
  const user = await getUser(c);
  if (!user || user.role !== "couple") return c.json({ detail: "Accesso consentito solo agli sposi." }, 403);

  const list = await c.req.json();

  if (!Array.isArray(list) || list.length === 0) {
    return c.json({ count: 0, challenges: [] });
  }

  const params: any[] = [];
  const tuples = list.map((item: any) => {
    params.push(
      user.event_id,
      item.title,
      item.description || "",
      item.points || 0,
      item.type,
      item.active ?? true,
      item.correct_answer || null,
      item.vote_options ? JSON.stringify(item.vote_options) : null
    );
    const n = params.length;
    return `($${n - 7}, $${n - 6}, $${n - 5}, $${n - 4}, $${n - 3}, $${n - 2}, $${n - 1}, $${n}::jsonb)`;
  });

  const inserted = await getDb(c.env).all(
    `INSERT INTO challenges (event_id, title, description, points, type, active, correct_answer, vote_options)
     VALUES ${tuples.join(", ")} RETURNING *`,
    params
  );

  return c.json({ count: inserted.length, challenges: inserted });
});

// PATCH /api/challenges/:id
challengesRouter.patch("/:id", async (c) => {
  const user = await getUser(c);
  if (!user || user.role !== "couple") return c.json({ detail: "Accesso consentito solo agli sposi." }, 403);

  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const db = getDb(c.env);

  const allowed = ["title", "description", "points", "type", "active", "correct_answer", "vote_options"];
  const columns = allowed.filter((col) => body[col] !== undefined);
  if (columns.length === 0) return c.json({ detail: "Nessun campo da aggiornare." }, 400);

  // I nomi delle colonne arrivano solo dalla whitelist sopra, mai dall'input.
  const setClause = columns.map((col, i) => `${col} = $${i + 1}${col === "vote_options" ? "::jsonb" : ""}`).join(", ");
  const values = columns.map((col) =>
    col === "vote_options" && body[col] !== null ? JSON.stringify(body[col]) : body[col]
  );

  const updated = await db.one(
    `UPDATE challenges SET ${setClause} WHERE id = $${columns.length + 1} AND event_id = $${columns.length + 2} RETURNING *`,
    [...values, id, user.event_id]
  );
  if (!updated) return c.json({ detail: "Sfida non trovata." }, 404);
  return c.json(updated);
});

// DELETE /api/challenges/:id
challengesRouter.delete("/:id", async (c) => {
  const user = await getUser(c);
  if (!user || user.role !== "couple") return c.json({ detail: "Accesso consentito solo agli sposi." }, 403);

  const id = Number(c.req.param("id"));

  await getDb(c.env).all("DELETE FROM challenges WHERE id = $1 AND event_id = $2", [id, user.event_id]);

  return c.json({ success: true, deleted_id: id });
});
