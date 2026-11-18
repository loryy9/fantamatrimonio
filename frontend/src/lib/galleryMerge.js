// Unisce la galleria del server con le foto ottimistiche ancora in caricamento.
// `format` trasforma ogni foto del server (es. nomi formattati).
export function mergeGallery(current, serverData, format = (p) => p, force = false) {
  const pending = current.filter((p) => p._optimistic);
  const confirmed = current.filter((p) => !p._optimistic);
  // Nulla di nuovo: stessa lunghezza e stessa prima foto (le ottimistiche non contano)
  if (!force && confirmed.length === serverData.length && confirmed[0]?.id === serverData[0]?.id) return null;
  return [...pending, ...serverData.map(format)];
}

// Toglie i duplicati per id mantenendo la prima occorrenza (la copia locale ha la posizione già stabile).
export function dedupeById(photos) {
  const seen = new Set();
  return photos.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
}
