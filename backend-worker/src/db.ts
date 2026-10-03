import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type Env = {
  PHOTOS_BUCKET: R2Bucket;
  DATABASE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_KEY?: string;
  JWT_SECRET: string;
  JWT_EXPIRE_HOURS?: string;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_SECRET_KEY?: string;
  ENVIRONMENT?: string;
};

let _client: SupabaseClient | null = null;

export function getSupabase(url?: string, key?: string): SupabaseClient {
  if (!url || !key) {
    throw new Error("SUPABASE_URL e SUPABASE_SERVICE_KEY devono essere configurate nelle variabili d'ambiente");
  }
  if (!_client) {
    _client = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return _client;
}
