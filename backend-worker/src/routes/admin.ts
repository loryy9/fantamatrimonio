import { Hono } from "hono";
import { Env, getDb } from "../db";
import { createAdminToken, verifyAdminToken } from "../auth";

export const adminRouter = new Hono<{ Bindings: Env }>();

function getAdmin(c: any) {
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim() || c.req.header("X-Admin-Token") || "";
  if (!token) return null;
  return verifyAdminToken(token);
}

// POST /api/admin/login
adminRouter.post("/login", async (c) => {
  const body = await c.req.json();
  const username = (body.username || "").trim();
  const password = body.password || "";

  const expectedUser = c.env.ADMIN_USERNAME || "admin";
  const expectedPass = c.env.ADMIN_PASSWORD || "admin";

  if (username !== expectedUser || password !== expectedPass) {
    return c.json({ detail: "Credenziali admin non valide." }, 401);
  }

  const token = createAdminToken(username, c.env.ADMIN_SECRET_KEY || "secret");
  return c.json({ token, username, role: "global_admin" });
});

// GET /api/admin/verify
adminRouter.get("/verify", async (c) => {
  const admin = getAdmin(c);
  if (!admin) return c.json({ detail: "Non autorizzato." }, 401);
  return c.json({ valid: true, username: admin.u });
});

// GET /api/admin/events
adminRouter.get("/events", async (c) => {
  const admin = getAdmin(c);
  if (!admin) return c.json({ detail: "Non autorizzato." }, 401);

  const db = getDb(c.env);
  const events = await db.all("SELECT * FROM events ORDER BY created_at DESC");
  return c.json(events);
});

// DELETE /api/admin/events/:id
adminRouter.delete("/events/:id", async (c) => {
  const admin = getAdmin(c);
  if (!admin) return c.json({ detail: "Non autorizzato." }, 401);

  const id = c.req.param("id");
  const db = getDb(c.env);
  await db.all("DELETE FROM events WHERE id = $1", [id]);
  return c.json({ success: true, deleted_id: id });
});
