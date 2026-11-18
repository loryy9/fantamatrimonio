import { env, exports } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createJwt } from "../src/auth";
import { getConfig } from "../src/config";
import { publish } from "../src/live/publish";
import { createLiveTicket, verifyLiveTicket } from "../src/live/ticket";

const cfg = getConfig(env);
const user = { id: "u1", event_id: "e1", role: "guest" };

afterEach(() => {
  vi.useRealTimers();
});

describe("ticket live", () => {
  it("ticket valido", async () => {
    const t = await createLiveTicket(cfg, user);
    expect(await verifyLiveTicket(cfg, t)).toEqual({ userId: "u1", eventId: "e1", role: "guest" });
  });

  it("ticket scaduto", async () => {
    vi.useFakeTimers();
    const t = await createLiveTicket(cfg, user);
    vi.advanceTimersByTime(61_000);
    expect(await verifyLiveTicket(cfg, t)).toBeNull();
  });

  it("JWT account non e' un ticket", async () => {
    expect(await verifyLiveTicket(cfg, await createJwt(cfg, "a1"))).toBeNull();
  });
});

describe("GET /api/live", () => {
  it("ticket falso -> 401", async () => {
    const res = await exports.default.fetch("http://x/api/live?ticket=abc", { headers: { Upgrade: "websocket" } });
    expect(res.status).toBe(401);
  });

  it("senza Upgrade -> 426", async () => {
    const ticket = await createLiveTicket(cfg, user);
    const res = await exports.default.fetch(`http://x/api/live?ticket=${ticket}`);
    expect(res.status).toBe(426);
  });

  it("end-to-end: subscribe + publish -> changed", async () => {
    const ticket = await createLiveTicket(cfg, user);
    const res = await exports.default.fetch(`http://x/api/live?ticket=${ticket}`, { headers: { Upgrade: "websocket" } });
    expect(res.status).toBe(101);
    const ws = res.webSocket!;
    ws.accept();
    const msgs: unknown[] = [];
    ws.addEventListener("message", (e) => {
      msgs.push(JSON.parse(e.data as string));
    });
    ws.send(JSON.stringify({ type: "subscribe", topics: ["gallery"] }));
    await new Promise((r) => setTimeout(r, 50));
    await env.EVENT_LIVE.get(env.EVENT_LIVE.idFromName("e1")).fetch("http://do/publish", {
      method: "POST",
      body: JSON.stringify({ topics: ["gallery"] }),
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(msgs).toEqual([{ type: "changed", topics: ["gallery"] }]);
  });
});

describe("publish", () => {
  it("non lancia se il DO fallisce", async () => {
    let waited: Promise<unknown> | undefined;
    const c = {
      env: { EVENT_LIVE: { idFromName: (n: string) => n, get: () => ({ fetch: () => Promise.reject(new Error("boom")) }) } },
      executionCtx: { waitUntil: (p: Promise<unknown>) => (waited = p) },
    } as never;
    expect(() => publish(c, "e1", ["gallery"])).not.toThrow();
    await expect(waited).resolves.toBeUndefined();
  });
});
