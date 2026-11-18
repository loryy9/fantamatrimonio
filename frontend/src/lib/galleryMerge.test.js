import { describe, it, expect } from 'vitest';
import { mergeGallery, dedupeById } from './galleryMerge.js';

describe('mergeGallery', () => {
  const opt = { id: 'temp-1', _optimistic: true };
  it('mantiene le foto ottimistiche in testa', () => {
    const r = mergeGallery([opt, { id: 'a' }], [{ id: 'b' }, { id: 'a' }]);
    expect(r.map((p) => p.id)).toEqual(['temp-1', 'b', 'a']);
  });
  it('salta se nulla è cambiato ignorando le ottimistiche', () => {
    expect(mergeGallery([opt, { id: 'a' }], [{ id: 'a' }])).toBeNull();
  });
  it('force ricostruisce comunque', () => {
    expect(mergeGallery([opt, { id: 'a' }], [{ id: 'a' }], (p) => p, true)).toHaveLength(2);
  });
  it('applica il formato alle foto del server', () => {
    const r = mergeGallery([], [{ id: 'a' }], (p) => ({ ...p, f: 1 }));
    expect(r[0].f).toBe(1);
  });
});

describe('dedupeById', () => {
  it('tiene la prima occorrenza', () => {
    expect(dedupeById([{ id: 1, x: 1 }, { id: 2 }, { id: 1, x: 2 }])).toEqual([{ id: 1, x: 1 }, { id: 2 }]);
  });
});
