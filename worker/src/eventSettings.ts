/**
 * Modifica delle impostazioni di un matrimonio (nomi degli sposi e orario dei giochi).
 * Usata sia dalla partita (PATCH /events/me) sia dalla dashboard (PATCH /dashboard/events/:id):
 * le regole stanno solo qui.
 */
import type { Context } from "hono";
import { z } from "zod";
import type { Row } from "./db";
import type { AppEnv } from "./env";
import { ApiError } from "./errors";
import { GAME_STARTED_MESSAGE, loadGameStarted } from "./gameLock";
import { publish } from "./live/publish";
import { dateTime, parseJson, setFields } from "./util";

const UpdateEventRequest = z.object({
  spouse1_name: z.string().nullish(),
  spouse2_name: z.string().nullish(),
  enable_timer: z.boolean().nullish(),
  start_time: dateTime.nullish(),
  end_time: dateTime.nullish(),
});

const EDITABLE_FIELDS = ["spouse1_name", "spouse2_name", "enable_timer", "start_time", "end_time"] as const;
const NOT_NULL_FIELDS = ["spouse1_name", "spouse2_name", "enable_timer"] as const;

/** True se la modifica tocca i campi bloccati a partita iniziata (inizio e timer). */
export function touchesLockedFields(updates: Record<string, unknown>): boolean {
  return "start_time" in updates || "enable_timer" in updates;
}

/**
 * Regole della modifica. Lancia ApiError se non è ammessa.
 * A partita iniziata solo l'orario di inizio e il timer sono bloccati (fine e nomi restano modificabili).
 */
export function validateEventUpdate(event: Row, updates: Record<string, unknown>, gameStarted: boolean): void {
  if (touchesLockedFields(updates) && gameStarted) throw new ApiError(409, GAME_STARTED_MESSAGE);

  for (const field of NOT_NULL_FIELDS) {
    if (field in updates && updates[field] == null) {
      throw new ApiError(422, `Il campo '${field}' non può essere nullo.`);
    }
  }
  for (const field of ["spouse1_name", "spouse2_name"] as const) {
    if (field in updates && !String(updates[field]).trim()) {
      throw new ApiError(422, "Inserisci il nome di entrambi gli sposi.");
    }
  }

  const mergedTimer = "enable_timer" in updates ? updates.enable_timer : event.enable_timer;
  const mergedStart = ("start_time" in updates ? updates.start_time : event.start_time) as Date | null;
  const mergedEnd = ("end_time" in updates ? updates.end_time : event.end_time) as Date | null;
  if (mergedTimer && mergedStart && mergedEnd && new Date(mergedEnd).getTime() <= new Date(mergedStart).getTime()) {
    throw new ApiError(422, "L'orario di fine deve essere successivo a quello di inizio.");
  }
}

/** Legge il body, applica la modifica all'evento e avvisa i client live. Ritorna l'evento aggiornato. */
export async function updateEventSettings(c: Context<AppEnv>, eventId: string | number): Promise<Row> {
  const db = c.get("db");
  const { data, raw } = await parseJson(c, UpdateEventRequest);

  const event = await db.queryOne("SELECT * FROM events WHERE id = $1", [eventId]);
  if (!event) throw new ApiError(404, "Evento non trovato.");

  const updates = setFields(data, raw, EDITABLE_FIELDS);
  if (typeof updates.spouse1_name === "string") updates.spouse1_name = updates.spouse1_name.trim();
  if (typeof updates.spouse2_name === "string") updates.spouse2_name = updates.spouse2_name.trim();
  if (Object.keys(updates).length === 0) return event;

  // La query sulle submission serve solo se la modifica tocca i campi bloccabili
  const gameStarted = touchesLockedFields(updates) ? await loadGameStarted(db, event) : false;
  validateEventUpdate(event, updates, gameStarted);

  // I nomi colonna provengono dalla allowlist sopra: mai da input utente.
  const params: (string | boolean | Date | null)[] = [];
  const sets = Object.entries(updates).map(([col, val]) => {
    params.push(val as string | boolean | Date | null);
    return `${col} = $${params.length}`;
  });
  params.push(String(eventId));

  const updated = await db.execute(`UPDATE events SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING *`, params);
  publish(c, String(eventId), ["event"]);
  return updated!;
}
