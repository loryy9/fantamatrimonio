import { Hono } from "hono";
import { cors } from "hono/cors";
import { Env } from "./db";
import { authRouter } from "./routes/auth";
import { eventsRouter } from "./routes/events";
import { challengesRouter } from "./routes/challenges";
import { submissionsRouter } from "./routes/submissions";
import { leaderboardRouter } from "./routes/leaderboard";
import { dashboardRouter } from "./routes/dashboard";
import { adminRouter } from "./routes/admin";

const app = new Hono<{ Bindings: Env }>();

// CORS per frontend Vite / Cloudflare Pages
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "X-Admin-Token"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

// Healthcheck
app.get("/api/health", (c) => c.json({ status: "ok", engine: "cloudflare-worker" }));
app.get("/", (c) =>
  c.json({
    status: "ok",
    service: "fantamatrimonio-worker",
    storage: "Cloudflare R2",
  })
);

// R2 Photos direct download & upload endpoints
app.post("/api/photos/upload", async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"];
  if (!file || !(file instanceof File)) {
    return c.json({ error: "Nessun file fornito o non valido" }, 400);
  }
  const ext = file.name.split(".").pop() || "jpg";
  const filename = `${crypto.randomUUID()}.${ext}`;
  const fileBuffer = await file.arrayBuffer();

  await c.env.PHOTOS_BUCKET.put(filename, fileBuffer, {
    httpMetadata: { contentType: file.type || "image/jpeg" },
  });

  const fileUrl = `${new URL(c.req.url).origin}/api/photos/${filename}`;
  return c.json({
    success: true,
    filename,
    url: fileUrl,
    size: file.size,
  });
});

app.get("/api/photos/:filename", async (c) => {
  const filename = c.req.param("filename");
  const object = await c.env.PHOTOS_BUCKET.get(filename);
  if (!object) return c.json({ error: "Foto non trovata" }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
});

app.get("/api/photos", async (c) => {
  const list = await c.env.PHOTOS_BUCKET.list();
  const photos = list.objects.map((obj) => ({
    key: obj.key,
    size: obj.size,
    uploaded: obj.uploaded,
    url: `${new URL(c.req.url).origin}/api/photos/${obj.key}`,
  }));
  return c.json({ total: photos.length, photos });
});

app.delete("/api/photos/:filename", async (c) => {
  const filename = c.req.param("filename");
  await c.env.PHOTOS_BUCKET.delete(filename);
  return c.json({ success: true, message: `Foto ${filename} eliminata.` });
});

// Mount dei router REST del backend migrato
app.route("/api/auth", authRouter);
app.route("/api/events", eventsRouter);
app.route("/api/challenges", challengesRouter);
app.route("/api/submissions", submissionsRouter);
app.route("/api/leaderboard", leaderboardRouter);
app.route("/api/dashboard", dashboardRouter);
app.route("/api/admin", adminRouter);

export default app;
