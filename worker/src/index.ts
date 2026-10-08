/**
 * Fanta Matrimonio — API + frontend su Cloudflare Workers (database Neon, foto su R2).
 *  - /api/*   -> API (Hono)
 *  - tutto il resto -> frontend Svelte (static assets, fallback SPA gestito da Cloudflare)
 *  - Cron Trigger -> invio reminder di registrazione
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { trimTrailingSlash } from "hono/trailing-slash";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { getConfig } from "./config";
import { openDb } from "./db";
import { processDueReminders } from "./email";
import type { AppEnv, Env } from "./env";
import { ApiError } from "./errors";
import admin from "./routes/admin";
import auth from "./routes/auth";
import challenges from "./routes/challenges";
import dashboard from "./routes/dashboard";
import events from "./routes/events";
import leaderboard from "./routes/leaderboard";
import submissions from "./routes/submissions";

const app = new Hono<AppEnv>();

app.use("*", trimTrailingSlash());
app.use("/api/*", cors({ origin: "*" }));

// Config + connessione DB per richiesta (la connessione si apre solo alla prima query).
app.use("/api/*", async (c, next) => {
  const cfg = getConfig(c.env);
  const db = openDb(cfg);
  c.set("cfg", cfg);
  c.set("db", db);
  try {
    await next();
  } finally {
    c.executionCtx.waitUntil(db.close().catch(() => {}));
  }
});

app.get("/api/health", (c) => c.json({ status: "ok" }));

// Foto caricate (R2). Nomi file = UUID casuali, quindi immutabili e cacheabili.
app.get("/api/media/:file", async (c) => {
  const obj = await c.env.PHOTOS.get(c.req.param("file"));
  if (!obj) return c.json({ detail: "Not Found" }, 404);
  const headers = new Headers({ "Cache-Control": "public, max-age=31536000, immutable", ETag: obj.httpEtag });
  obj.writeHttpMetadata(headers);
  return new Response(obj.body, { headers });
});

app.route("/api/auth", auth);
app.route("/api/challenges", challenges);
app.route("/api/submissions", submissions);
app.route("/api/leaderboard", leaderboard);
app.route("/api/events", events);
app.route("/api/admin", admin);
app.route("/api/dashboard", dashboard);

// Rotte /api sconosciute -> 404 JSON (tutto il resto e' del frontend)
app.all("/api/*", (c) => c.json({ detail: "Not Found" }, 404));
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

app.onError((err, c) => {
  if (err instanceof ApiError) return c.json({ detail: err.detail }, err.status as ContentfulStatusCode);
  // Postgres 22P02 = invalid_text_representation (es. UUID malformato nel path)
  if ((err as { code?: string }).code === "22P02") return c.json({ detail: "Identificativo non valido." }, 422);
  console.error("Errore non gestito:", err);
  return c.json({ detail: "Internal Server Error" }, 500);
});

export default {
  fetch: app.fetch,

  /** Cron Trigger: invia i reminder di registrazione scaduti. */
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const cfg = getConfig(env);
    const db = openDb(cfg);
    ctx.waitUntil(
      (async () => {
        try {
          const r = await processDueReminders(db, cfg, 100);
          console.log(`Reminder: trovati=${r.processed}, inviati=${r.sent}, falliti=${r.failed}`);
        } catch (e) {
          console.error("Errore nell'elaborazione dei reminder:", e);
        } finally {
          await db.close().catch(() => {});
        }
      })(),
    );
  },
} satisfies ExportedHandler<Env>;
