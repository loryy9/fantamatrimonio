/** Notifica al Durable Object dell'evento che dei dati sono cambiati. Mai bloccante, mai fatale. */
import type { Context } from "hono";
import type { AppEnv } from "../env";
import type { Topic } from "./topics";

function callDo(c: Context<AppEnv>, eventId: string, path: string, body?: unknown): void {
  const ns = c.env.EVENT_LIVE;
  if (!ns) return;
  try {
    const stub = ns.get(ns.idFromName(String(eventId)));
    const p = stub
      .fetch(`http://do${path}`, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) })
      .then(() => undefined)
      .catch((e) => console.error(`EventLive ${path} fallito:`, e));
    c.executionCtx.waitUntil(p);
  } catch (e) {
    console.error(`EventLive ${path} fallito:`, e);
  }
}

export function publish(c: Context<AppEnv>, eventId: string, topics: Topic[]): void {
  callDo(c, eventId, "/publish", { topics });
}

/** Chiude tutte le socket dell'evento (es. evento eliminato). */
export function closeEventLive(c: Context<AppEnv>, eventId: string): void {
  callDo(c, eventId, "/close");
}
