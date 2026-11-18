import { describe, expect, it } from "vitest";
import { isGameStarted } from "../src/gameLock";

const start = new Date("2026-06-01T10:00:00Z");
const end = new Date("2026-06-01T20:00:00Z");

describe("isGameStarted", () => {
  it("timer attivo, prima dell'inizio, nessuna submission: false", () => {
    expect(isGameStarted({ enable_timer: true, start_time: start }, false, new Date("2026-06-01T09:59:59Z"))).toBe(false);
  });
  it("timer attivo, now = start_time: true", () => {
    expect(isGameStarted({ enable_timer: true, start_time: start }, false, start)).toBe(true);
  });
  it("timer attivo, dopo la fine: true", () => {
    expect(isGameStarted({ enable_timer: true, start_time: start }, false, new Date(end.getTime() + 1000))).toBe(true);
  });
  it("timer attivo senza start_time ma con submission ospite: true", () => {
    expect(isGameStarted({ enable_timer: true, start_time: null }, true, start)).toBe(true);
  });
  it("timer disattivo: false senza submission, true con submission", () => {
    expect(isGameStarted({ enable_timer: false, start_time: start }, false, end)).toBe(false);
    expect(isGameStarted({ enable_timer: false, start_time: start }, true, end)).toBe(true);
  });
});
