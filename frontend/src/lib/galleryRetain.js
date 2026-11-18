// Reinserisce la foto aperta a schermo intero se nel frattempo è sparita dalla lista
// (es. cancellata dall'autore): resta visibile finché l'utente non cambia foto o chiude.
export function withRetainedPhoto(photos, retained) {
  if (!retained || photos.some(p => p.id === retained.photo.id)) return photos;
  const at = Math.min(retained.index, photos.length);
  return [...photos.slice(0, at), retained.photo, ...photos.slice(at)];
}
