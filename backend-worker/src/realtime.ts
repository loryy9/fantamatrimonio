import { DurableObject } from "cloudflare:workers";
import type { Env } from "./db";

/** Topic a cui un client può iscriversi (corrispondono alle pagine dell'app). */
export const TOPICS = ["gallery", "leaderboard"] as const;
export type Topic = (typeof TOPICS)[number];

export type RealtimeMessage =
  | { type: "photo_added"; topic: "gallery"; photo: Record<string, unknown> }
  | { type: "photo_removed"; topic: "gallery"; id: string }
  | { type: "leaderboard_changed"; topic: "leaderboard" };

type Attachment = { topics: Topic[] };

/**
 * Una "stanza" per matrimonio (idFromName(event_id)).
 * Usa la WebSocket Hibernation API: l'oggetto dorme tra un messaggio e l'altro
 * mentre le connessioni restano aperte, quindi non paga durata da inattivo.
 */
export class EventRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Il ping applicativo viene risposto senza svegliare l'oggetto.
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ topics: [] } satisfies Attachment);
    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: { "Sec-WebSocket-Protocol": "fm.v1" },
    });
  }

  /** Chiamato dal Worker (RPC) dopo una modifica: inoltra ai client iscritti al topic. */
  async publish(message: RealtimeMessage): Promise<void> {
    const payload = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as Attachment | null;
      if (!att?.topics.includes(message.topic)) continue;
      try {
        ws.send(payload);
      } catch {
        // socket già chiuso: verrà ripulito da webSocketClose
      }
    }
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (typeof raw !== "string") return;
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg?.type === "subscribe" && Array.isArray(msg.topics)) {
      const topics = msg.topics.filter((t: unknown): t is Topic => TOPICS.includes(t as Topic));
      ws.serializeAttachment({ topics } satisfies Attachment);
      ws.send(JSON.stringify({ type: "subscribed", topics }));
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    ws.close(code, reason);
  }
}

/** Invia un messaggio ai client connessi al matrimonio `eventId`. Non solleva mai errori. */
export async function publish(env: Env, eventId: unknown, message: RealtimeMessage): Promise<void> {
  if (!eventId || !env.EVENT_ROOM) return;
  try {
    const stub = env.EVENT_ROOM.get(env.EVENT_ROOM.idFromName(String(eventId)));
    await stub.publish(message);
  } catch (err) {
    console.error("realtime publish failed", err);
  }
}
