/**
 * Aggiornamenti live.
 * POST /api/live/ticket?event_id=...  -> ticket di 60 s per aprire la WebSocket
 * GET  /api/live?ticket=...           -> upgrade WebSocket verso il Durable Object dell'evento
 */
import { Hono } from "hono";
import { requireUser } from "../auth";
import type { AppEnv } from "../env";
import { createLiveTicket, verifyLiveTicket } from "../live/ticket";

const router = new Hono<AppEnv>();

router.post("/ticket", requireUser, async (c) => {
  const ticket = await createLiveTicket(c.get("cfg"), c.get("user") as { id: string; event_id: string; role: string });
  return c.json({ ticket });
});

router.get("/", async (c) => {
  const t = await verifyLiveTicket(c.get("cfg"), c.req.query("ticket") ?? "");
  if (!t) return c.json({ detail: "Ticket non valido o scaduto." }, 401);
  if (c.req.header("upgrade")?.toLowerCase() !== "websocket") return c.json({ detail: "Richiesta WebSocket attesa." }, 426);

  const stub = c.env.EVENT_LIVE.get(c.env.EVENT_LIVE.idFromName(t.eventId));
  const headers = new Headers({
    Upgrade: "websocket",
    "X-Live-User": JSON.stringify({ userId: t.userId, role: t.role }),
  });
  return stub.fetch("http://do/connect", { headers });
});

export default router;
