import type { Context } from "hono";
import type { Config } from "./config";
import { openDb, type Db } from "./db";
import type { AppEnv } from "./env";

/**
 * Esegue `fn` dopo l'invio della risposta (waitUntil).
 * Apre una connessione DB dedicata perche' quella della richiesta viene chiusa a risposta inviata.
 */
export function runInBackground(c: Context<AppEnv>, fn: (db: Db, cfg: Config) => Promise<unknown>): void {
  const cfg = c.get("cfg");
  c.executionCtx.waitUntil(
    (async () => {
      const db = openDb(cfg);
      try {
        await fn(db, cfg);
      } catch (e) {
        console.error("Errore nel task in background:", e);
      } finally {
        await db.close().catch(() => {});
      }
    })(),
  );
}
