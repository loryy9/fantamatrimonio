/**
 * Rotte per le challenge (minigiochi).
 * GET    /api/challenges        -> lista challenge dell'evento con stato utente
 * GET    /api/challenges/:id    -> dettaglio singola challenge
 * POST   /api/challenges        -> crea (solo sposi)
 * POST   /api/challenges/bulk   -> crea piu' sfide in una transazione (solo sposi)
 * PATCH  /api/challenges/:id    -> modifica (solo sposi)
 * DELETE /api/challenges/:id    -> elimina (solo sposi)
 */
import { Hono } from "hono";
import { z } from "zod";
import { requireCouple, requireUser } from "../auth";
import type { Param, Row } from "../db";
import type { AppEnv } from "../env";
import { ApiError } from "../errors";
import { intParam, parseJson, queryBool, setFields } from "../util";

const router = new Hono<AppEnv>();

const CHALLENGE_TYPES = ["photo", "hunt", "vote", "quiz"];

const ChallengeRequest = z.object({
  title: z.string(),
  description: z.string(),
  points: z.number().int(),
  type: z.string(),
  active: z.boolean().default(true),
  correct_answer: z.string().nullish(),
  vote_options: z.array(z.string()).nullish(),
});

const ChallengeUpdateRequest = z.object({
  title: z.string().nullish(),
  description: z.string().nullish(),
  points: z.number().int().nullish(),
  active: z.boolean().nullish(),
  correct_answer: z.string().nullish(),
  vote_options: z.array(z.string()).nullish(),
});

const INSERT_CHALLENGE = `
  INSERT INTO challenges (event_id, title, description, points, type, active, correct_answer, vote_options)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text::jsonb)
  RETURNING *`;

const insertParams = (eventId: string, b: z.infer<typeof ChallengeRequest>): Param[] => [
  eventId,
  b.title,
  b.description,
  b.points,
  b.type,
  b.active,
  b.correct_answer ?? null,
  b.vote_options ? JSON.stringify(b.vote_options) : null,
];

/**
 * Tutte le challenge dell'evento corrente. Gli sposi con include_inactive=true vedono anche le disattivate
 * e non hanno mai la risposta corretta dei quiz nascosta.
 */
router.get("/", requireUser, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const isCouple = user.role === "couple";
  const includeInactive = queryBool(c, "include_inactive", false);

  const challenges = await db.query(
    "SELECT id, title, description, points, type, vote_options, active, correct_answer FROM challenges " +
      `WHERE ${isCouple && includeInactive ? "" : "active = TRUE AND "}event_id = $1 ORDER BY type, id`,
    [user.event_id],
  );

  const done = await db.query("SELECT challenge_id, answer_text FROM user_submissions WHERE user_id = $1", [user.id]);
  const doneMap = new Map<number, Row>(done.map((r) => [r.challenge_id, r]));

  return c.json(
    challenges.map((ch) => {
      const entry: Row = { ...ch };
      entry.id = Number(ch.id);
      entry.challenge_type = ch.type;
      entry.active = ch.active ?? true;
      const rawOptions: unknown[] = ch.vote_options || [];
      entry.config = {
        options:
          rawOptions.length && typeof rawOptions[0] === "string"
            ? rawOptions.map((opt) => ({ id: opt, text: opt }))
            : rawOptions,
      };

      const submission = doneMap.get(ch.id);
      entry.completed = submission !== undefined;

      if (submission) {
        entry.my_answer = submission.answer_text;
        if (ch.type === "quiz") {
          const userAns = (submission.answer_text || "").trim().toLowerCase();
          const corrAns = (ch.correct_answer || "").trim().toLowerCase();
          const isCorrect = userAns === corrAns;
          entry.is_correct = isCorrect;
          entry.correct_answer = ch.correct_answer;
          entry.points_awarded = isCorrect ? ch.points : 0;
        } else if (ch.type === "vote") {
          entry.my_vote = submission.answer_text;
        }
      } else if (ch.type === "quiz" && !isCouple) {
        delete entry.correct_answer;
      }
      return entry;
    }),
  );
});

/** Crea una serie di sfide in una singola transazione (onboarding / import preset). */
router.post("/bulk", requireCouple, async (c) => {
  const user = c.get("user");
  const { data: items } = await parseJson(c, z.array(ChallengeRequest));

  const created = await c.get("db").transaction(async (tx) => {
    const out: Row[] = [];
    for (const item of items) {
      if (!CHALLENGE_TYPES.includes(item.type)) throw new ApiError(422, `Tipo di sfida non valido: ${item.type}`);
      if (item.points < 0) throw new ApiError(422, "I punti non possono essere negativi.");
      out.push((await tx.execute(INSERT_CHALLENGE, insertParams(user.event_id, item)))!);
    }
    return out;
  });
  return c.json(created);
});

/** Dettaglio di una singola challenge, limitata all'evento corrente. */
router.get("/:challenge_id", requireUser, async (c) => {
  const id = intParam(c, "challenge_id");
  const challenge = await c
    .get("db")
    .queryOne(
      "SELECT id, title, description, points, type, vote_options FROM challenges WHERE id = $1 AND active = TRUE AND event_id = $2",
      [id, c.get("user").event_id],
    );
  if (!challenge) throw new ApiError(404, "Challenge non trovata.");
  return c.json(challenge);
});

router.post("/", requireCouple, async (c) => {
  const user = c.get("user");
  const { data: body } = await parseJson(c, ChallengeRequest);

  if (!CHALLENGE_TYPES.includes(body.type)) throw new ApiError(422, "Tipo di sfida non valido.");
  if (body.points < 0) throw new ApiError(422, "I punti non possono essere negativi.");

  return c.json(await c.get("db").execute(INSERT_CHALLENGE, insertParams(user.event_id, body)));
});

/** Modifica una challenge. 404 se non appartiene all'evento corrente. */
router.patch("/:challenge_id", requireCouple, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const id = intParam(c, "challenge_id");
  const { data, raw } = await parseJson(c, ChallengeUpdateRequest);

  const existing = await db.queryOne("SELECT * FROM challenges WHERE id = $1 AND event_id = $2", [id, user.event_id]);
  if (!existing) throw new ApiError(404, "Challenge non trovata.");

  const updates = setFields(data, raw, ["title", "description", "points", "active", "correct_answer", "vote_options"]);
  if (Object.keys(updates).length === 0) return c.json(existing);

  for (const field of ["title", "description", "active"]) {
    if (field in updates && updates[field] == null) {
      throw new ApiError(422, `Il campo '${field}' non può essere nullo.`);
    }
  }

  if ("points" in updates) {
    const pts = updates.points as number | null;
    if (pts == null || pts < 0) throw new ApiError(422, "I punti non possono essere negativi o nulli.");
    if (pts !== existing.points) {
      const hasSubmissions = await db.queryOne("SELECT id FROM user_submissions WHERE challenge_id = $1 LIMIT 1", [id]);
      if (hasSubmissions) {
        throw new ApiError(422, "Non puoi modificare i punti di una sfida a cui qualcuno ha già risposto.");
      }
    }
  }

  // I nomi colonna provengono dalla allowlist sopra: mai da input utente.
  const params: Param[] = [];
  const sets = Object.entries(updates).map(([col, val]) => {
    if (col === "vote_options") {
      params.push(val == null ? null : JSON.stringify(val));
      return `vote_options = $${params.length}::text::jsonb`;
    }
    params.push(val as Param);
    return `${col} = $${params.length}`;
  });
  params.push(id);

  const updated = await db.execute(`UPDATE challenges SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING *`, params);
  return c.json(updated);
});

/**
 * Elimina una challenge. Elimina prima le submission (con la challenge ancora presente,
 * cosi' il trigger update_user_points sottrae correttamente i punti), poi la challenge.
 */
router.delete("/:challenge_id", requireCouple, async (c) => {
  const id = intParam(c, "challenge_id");
  const user = c.get("user");
  const db = c.get("db");

  const existing = await db.queryOne("SELECT id FROM challenges WHERE id = $1 AND event_id = $2", [id, user.event_id]);
  if (!existing) throw new ApiError(404, "Challenge non trovata.");

  await db.transaction(async (tx) => {
    await tx.execute("DELETE FROM user_submissions WHERE challenge_id = $1", [id]);
    await tx.execute("DELETE FROM challenges WHERE id = $1", [id]);
  });

  return c.json({ success: true, deleted_id: id });
});

export default router;
