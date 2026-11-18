import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { parseTopics } from "../src/live/topics";

type Conn = { ws: WebSocket; msgs: unknown[]; closes: number[] };

let counter = 0;
function newStub() {
  return env.EVENT_LIVE.get(env.EVENT_LIVE.idFromName(`evt-${++counter}`));
}

async function connect(stub: DurableObjectStub, userId: number): Promise<Conn> {
  const res = await stub.fetch("http://do/connect", {
    headers: { Upgrade: "websocket", "X-Live-User": JSON.stringify({ userId, role: "guest" }) },
  });
  const ws = res.webSocket!;
  ws.accept();
  const conn: Conn = { ws, msgs: [], closes: [] };
  ws.addEventListener("message", (e) => {
    conn.msgs.push(JSON.parse(e.data as string));
  });
  ws.addEventListener("close", (e) => {
    conn.closes.push(e.code);
  });
  return conn;
}

const tick = () => new Promise((r) => setTimeout(r, 50));
const sub = (c: Conn, topics: string[]) => c.ws.send(JSON.stringify({ type: "subscribe", topics }));
const publish = (stub: DurableObjectStub, topics: string[]) =>
  stub.fetch("http://do/publish", { method: "POST", body: JSON.stringify({ topics }) });

describe("parseTopics", () => {
  it("filtra topic ignoti e duplicati", () => {
    expect(parseTopics(["leaderboard", "foo", "leaderboard", 3])).toEqual(["leaderboard"]);
    expect(parseTopics("x")).toEqual([]);
  });
});

describe("EventLive", () => {
  it("publish consegna solo agli iscritti al topic", async () => {
    const stub = newStub();
    const a = await connect(stub, 1);
    const b = await connect(stub, 2);
    sub(a, ["leaderboard"]);
    sub(b, ["gallery"]);
    await tick();
    expect((await publish(stub, ["leaderboard"])).status).toBe(204);
    await tick();
    expect(a.msgs).toEqual([{ type: "changed", topics: ["leaderboard"] }]);
    expect(b.msgs).toEqual([]);
  });

  it("publish manda solo l'intersezione", async () => {
    const stub = newStub();
    const a = await connect(stub, 1);
    sub(a, ["leaderboard", "gallery"]);
    await tick();
    await publish(stub, ["gallery", "challenges"]);
    await tick();
    expect(a.msgs).toEqual([{ type: "changed", topics: ["gallery"] }]);
  });

  it("subscribe sostituisce i topic", async () => {
    const stub = newStub();
    const a = await connect(stub, 1);
    sub(a, ["leaderboard"]);
    sub(a, ["gallery"]);
    await tick();
    await publish(stub, ["leaderboard"]);
    await tick();
    expect(a.msgs).toEqual([]);
  });

  it("messaggi malformati ignorati", async () => {
    const stub = newStub();
    const a = await connect(stub, 1);
    sub(a, ["event"]);
    a.ws.send("{oops");
    a.ws.send(JSON.stringify({ type: "boh" }));
    await tick();
    await publish(stub, ["event"]);
    await tick();
    expect(a.closes).toEqual([]);
    expect(a.msgs).toEqual([{ type: "changed", topics: ["event"] }]);
  });

  it("ping riceve pong", async () => {
    const stub = newStub();
    const res = await stub.fetch("http://do/connect", {
      headers: { Upgrade: "websocket", "X-Live-User": JSON.stringify({ userId: 1, role: "guest" }) },
    });
    const ws = res.webSocket!;
    ws.accept();
    const got = new Promise<string>((r) => ws.addEventListener("message", (e) => r(e.data as string)));
    ws.send("ping");
    expect(await got).toBe("pong");
  });

  it("close notifica e chiude tutte", async () => {
    const stub = newStub();
    const a = await connect(stub, 1);
    const b = await connect(stub, 2);
    sub(b, ["gallery"]);
    await tick();
    expect((await stub.fetch("http://do/close", { method: "POST" })).status).toBe(204);
    await tick();
    for (const c of [a, b]) {
      expect(c.msgs).toEqual([{ type: "event_deleted" }]);
      expect(c.closes).toEqual([4000]);
    }
  });

  it("connect senza Upgrade -> 426", async () => {
    const res = await newStub().fetch("http://do/connect", {
      headers: { "X-Live-User": JSON.stringify({ userId: 1, role: "guest" }) },
    });
    expect(res.status).toBe(426);
  });
});
