import { describe, it, expect } from 'vitest';
import { computeGains, interimOrder } from './leaderboardDiff.js';

describe('computeGains', () => {
  it('primo caricamento (null o vuoto): mappa vuota', () => {
    expect(computeGains(null, [{ id: 'a', total_points: 10 }]).size).toBe(0);
    expect(computeGains([], [{ id: 'a', total_points: 10 }]).size).toBe(0);
  });

  it('restituisce la differenza per chi ha guadagnato punti', () => {
    const prev = [{ id: 'a', total_points: 10 }, { id: 'b', total_points: 5 }];
    const next = [{ id: 'a', total_points: 10 }, { id: 'b', total_points: 15 }];
    expect(Object.fromEntries(computeGains(prev, next))).toEqual({ b: 10 });
  });

  it('non include utenti nuovi', () => {
    const prev = [{ id: 'a', total_points: 10 }];
    const next = [{ id: 'a', total_points: 10 }, { id: 'c', total_points: 7 }];
    expect(computeGains(prev, next).size).toBe(0);
  });

  it('non include punti diminuiti', () => {
    const prev = [{ id: 'a', total_points: 10 }];
    const next = [{ id: 'a', total_points: 4 }];
    expect(computeGains(prev, next).size).toBe(0);
  });
});

describe('interimOrder', () => {
  const a = (pts, rank) => ({ id: 'a', total_points: pts, rank });
  const b = (pts, rank) => ({ id: 'b', total_points: pts, rank });

  it('null se non c\'e una classifica mostrata', () => {
    expect(interimOrder([], [a(10, 1)])).toBeNull();
    expect(interimOrder(null, [a(10, 1)])).toBeNull();
  });

  it('null se l\'ordine non cambia', () => {
    expect(interimOrder([a(10, 1), b(5, 2)], [a(12, 1), b(5, 2)])).toBeNull();
  });

  it('sorpasso: punti nuovi ma posizione e rank vecchi', () => {
    const res = interimOrder([a(10, 1), b(5, 2)], [b(20, 1), a(10, 2)]);
    expect(res).toEqual([a(10, 1), b(20, 2)]);
  });

  it('nuovi in coda, rimossi esclusi', () => {
    const c = { id: 'c', total_points: 50, rank: 1 };
    const res = interimOrder([a(10, 1), b(5, 2)], [c, a(10, 2)]);
    expect(res.map((u) => u.id)).toEqual(['a', 'c']);
  });
});
