/**
 * Dashboard: panoramica cross-evento per utenti registrati.
 * GET /api/dashboard/events                        -> eventi dell'account
 * GET /api/dashboard/events/:id                    -> dettaglio evento (galleria, partecipanti, statistiche)
 * GET /api/dashboard/events/:id/submissions        -> submission con privacy
 */
import { Hono } from "hono";
import { requireAccount } from "../auth";
import type { AppEnv } from "../env";
import { ApiError } from "../errors";
import { eventOut, userOut } from "../serializers";
import { iso } from "../util";

const router = new Hono<AppEnv>();

/** Tutti gli eventi a cui l'account ha partecipato (come ospite o sposo). */
router.get("/events", requireAccount, async (c) => {
  const events = await c.get("db").query(
    `SELECT e.*, u.role, u.total_points, u.first_name AS user_first_name,
            u.last_name AS user_last_name, u.id AS user_id,
            (SELECT COUNT(*) FROM users u2 WHERE u2.event_id = e.id AND u2.role = 'guest') AS guests_count,
            (SELECT COUNT(*) FROM user_submissions s
             JOIN challenges c ON c.id = s.challenge_id
             WHERE c.event_id = e.id AND s.image_url IS NOT NULL) AS photos_count
     FROM events e
     JOIN users u ON u.event_id = e.id AND u.account_id = $1
     ORDER BY e.created_at DESC`,
    [c.get("account").id],
  );

  return c.json(
    events.map((ev) => ({
      event: eventOut(ev),
      role: ev.role,
      total_points: ev.total_points,
      user_id: String(ev.user_id),
      user_name: `${ev.user_first_name} ${ev.user_last_name}`,
      guests_count: ev.guests_count,
      photos_count: ev.photos_count,
    })),
  );
});

/** Dettaglio di un evento: info, partecipanti, galleria, statistiche. */
router.get("/events/:event_id", requireAccount, async (c) => {
  const db = c.get("db");
  const eventId = c.req.param("event_id");

  const userInEvent = await db.queryOne("SELECT * FROM users WHERE event_id = $1 AND account_id = $2", [
    eventId,
    c.get("account").id,
  ]);
  if (!userInEvent) throw new ApiError(403, "Non fai parte di questo evento.");

  const event = await db.queryOne("SELECT * FROM events WHERE id = $1", [eventId]);
  if (!event) throw new ApiError(404, "Evento non trovato.");

  const participants = await db.query(
    "SELECT id, first_name, last_name, role, total_points FROM users WHERE event_id = $1 ORDER BY total_points DESC",
    [eventId],
  );

  const photos = await db.query(
    `SELECT s.id, s.image_url, s.created_at, s.answer_text AS caption,
            u.first_name, u.last_name, c.title AS challenge_title
     FROM user_submissions s
     JOIN users u ON u.id = s.user_id
     JOIN challenges c ON c.id = s.challenge_id
     WHERE c.event_id = $1 AND s.image_url IS NOT NULL
     ORDER BY s.created_at DESC`,
    [eventId],
  );

  const quiz = await db.queryOne(
    `SELECT COUNT(*) AS count FROM user_submissions s
     JOIN challenges c ON c.id = s.challenge_id
     WHERE c.event_id = $1 AND c.type = 'quiz'`,
    [eventId],
  );

  return c.json({
    event: eventOut(event),
    is_couple: userInEvent.role === "couple",
    my_user_id: String(userInEvent.id),
    participants: participants.map(userOut),
    photos: photos.map((p) => ({
      id: String(p.id),
      image_url: p.image_url,
      caption: p.caption ?? null,
      created_at: p.created_at ? iso(p.created_at) : null,
      author: `${p.first_name} ${p.last_name}`,
      challenge_title: p.challenge_title ?? null,
    })),
    stats: {
      guests_count: participants.filter((p) => p.role === "guest").length,
      photos_count: photos.length,
      quiz_count: quiz?.count ?? 0,
    },
  });
});

/**
 * Submission con privacy:
 * - sposi: vedono tutto
 * - ospiti: foto di tutti + solo le proprie risposte quiz/voto
 */
router.get("/events/:event_id/submissions", requireAccount, async (c) => {
  const db = c.get("db");
  const eventId = c.req.param("event_id");

  const userInEvent = await db.queryOne("SELECT * FROM users WHERE event_id = $1 AND account_id = $2", [
    eventId,
    c.get("account").id,
  ]);
  if (!userInEvent) throw new ApiError(403, "Non fai parte di questo evento.");

  const submissions =
    userInEvent.role === "couple"
      ? await db.query(
          `SELECT s.id, s.user_id, s.challenge_id, s.image_url, s.answer_text, s.created_at,
                  u.first_name, u.last_name,
                  c.title AS challenge_title, c.type AS challenge_type, c.correct_answer
           FROM user_submissions s
           JOIN users u ON u.id = s.user_id
           JOIN challenges c ON c.id = s.challenge_id
           WHERE c.event_id = $1
           ORDER BY s.created_at DESC`,
          [eventId],
        )
      : await db.query(
          `SELECT s.id, s.user_id, s.challenge_id, s.image_url, s.answer_text, s.created_at,
                  u.first_name, u.last_name,
                  c.title AS challenge_title, c.type AS challenge_type,
                  CASE WHEN s.user_id = $1 THEN c.correct_answer ELSE NULL END AS correct_answer
           FROM user_submissions s
           JOIN users u ON u.id = s.user_id
           JOIN challenges c ON c.id = s.challenge_id
           WHERE c.event_id = $2
             AND (s.image_url IS NOT NULL OR s.user_id = $1)
           ORDER BY s.created_at DESC`,
          [userInEvent.id, eventId],
        );

  return c.json(
    submissions.map((s) => ({
      id: String(s.id),
      user_id: String(s.user_id),
      challenge_id: s.challenge_id,
      image_url: s.image_url ?? null,
      answer_text: s.answer_text ?? null,
      created_at: s.created_at ? iso(s.created_at) : null,
      author: `${s.first_name} ${s.last_name}`,
      challenge_title: s.challenge_title ?? null,
      challenge_type: s.challenge_type ?? null,
      correct_answer: s.correct_answer ?? null,
    })),
  );
});

export default router;
