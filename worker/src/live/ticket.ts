/** Ticket monouso breve (60 s) per aprire la WebSocket: il browser non puo' inviare header Authorization. */
import { decodeJwt, sign } from "../auth";
import type { Config } from "../config";

const TICKET_TTL_SECONDS = 60;

export function createLiveTicket(cfg: Config, user: { id: string; event_id: string; role: string }): Promise<string> {
  return sign(
    cfg,
    { sub: String(user.id), event_id: String(user.event_id), role: user.role, type: "live" },
    TICKET_TTL_SECONDS,
  );
}

/** Ritorna i dati del ticket, oppure null se firma errata, scaduto o di tipo diverso da "live". */
export async function verifyLiveTicket(
  cfg: Config,
  token: string,
): Promise<{ userId: string; eventId: string; role: string } | null> {
  const p = await decodeJwt(cfg, token);
  if (!p || p.type !== "live" || !p.sub || typeof p.event_id !== "string" || typeof p.role !== "string") return null;
  return { userId: String(p.sub), eventId: p.event_id, role: p.role };
}
