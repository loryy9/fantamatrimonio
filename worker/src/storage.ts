/**
 * Foto caricate dagli invitati: salvate su Cloudflare R2 e servite dal Worker
 * (GET /api/media/:file), quindi il bucket NON deve essere pubblico.
 */
import type { Config } from "./config";

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
};

export const MEDIA_PATH = "/api/media";

/** Carica i byte di un'immagine su R2 e ritorna l'URL pubblico. */
export async function uploadPhoto(
  bucket: R2Bucket,
  cfg: Config,
  origin: string,
  bytes: ArrayBuffer,
  contentType: string,
): Promise<string> {
  const filename = `${crypto.randomUUID()}${EXT_BY_TYPE[contentType] ?? ".jpg"}`;
  await bucket.put(filename, bytes, { httpMetadata: { contentType } });
  return `${cfg.mediaBaseUrl || origin + MEDIA_PATH}/${filename}`;
}

/** Elimina la foto da R2 dato il suo URL. Non lancia mai (best effort). */
export async function deletePhoto(bucket: R2Bucket, photoUrl: string): Promise<void> {
  if (!photoUrl) return;
  try {
    const filename = photoUrl.split("/").pop()!.split("?")[0];
    if (filename) await bucket.delete(filename);
  } catch (e) {
    console.warn(`Impossibile eliminare la foto da R2 (${photoUrl}): ${e}`);
  }
}
