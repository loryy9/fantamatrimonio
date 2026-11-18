// Calcola chi ha guadagnato punti tra due versioni della classifica.
// Restituisce una Map id -> differenza (solo aumenti, solo utenti presenti in entrambe).
// prev null o vuoto = primo caricamento: nessun guadagno da mostrare.
export function computeGains(prev, next) {
  const gains = new Map();
  if (!prev || prev.length === 0) return gains;
  const before = new Map(prev.map((u) => [u.id, u.total_points]));
  for (const u of next) {
    if (!before.has(u.id)) continue;
    const diff = u.total_points - before.get(u.id);
    if (diff > 0) gains.set(u.id, diff);
  }
  return gains;
}
