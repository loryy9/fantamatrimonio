import { describe, it, expect } from 'vitest';
import { withRetainedPhoto } from './galleryRetain.js';

const ph = (id) => ({ id });

describe('withRetainedPhoto', () => {
  it('retained null: stesso array', () => {
    const photos = [ph(1), ph(2)];
    expect(withRetainedPhoto(photos, null)).toBe(photos);
  });

  it('foto ancora presente: stesso array', () => {
    const photos = [ph(1), ph(2)];
    expect(withRetainedPhoto(photos, { photo: ph(2), index: 1 })).toBe(photos);
  });

  it('foto rimossa: reinserita al suo indice, senza mutare l\'originale', () => {
    const photos = [ph(1), ph(3)];
    const out = withRetainedPhoto(photos, { photo: ph(2), index: 1 });
    expect(out.map(p => p.id)).toEqual([1, 2, 3]);
    expect(photos).toHaveLength(2);
  });

  it('indice oltre la lunghezza: in coda', () => {
    const out = withRetainedPhoto([ph(1)], { photo: ph(9), index: 5 });
    expect(out.map(p => p.id)).toEqual([1, 9]);
  });
});
