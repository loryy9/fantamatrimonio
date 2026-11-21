/** Blocco delle modifiche alle sfide una volta iniziata la partita. */
import type { Db, Row } from "./db";
import { ApiError } from "./errors";

export const GAME_STARTED_MESSAGE = "La partita è iniziata: le sfide non sono più modificabili.";

/** Partita iniziata: timer attivo e orario di inizio raggiunto, oppure esiste già una submission di un ospite. */
export function isGameStarted(
  event: { enable_timer: boolean; start_time: Date | null },
  hasGuestSubmission: boolean,
  now: Date,
): boolean {
  const timerStarted = !!(event.enable_timer && event.start_time && now.getTime() >= new Date(event.start_time).getTime());
  return timerStarted || hasGuestSubmission;
}

async function hasGuestSubmission(db: Db, eventId: string | number): Promise<boolean> {
  const row = await db.queryOne(
    `SELECT EXISTS (
       SELECT 1 FROM user_submissions s
       JOIN users u ON u.id = s.user_id
       JOIN challenges c ON c.id = s.challenge_id
       WHERE c.event_id = $1 AND u.role = 'guest'
     ) AS started`,
    [eventId],
  );
  return !!row?.started;
}

export async function loadGameStarted(db: Db, event: Row): Promise<boolean> {
  // Se il timer e' gia' scaduto non serve interrogare le submission.
  const now = new Date();
  if (isGameStarted(event as { enable_timer: boolean; start_time: Date | null }, false, now)) return true;
  return hasGuestSubmission(db, event.id);
}

/** Lancia 409 se la partita dell'evento e' iniziata. Da chiamare prima di qualsiasi scrittura. */
export async function assertChallengesEditable(db: Db, eventId: string): Promise<void> {
  const event = await db.queryOne("SELECT id, enable_timer, start_time FROM events WHERE id = $1", [eventId]);
  if (event && (await loadGameStarted(db, event))) throw new ApiError(409, GAME_STARTED_MESSAGE);
}

export const START_IN_FUTURE_MESSAGE =
  "La partita è già iniziata: l'orario di inizio non può essere spostato nel futuro.";

/**
 * A partita iniziata il timer resta modificabile (prolungare, chiudere, attivare o disattivare),
 * ma l'inizio non puo' tornare nel futuro: rimetterebbe in pausa una partita gia' in corso.
 */
export function startMovedToFuture(
  merged: { enable_timer: boolean; start_time: Date | null },
  gameStarted: boolean,
  now: Date,
): boolean {
  if (!gameStarted || !merged.enable_timer || !merged.start_time) return false;
  return new Date(merged.start_time).getTime() > now.getTime();
}
