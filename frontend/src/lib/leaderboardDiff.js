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

// Ordine "intermedio" per animare un sorpasso in due tempi: i dati (punti) sono gia'
// quelli nuovi ma ognuno resta nella posizione che aveva in `shown`, col rank vecchio.
// I nuovi iscritti vanno in coda, chi non c'e' piu' sparisce.
// Restituisce null se l'ordine non cambia (nessuna fase intermedia necessaria).
export function interimOrder(shown, next) {
  if (!shown || shown.length === 0) return null;
  const nextById = new Map(next.map((u) => [u.id, u]));
  const interim = [];
  for (const old of shown) {
    const fresh = nextById.get(old.id);
    if (fresh) interim.push({ ...fresh, rank: old.rank });
  }
  const kept = new Set(interim.map((u) => u.id));
  for (const u of next) if (!kept.has(u.id)) interim.push(u);
  const sameOrder = interim.every((u, i) => u.id === next[i].id);
  return sameOrder ? null : interim;
}
