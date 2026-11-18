/** Funzioni di serializzazione condivise per le risposte API. */
import type { Row } from "./db";
import { iso } from "./util";

/**
 * Serializza l'evento. `game_started` compare solo se passato esplicitamente.
 * Attenzione: non usare `.map(eventOut)` (l'indice finirebbe in `gameStarted`): usare `.map((e) => eventOut(e))`.
 */
export function eventOut(event: Row, gameStarted?: boolean): Row {
  const out: Row = {
    id: String(event.id),
    spouse1_name: event.spouse1_name,
    spouse2_name: event.spouse2_name,
    enable_timer: event.enable_timer,
    start_time: event.start_time ? iso(event.start_time) : null,
    end_time: event.end_time ? iso(event.end_time) : null,
    invite_code: event.invite_code ?? null,
  };
  if (gameStarted !== undefined) out.game_started = gameStarted;
  return out;
}

export function userOut(user: Row): Row {
  const out: Row = {
    id: String(user.id),
    first_name: user.nickname ?? user.first_name ?? "",
    last_name: "",
    nickname: user.nickname ?? user.first_name ?? "",
    total_points: user.total_points,
    role: user.role,
  };
  if (user.account_id) out.account_id = String(user.account_id);
  return out;
}

export function accountOut(account: Row): Row {
  return {
    id: String(account.id),
    email: account.email ?? null,
    display_name: account.display_name,
    first_name: account.first_name ?? null,
    last_name: account.last_name ?? null,
    nickname: account.nickname ?? null,
    is_verified: account.is_verified ?? false,
    registered_at: account.registered_at ? iso(account.registered_at) : null,
  };
}
