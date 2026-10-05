import { neon } from "@neondatabase/serverless";
import type { EventRoom } from "./realtime";

export type Env = {
  PHOTOS_BUCKET: R2Bucket;
  EVENT_ROOM: DurableObjectNamespace<EventRoom>;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRE_HOURS?: string;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_SECRET_KEY?: string;
  ENVIRONMENT?: string;
};

export type Db = {
  /** Esegue una query parametrizzata ($1, $2, ...) e restituisce tutte le righe. */
  all: (text: string, params?: any[]) => Promise<any[]>;
  /** Come `all`, ma restituisce solo la prima riga (o null). */
  one: (text: string, params?: any[]) => Promise<any | null>;
};

export function getDb(env: Env): Db {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL deve essere configurata nelle variabili d'ambiente");
  }
  const sql = neon(env.DATABASE_URL);
  const all = async (text: string, params: any[] = []) => (await sql.query(text, params)) as any[];
  return {
    all,
    one: async (text, params) => (await all(text, params))[0] ?? null,
  };
}
