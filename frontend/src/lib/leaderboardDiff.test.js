import { describe, it, expect } from 'vitest';
import { computeGains } from './leaderboardDiff.js';

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
