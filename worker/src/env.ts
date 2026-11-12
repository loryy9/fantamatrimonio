import type { Db, Row } from "./db";
import type { Config } from "./config";

/** Bindings e variabili del Worker (wrangler.jsonc + secrets). */
export interface Env {
  ASSETS: Fetcher;
  /** Bucket R2 con le foto caricate. */
  PHOTOS: R2Bucket;
  RATE_LIMIT_KV?: KVNamespace;

  DATABASE_URL?: string;
  MEDIA_BASE_URL?: string;

  JWT_SECRET?: string;
  JWT_EXPIRE_HOURS?: string;
  ACCESS_TOKEN_TTL_MINUTES?: string;
  REFRESH_TOKEN_TTL_DAYS?: string;
  REGISTRATION_REMINDER_DAYS?: string;
  FRONTEND_URL?: string;

  GMAIL_ADDRESS?: string;
  GMAIL_APP_PASSWORD?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  SMTP_FROM?: string;

  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_SECRET_KEY?: string;

  /** Login social: client id Google, app id/secret Facebook (il secret va con `wrangler secret put`). */
  GOOGLE_CLIENT_ID?: string;
  FACEBOOK_APP_ID?: string;
  FACEBOOK_APP_SECRET?: string;
}

export type AppEnv = {
  Bindings: Env;
  Variables: {
    db: Db;
    cfg: Config;
    user: Row;
    account: Row;
    admin: Row;
  };
};
