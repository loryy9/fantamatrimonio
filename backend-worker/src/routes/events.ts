import { Hono } from "hono";
import { Env, getDb } from "../db";
import { verifyJwt, generateInviteCode } from "../auth";

export const eventsRouter = new Hono<{ Bindings: Env }>();

async function getAuth(c: any) {
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  return await verifyJwt(token, c.env.JWT_SECRET || "default_jwt_secret");
}

// GET /api/events/preview/:inviteCode
eventsRouter.get("/preview/:inviteCode", async (c) => {
  const code = c.req.param("inviteCode").trim().toUpperCase();
  const event = await getDb(c.env).one(
    `SELECT id, spouse1_name, spouse2_name, enable_timer, start_time, end_time, invite_code
     FROM events WHERE lower(invite_code) = lower($1) LIMIT 1`,
    [code]
  );

  if (!event) return c.json({ detail: "Evento non trovato" }, 404);
  return c.json(event);
});

// POST /api/events
eventsRouter.post("/", async (c) => {
  const body = await c.req.json();
  const auth = await getAuth(c);

  const spouse1 = (body.spouse1_name || "").trim();
  const spouse2 = (body.spouse2_name || "").trim();
  const coupleFirst = (body.couple_first_name || spouse1).trim().toLowerCase();
  const coupleLast = (body.couple_last_name || spouse2).trim().toLowerCase();
  const enableTimer = !!body.enable_timer;
  const startTime = body.start_time || null;
  const endTime = body.end_time || null;

  if (!spouse1 || !spouse2) {
    return c.json({ detail: "I nomi degli sposi sono obbligatori." }, 400);
  }

  const inviteCode = generateInviteCode(6);
  const db = getDb(c.env);

  const event = await db.one(
    `INSERT INTO events (spouse1_name, spouse2_name, enable_timer, start_time, end_time, invite_code)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [spouse1, spouse2, enableTimer, startTime, endTime, inviteCode]
  );

  const coupleUser = await db.one(
    `INSERT INTO users (event_id, first_name, last_name, secret_word, role, account_id)
     VALUES ($1, $2, $3, 'sposi', 'couple', $4) RETURNING *`,
    [event.id, coupleFirst, coupleLast, auth?.type === "account" ? auth.sub : null]
  );

  return c.json({
    event,
    couple_user: coupleUser,
    invite_code: event.invite_code,
  });
});

// GET /api/events/me
eventsRouter.get("/me", async (c) => {
  const auth = await getAuth(c);
  if (!auth) return c.json({ detail: "Non autorizzato." }, 401);

  const db = getDb(c.env);
  let eventId = auth.event_id;

  if (!eventId && auth.type === "account") {
    const user = await db.one(
      "SELECT event_id FROM users WHERE account_id = $1 ORDER BY created_at DESC LIMIT 1",
      [auth.sub]
    );
    eventId = user?.event_id;
  }

  if (!eventId) return c.json({ detail: "Nessun evento associato." }, 404);

  const event = await db.one("SELECT * FROM events WHERE id = $1", [eventId]);
  return c.json(event);
});

// PATCH /api/events/me
eventsRouter.patch("/me", async (c) => {
  const auth = await getAuth(c);
  if (!auth) return c.json({ detail: "Non autorizzato." }, 401);

  const body = await c.req.json();
  const db = getDb(c.env);

  const updates: Record<string, any> = {};
  if (body.spouse1_name !== undefined) updates.spouse1_name = body.spouse1_name;
  if (body.spouse2_name !== undefined) updates.spouse2_name = body.spouse2_name;
  if (body.enable_timer !== undefined) updates.enable_timer = body.enable_timer;
  if (body.start_time !== undefined) updates.start_time = body.start_time;
  if (body.end_time !== undefined) updates.end_time = body.end_time;

  const columns = Object.keys(updates);
  if (columns.length === 0) {
    return c.json(await db.one("SELECT * FROM events WHERE id = $1", [auth.event_id]));
  }

  // I nomi delle colonne arrivano solo dalla whitelist sopra, mai dall'input.
  const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(", ");
  const event = await db.one(
    `UPDATE events SET ${setClause} WHERE id = $${columns.length + 1} RETURNING *`,
    [...columns.map((col) => updates[col]), auth.event_id]
  );
  if (!event) return c.json({ detail: "Evento non trovato." }, 404);
  return c.json(event);
});

// GET /api/events/me/invite
eventsRouter.get("/me/invite", async (c) => {
  const auth = await getAuth(c);
  if (!auth) return c.json({ detail: "Non autorizzato." }, 401);

  const event = await getDb(c.env).one("SELECT invite_code FROM events WHERE id = $1", [auth.event_id]);
  return c.json({ invite_code: event?.invite_code });
});
