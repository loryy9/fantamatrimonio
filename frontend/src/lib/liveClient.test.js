import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LiveClient } from './liveClient.js';

// WebSocket finto: registra i messaggi inviati e permette di simulare gli eventi del server.
class FakeWebSocket {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.sent = [];
    this.readyState = 0;
    FakeWebSocket.instances.push(this);
  }
  send(data) { this.sent.push(data); }
  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.onclose?.({});
  }
  open() { this.readyState = 1; this.onopen?.({}); }
  message(data) { this.onmessage?.({ data: typeof data === 'string' ? data : JSON.stringify(data) }); }
  serverClose() { this.readyState = 3; this.onclose?.({}); }
}

const last = () => FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
const subs = (ws) => ws.sent.filter((s) => s !== 'ping').map((s) => JSON.parse(s));

describe('LiveClient', () => {
  let onChanged, onEventDeleted, client;

  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.instances = [];
    onChanged = vi.fn();
    onEventDeleted = vi.fn();
    client = new LiveClient({
      getTicket: async () => 'tk',
      url: (t) => `ws://x/live?ticket=${t}`,
      onChanged,
      onEventDeleted,
      WebSocketImpl: FakeWebSocket,
      random: () => 0.5
    });
  });
  afterEach(() => { client.disconnect(); vi.useRealTimers(); });

  const start = async (topics = ['leaderboard']) => {
    client.setTopics(topics);
    client.connect();
    await vi.advanceTimersByTimeAsync(0);
    last().open();
    return last();
  };

  it("invia subscribe all'apertura con i topic correnti", async () => {
    const ws = await start(['leaderboard', 'gallery']);
    expect(ws.url).toBe('ws://x/live?ticket=tk');
    expect(subs(ws)).toEqual([{ type: 'subscribe', topics: ['leaderboard', 'gallery'] }]);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('setTopics a socket aperta invia subscribe', async () => {
    const ws = await start();
    client.setTopics(['gallery']);
    expect(subs(ws).at(-1)).toEqual({ type: 'subscribe', topics: ['gallery'] });
  });

  it('raggruppa gli avvisi', async () => {
    await start();
    last().message({ type: 'changed', topics: ['leaderboard'] });
    await vi.advanceTimersByTimeAsync(200);
    last().message({ type: 'changed', topics: ['leaderboard'] });
    await vi.advanceTimersByTimeAsync(200);
    last().message({ type: 'changed', topics: ['gallery'] });
    await vi.advanceTimersByTimeAsync(800);
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(onChanged).toHaveBeenCalledWith(['leaderboard', 'gallery']);
  });

  it('riconnessione rimanda subscribe e fa refresh', async () => {
    const ws = await start(['leaderboard']);
    ws.serverClose();
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeWebSocket.instances).toHaveLength(2);
    last().open();
    expect(subs(last())).toEqual([{ type: 'subscribe', topics: ['leaderboard'] }]);
    expect(onChanged).toHaveBeenCalledWith(['leaderboard']);
  });

  it('con topic vuoti non chiama onChanged alla riapertura', async () => {
    const ws = await start([]);
    ws.serverClose();
    await vi.advanceTimersByTimeAsync(1000);
    last().open();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('connect dopo disconnect (dopo un open) conta come riapertura e fa refresh', async () => {
    await start(['gallery']);
    client.disconnect();
    client.connect();
    await vi.advanceTimersByTimeAsync(0);
    expect(FakeWebSocket.instances).toHaveLength(2);
    last().open();
    expect(onChanged).toHaveBeenCalledWith(['gallery']);
  });

  it('backoff esponenziale fino a 30 s', async () => {
    client.connect();
    await vi.advanceTimersByTimeAsync(0);
    const waits = [1000, 2000, 4000, 8000, 16000, 30000, 30000];
    for (const w of waits) {
      const n = FakeWebSocket.instances.length;
      last().serverClose();
      await vi.advanceTimersByTimeAsync(w - 1);
      expect(FakeWebSocket.instances).toHaveLength(n);
      await vi.advanceTimersByTimeAsync(1);
      expect(FakeWebSocket.instances).toHaveLength(n + 1);
    }
  });

  it('applica il jitter con random', async () => {
    const c = new LiveClient({
      getTicket: async () => 'tk', url: (t) => t, onChanged, onEventDeleted,
      WebSocketImpl: FakeWebSocket, random: () => 1
    });
    c.connect();
    await vi.advanceTimersByTimeAsync(0);
    const n = FakeWebSocket.instances.length;
    last().serverClose();
    await vi.advanceTimersByTimeAsync(1199);
    expect(FakeWebSocket.instances).toHaveLength(n);
    await vi.advanceTimersByTimeAsync(1);
    expect(FakeWebSocket.instances).toHaveLength(n + 1);
    c.disconnect();
  });

  it('getTicket con errore terminale: niente retry e onEventDeleted', async () => {
    const getTicket = vi.fn().mockRejectedValue(Object.assign(new Error('gone'), { terminal: true }));
    const c = new LiveClient({
      getTicket, url: (t) => t, onChanged, onEventDeleted, WebSocketImpl: FakeWebSocket, random: () => 0.5
    });
    c.connect();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(60000);
    expect(getTicket).toHaveBeenCalledTimes(1);
    expect(onEventDeleted).toHaveBeenCalledTimes(1);
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  it('getTicket che rigetta riprova con backoff', async () => {
    const getTicket = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValue('tk');
    const c = new LiveClient({
      getTicket, url: (t) => t, onChanged, onEventDeleted, WebSocketImpl: FakeWebSocket, random: () => 0.5
    });
    c.connect();
    await vi.advanceTimersByTimeAsync(0);
    expect(FakeWebSocket.instances).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(getTicket).toHaveBeenCalledTimes(2);
    expect(FakeWebSocket.instances).toHaveLength(1);
    c.disconnect();
  });

  it('disconnect non riconnette', async () => {
    await start();
    client.disconnect();
    await vi.advanceTimersByTimeAsync(60000);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('event_deleted chiama onEventDeleted e non riconnette', async () => {
    const ws = await start();
    ws.message({ type: 'event_deleted' });
    ws.serverClose();
    await vi.advanceTimersByTimeAsync(60000);
    expect(onEventDeleted).toHaveBeenCalledTimes(1);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('ignora pong e messaggi non validi', async () => {
    const ws = await start();
    ws.message('pong');
    ws.message('{rotto');
    await vi.advanceTimersByTimeAsync(2000);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('ping ogni 30 s', async () => {
    const ws = await start();
    await vi.advanceTimersByTimeAsync(30000);
    expect(ws.sent.filter((s) => s === 'ping')).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(30000);
    expect(ws.sent.filter((s) => s === 'ping')).toHaveLength(2);
  });
});
