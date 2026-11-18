import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env";
import { parseTopics, type Topic } from "./topics";

/** Stato per socket, persistito nell'attachment (sopravvive all'hibernation). */
interface Attachment {
  userId: unknown;
  role: unknown;
  topics: Topic[];
}

/**
 * Un Durable Object per evento: tiene le WebSocket e le notifiche "changed" per topic.
 * Non contiene dati di gioco e non interroga il database.
 */
export class EventLive extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // ping/pong gestito senza risvegliare l'oggetto
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/connect") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Upgrade richiesto", { status: 426 });
      }
      let user: { userId?: unknown; role?: unknown } | null;
      try {
        user = JSON.parse(request.headers.get("X-Live-User") ?? "");
      } catch {
        return new Response("Utente non valido", { status: 400 });
      }
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      const attachment: Attachment = { userId: user?.userId, role: user?.role, topics: [] };
      server.serializeAttachment(attachment);
      return new Response(null, { status: 101, webSocket: client });
    }

    if (request.method === "POST" && url.pathname === "/publish") {
      const body = (await request.json().catch(() => null)) as { topics?: unknown } | null;
      const topics = parseTopics(body?.topics);
      for (const ws of this.ctx.getWebSockets()) {
        const mine = (ws.deserializeAttachment() as Attachment | null)?.topics ?? [];
        const hit = topics.filter((t) => mine.includes(t));
        if (hit.length === 0) continue;
        try {
          ws.send(JSON.stringify({ type: "changed", topics: hit }));
        } catch {
          // socket gia' chiusa: ignorata
        }
      }
      return new Response(null, { status: 204 });
    }

    if (request.method === "POST" && url.pathname === "/close") {
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(JSON.stringify({ type: "event_deleted" }));
          ws.close(4000, "event_deleted");
        } catch {
          // socket gia' chiusa: ignorata
        }
      }
      return new Response(null, { status: 204 });
    }

    return new Response("Not found", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;
    let data: unknown;
    try {
      data = JSON.parse(message);
    } catch {
      return; // messaggio malformato: ignorato
    }
    if (!data || typeof data !== "object" || (data as { type?: unknown }).type !== "subscribe") return;
    const current = (ws.deserializeAttachment() as Attachment | null) ?? {
      userId: null,
      role: null,
      topics: [],
    };
    ws.serializeAttachment({ ...current, topics: parseTopics((data as { topics?: unknown }).topics) });
  }

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    // i codici riservati (1005/1006/...) non si possono inviare in close()
    try {
      ws.close(code >= 1000 && code < 5000 && code !== 1005 && code !== 1006 ? code : 1000);
    } catch {
      // gia' chiusa
    }
  }
}
