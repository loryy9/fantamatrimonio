/**
 * Rotte per la classifica.
 * GET /api/leaderboard           -> classifica dell'evento corrente
 * GET /api/leaderboard/:user_id  -> dettaglio punti per utente (stesso evento)
 */
import { Hono } from "hono";
import { requireUser } from "../auth";
import type { AppEnv } from "../env";
import { ApiError } from "../errors";
import { capitalize, iso } from "../util";

const router = new Hono<AppEnv>();

/** Classifica ordinata per punti decrescenti. Richiede autenticazione: mai dati tra eventi diversi. */
router.get("/", requireUser, async (c) => {
  const users = await c.get("db").query(
    `SELECT id, first_name, last_name, total_points FROM users
     WHERE event_id = $1 AND role = 'guest'
     ORDER BY total_points DESC, first_name ASC`,
    [c.get("user").event_id],
  );
  return c.json(
    users.map((u, idx) => ({
      rank: idx + 1,
      id: String(u.id),
      first_name: capitalize(u.first_name),
      last_name: capitalize(u.last_name),
      name: `${capitalize(u.first_name)} ${capitalize(u.last_name)}`,
      total_points: u.total_points,
    })),
  );
});

/** Dettaglio punti di un utente dello stesso evento (404 se non esiste o e' di un altro evento). */
router.get("/:user_id", requireUser, async (c) => {
  const db = c.get("db");
  const userId = c.req.param("user_id");

  const user = await db.queryOne(
    "SELECT id, first_name, last_name, total_points FROM users WHERE id = $1 AND event_id = $2",
    [userId, c.get("user").event_id],
  );
  if (!user) throw new ApiError(404, "Utente non trovato.");

  const breakdown = await db.query(
    `SELECT s.id, c.type, c.title, c.points, s.answer_text, s.image_url, s.created_at
     FROM user_submissions s
     JOIN challenges c ON c.id = s.challenge_id
     WHERE s.user_id = $1
     ORDER BY s.created_at DESC`,
    [userId],
  );

  const pointsByType: Record<string, number> = {};
  for (const row of breakdown) pointsByType[row.type] = (pointsByType[row.type] ?? 0) + row.points;

  const first = capitalize(user.first_name);
  const last = capitalize(user.last_name);
  return c.json({
    id: String(user.id),
    user: { id: String(user.id), first_name: first, last_name: last, total_points: user.total_points },
    first_name: first,
    last_name: last,
    name: `${first} ${last}`,
    total_points: user.total_points,
    points_by_type: pointsByType,
    submissions: breakdown.map((r) => ({
      id: String(r.id),
      challenge_title: r.title,
      challenge_type: r.type,
      points: r.points,
      points_awarded: r.points,
      answer_text: r.answer_text,
      image_url: r.image_url,
      created_at: iso(r.created_at),
    })),
  });
});

export default router;
