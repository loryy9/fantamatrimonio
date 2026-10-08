/**
 * Rotte per le submission degli utenti.
 * POST   /api/submissions/photo           -> upload foto gallery (type=photo)
 * POST   /api/submissions/photos          -> upload multiplo (max 10)
 * DELETE /api/submissions/photo/:id       -> elimina una propria foto
 * POST   /api/submissions/hunt/:id        -> foto missione caccia (type=hunt)
 * POST   /api/submissions/vote/:id        -> vota / testo libero (type=vote, upsert)
 * POST   /api/submissions/quiz/:id        -> risponde al quiz (type=quiz)
 * GET    /api/submissions/gallery         -> foto dell'evento
 * GET    /api/submissions/mine            -> submission dell'utente corrente
 */
import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import { requireUser } from "../auth";
import type { Db, Row } from "../db";
import type { AppEnv } from "../env";
import { ApiError } from "../errors";
import { deletePhoto, uploadPhoto } from "../storage";
import { capitalize, iso, intParam, parseJson, queryBool } from "../util";

const router = new Hono<AppEnv>();

// Dimensione massima di sicurezza: 50 MB (per non bloccare mai nessun utente)
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);

/**
 * Challenge fotografica dell'evento (nessuna cache: gli isolate dei Workers non condividono memoria,
 * quindi una cache locale resterebbe stale quando gli sposi modificano le sfide).
 */
async function getPhotoChallenge(db: Db, awardPoints: boolean, eventId: string): Promise<Row | null> {
  const preferred = await db.queryOne(
    `SELECT * FROM challenges WHERE type = 'photo' AND points ${awardPoints ? ">" : "="} 0 AND active = TRUE AND event_id = $1 ORDER BY id ASC LIMIT 1`,
    [eventId],
  );
  if (preferred) return preferred;
  return db.queryOne(
    "SELECT * FROM challenges WHERE type = 'photo' AND active = TRUE AND event_id = $1 ORDER BY id ASC LIMIT 1",
    [eventId],
  );
}

/** Recupera la challenge (limitata all'evento) e valida attiva/tipo. */
async function getActiveChallenge(db: Db, challengeId: number, expectedType: string, eventId: string): Promise<Row> {
  const ch = await db.queryOne("SELECT * FROM challenges WHERE id = $1 AND active = TRUE AND event_id = $2", [
    challengeId,
    eventId,
  ]);
  if (!ch) throw new ApiError(404, "Sfida non trovata o non attiva.");
  if (ch.type !== expectedType) {
    throw new ApiError(400, `Tipo di sfida non valido: atteso '${expectedType}', trovato '${ch.type}'.`);
  }
  return ch;
}

const missingFile = (field: string) =>
  new ApiError(422, [{ type: "missing", loc: ["body", field], msg: `Campo obbligatorio mancante: ${field}` }]);

/** Valida content-type e dimensione di un file caricato. */
async function readUpload(file: File): Promise<{ data: ArrayBuffer; type: string }> {
  if (!ALLOWED_CONTENT_TYPES.has(file.type)) {
    throw new ApiError(415, `Formato non supportato: ${file.type}. Usa JPEG, PNG o WebP.`);
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new ApiError(413, `File troppo grande. Dimensione massima: ${MAX_FILE_SIZE / (1024 * 1024)} MB.`);
  }
  return { data: await file.arrayBuffer(), type: file.type };
}

async function formFiles(c: Context<AppEnv>, field: string): Promise<File[]> {
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    throw missingFile(field);
  }
  return form.getAll(field).filter((v): v is File => typeof v !== "string");
}

// ── GALLERY (type=photo) ────────────────────────────────────────────────────

router.post("/photo", requireUser, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const awardPoints = queryBool(c, "award_points", true);

  const [file] = await formFiles(c, "file");
  if (!file) throw missingFile("file");

  const photoChallenge = await getPhotoChallenge(db, awardPoints, user.event_id);
  if (!photoChallenge) throw new ApiError(404, "Gallery non disponibile.");

  const upload = await readUpload(file);
  const url = await uploadPhoto(c.env.PHOTOS, c.get("cfg"), new URL(c.req.url).origin, upload.data, upload.type);

  const submission = await db.execute(
    "INSERT INTO user_submissions (user_id, challenge_id, image_url) VALUES ($1, $2, $3) RETURNING id, image_url, created_at",
    [user.id, photoChallenge.id, url],
  );

  return c.json({
    id: String(submission!.id),
    image_url: submission!.image_url,
    points_awarded: awardPoints ? photoChallenge.points : 0,
    user: { first_name: user.first_name, last_name: user.last_name },
  });
});

/** Piu' foto insieme (selezione multipla da smartphone); upload in parallelo su R2. */
router.post("/photos", requireUser, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const awardPoints = queryBool(c, "award_points", true);

  const files = await formFiles(c, "files");
  if (files.length === 0) throw new ApiError(400, "Nessun file selezionato.");
  if (files.length > 10) throw new ApiError(400, "Puoi caricare al massimo 10 foto alla volta.");

  const photoChallenge = await getPhotoChallenge(db, awardPoints, user.event_id);
  if (!photoChallenge) throw new ApiError(404, "Gallery non disponibile.");

  // 1. Legge e valida tutti i file
  const payloads: { data: ArrayBuffer; type: string }[] = [];
  for (const f of files) payloads.push(await readUpload(f));

  // 2. Upload parallelo
  const cfg = c.get("cfg");
  const origin = new URL(c.req.url).origin;
  const urls = await Promise.all(payloads.map((p) => uploadPhoto(c.env.PHOTOS, cfg, origin, p.data, p.type)));

  // 3. Insert nel DB (il trigger del database aggiorna i punti per ogni foto)
  const ptsPerPhoto = awardPoints ? photoChallenge.points : 0;
  const submissions: Row[] = [];
  for (const url of urls) {
    submissions.push(
      (await db.execute(
        "INSERT INTO user_submissions (user_id, challenge_id, image_url) VALUES ($1, $2, $3) RETURNING id, image_url, created_at",
        [user.id, photoChallenge.id, url],
      ))!,
    );
  }

  return c.json({
    count: submissions.length,
    points_per_photo: ptsPerPhoto,
    total_points_awarded: ptsPerPhoto * submissions.length,
    submissions: submissions.map((s) => ({ id: String(s.id), image_url: s.image_url, points_awarded: ptsPerPhoto })),
    user: { first_name: user.first_name, last_name: user.last_name },
  });
});

/** Elimina una foto (solo se caricata dall'utente corrente). Il trigger DB scala i punti. */
router.delete("/photo/:id", requireUser, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const submissionId = c.req.param("id");

  const sub = await db.queryOne("SELECT * FROM user_submissions WHERE id = $1", [submissionId]);
  if (!sub) throw new ApiError(404, "Foto non trovata.");
  if (String(sub.user_id) !== String(user.id)) throw new ApiError(403, "Non puoi eliminare le foto di altri utenti.");

  await db.execute("DELETE FROM user_submissions WHERE id = $1", [submissionId]);
  if (sub.image_url) await deletePhoto(c.env.PHOTOS, sub.image_url);

  return c.json({ success: true, deleted_id: submissionId });
});

// ── CACCIA FOTOGRAFICA (type=hunt) ──────────────────────────────────────────

/** Foto per una missione della caccia. Ogni missione si completa una sola volta per utente. */
router.post("/hunt/:challenge_id", requireUser, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const challengeId = intParam(c, "challenge_id");

  const [file] = await formFiles(c, "file");
  if (!file) throw missingFile("file");

  const challenge = await getActiveChallenge(db, challengeId, "hunt", user.event_id);

  const alreadyDone = await db.queryOne("SELECT id FROM user_submissions WHERE user_id = $1 AND challenge_id = $2", [
    user.id,
    challengeId,
  ]);
  if (alreadyDone) throw new ApiError(409, "Hai già completato questa missione!");

  const upload = await readUpload(file);
  const url = await uploadPhoto(c.env.PHOTOS, c.get("cfg"), new URL(c.req.url).origin, upload.data, upload.type);

  const submission = await db.execute(
    "INSERT INTO user_submissions (user_id, challenge_id, image_url) VALUES ($1, $2, $3) RETURNING id, image_url, created_at",
    [user.id, challengeId, url],
  );

  return c.json({
    id: String(submission!.id),
    image_url: submission!.image_url,
    points_awarded: challenge.points,
    message: "Missione completata! Punti assegnati.",
  });
});

// ── VOTO (type=vote) ────────────────────────────────────────────────────────

const VoteRequest = z.object({
  option: z.string().nullish(),
  option_id: z.string().nullish(),
  text: z.string().nullish(),
  answer: z.string().nullish(),
});

/** Vota un'opzione o invia testo libero. Sovrascrive il voto precedente (upsert). */
router.post("/vote/:challenge_id", requireUser, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const challengeId = intParam(c, "challenge_id");
  const { data: body } = await parseJson(c, VoteRequest);

  const chosen = (body.text || body.answer || body.option || body.option_id || "").trim();
  if (!chosen) throw new ApiError(422, "Inserisci una risposta valida prima di inviare.");

  const challenge = await getActiveChallenge(db, challengeId, "vote", user.event_id);

  const existing = await db.queryOne("SELECT id FROM user_submissions WHERE user_id = $1 AND challenge_id = $2", [
    user.id,
    challengeId,
  ]);

  if (existing) {
    await db.execute("UPDATE user_submissions SET answer_text = $1 WHERE id = $2", [chosen, existing.id]);
    return c.json({ message: "Momento aggiornato con successo!", option: chosen, points_awarded: 0, status: "updated" });
  }

  await db.execute("INSERT INTO user_submissions (user_id, challenge_id, answer_text) VALUES ($1, $2, $3)", [
    user.id,
    challengeId,
    chosen,
  ]);
  return c.json({
    message: `Salvato! Hai guadagnato ${challenge.points} punti! 🎉`,
    option: chosen,
    points_awarded: challenge.points,
    status: "created",
  });
});

// ── QUIZ (type=quiz) ────────────────────────────────────────────────────────

const QuizRequest = z.object({ answer: z.string() });

/** Risponde a una domanda del quiz. Una sola risposta per utente. */
router.post("/quiz/:challenge_id", requireUser, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const challengeId = intParam(c, "challenge_id");
  const { data: body } = await parseJson(c, QuizRequest);

  const challenge = await getActiveChallenge(db, challengeId, "quiz", user.event_id);

  const already = await db.queryOne("SELECT id FROM user_submissions WHERE user_id = $1 AND challenge_id = $2", [
    user.id,
    challengeId,
  ]);
  if (already) throw new ApiError(409, "Hai già risposto a questa domanda.");

  const isCorrect = body.answer.trim().toLowerCase() === (challenge.correct_answer || "").trim().toLowerCase();

  await db.execute("INSERT INTO user_submissions (user_id, challenge_id, answer_text) VALUES ($1, $2, $3)", [
    user.id,
    challengeId,
    body.answer.trim(),
  ]);

  return c.json({
    is_correct: isCorrect,
    correct: isCorrect,
    correct_answer: challenge.correct_answer ?? null,
    points_awarded: isCorrect ? challenge.points : 0,
    message: isCorrect ? "Risposta corretta! 🎉" : `Risposta sbagliata! Era la ${challenge.correct_answer}`,
  });
});

// ── GALLERY E SUBMISSION PERSONALI ──────────────────────────────────────────

/** Tutte le foto caricate nell'evento corrente con il nome dell'invitato. */
router.get("/gallery", requireUser, async (c) => {
  const photos = await c.get("db").query(
    `SELECT s.id, s.user_id, s.image_url, s.created_at, u.first_name, u.last_name,
            c.type AS challenge_type, c.title AS challenge_title
     FROM user_submissions s
     JOIN users u ON u.id = s.user_id
     JOIN challenges c ON c.id = s.challenge_id
     WHERE c.type IN ('photo', 'hunt') AND s.image_url IS NOT NULL AND c.event_id = $1
     ORDER BY s.created_at DESC`,
    [c.get("user").event_id],
  );
  return c.json(
    photos.map((p) => ({
      id: String(p.id),
      user_id: String(p.user_id),
      image_url: p.image_url,
      photo_url: p.image_url,
      created_at: iso(p.created_at),
      first_name: p.first_name,
      last_name: p.last_name,
      author: `${capitalize(p.first_name)} ${capitalize(p.last_name)}`,
      challenge_type: p.challenge_type,
      challenge_title: p.challenge_title,
    })),
  );
});

/** Tutte le submission dell'utente corrente con dettaglio challenge. */
router.get("/mine", requireUser, async (c) => {
  const rows = await c.get("db").query(
    `SELECT s.id, s.challenge_id, s.image_url, s.answer_text, s.created_at,
            c.title, c.type, c.points, c.correct_answer
     FROM user_submissions s
     JOIN challenges c ON c.id = s.challenge_id
     WHERE s.user_id = $1
     ORDER BY s.created_at DESC`,
    [c.get("user").id],
  );
  return c.json(
    rows.map((r) => {
      const isQuiz = r.type === "quiz";
      const isCorrect = isQuiz
        ? (r.answer_text || "").trim().toLowerCase() === (r.correct_answer || "").trim().toLowerCase()
        : true;
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
        created_at: iso(r.created_at),
      };
    }),
  );
});

export default router;
