import { describe, expect, it } from "vitest";
import { validateEventUpdate } from "../src/eventSettings";
import { ApiError } from "../src/errors";
import { GAME_STARTED_MESSAGE } from "../src/gameLock";

const start = new Date("2026-06-01T18:00:00Z");
const end = new Date("2026-06-01T23:30:00Z");
const event = { id: "1", spouse1_name: "Anna", spouse2_name: "Luca", enable_timer: true, start_time: start, end_time: end };

/** Stato HTTP dell'errore lanciato, o null se la modifica è ammessa. */
function statusOf(updates: Record<string, unknown>, gameStarted = false, ev: Record<string, unknown> = event) {
  try {
    validateEventUpdate(ev, updates, gameStarted);
    return null;
  } catch (err) {
    if (err instanceof ApiError) return err.status;
    throw err;
  }
}

describe("validateEventUpdate", () => {
  it("prima dell'inizio si può cambiare tutto", () => {
    expect(statusOf({ start_time: new Date("2026-06-01T19:00:00Z"), enable_timer: false, spouse1_name: "Anna Maria" })).toBeNull();
  });

  it("a partita iniziata inizio e timer sono bloccati (409)", () => {
    expect(statusOf({ start_time: new Date("2026-06-01T19:00:00Z") }, true)).toBe(409);
    expect(statusOf({ enable_timer: false }, true)).toBe(409);
    try {
      validateEventUpdate(event, { enable_timer: false }, true);
    } catch (err) {
      expect((err as ApiError).message).toBe(GAME_STARTED_MESSAGE);
    }
  });

  it("a partita iniziata fine e nomi restano modificabili", () => {
    expect(statusOf({ end_time: new Date("2026-06-02T01:00:00Z"), spouse2_name: "Luca B." }, true)).toBeNull();
  });

  it("la fine deve venire dopo l'inizio, anche confrontando con i valori salvati", () => {
    expect(statusOf({ end_time: start })).toBe(422);
    expect(statusOf({ start_time: new Date("2026-06-02T00:00:00Z") })).toBe(422);
  });

  it("con il timer spento l'ordine di inizio e fine non conta", () => {
    expect(statusOf({ end_time: start }, false, { ...event, enable_timer: false })).toBeNull();
  });

  it("nomi e timer non possono essere vuoti o nulli (422)", () => {
    expect(statusOf({ spouse1_name: null })).toBe(422);
    expect(statusOf({ spouse2_name: "   " })).toBe(422);
    expect(statusOf({ enable_timer: null })).toBe(422);
  });
});
