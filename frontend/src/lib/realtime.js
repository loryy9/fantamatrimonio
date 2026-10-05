const API_BASE = import.meta.env.VITE_API_URL || '/api';

const PING_MS = 30000;
const BACKOFF_MS = [1000, 2000, 5000, 10000, 20000];

function wsUrl() {
  const url = new URL(`${API_BASE}/realtime`, window.location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

/**
 * Client WebSocket con riconnessione automatica.
 * - `onMessage(msg)`: messaggi dal server (photo_added, photo_removed, leaderboard_changed)
 * - `onOpen()`: a ogni (ri)connessione, per riallineare i dati persi nel frattempo
 * - `onStatus(connected)`: stato della connessione
 */
export class RealtimeClient {
  constructor({ getToken, onMessage, onOpen, onStatus }) {
    this.getToken = getToken;
    this.onMessage = onMessage;
    this.onOpen = onOpen;
    this.onStatus = onStatus;
    this.ws = null;
    this.topics = [];
    this.wanted = false;
    this.attempt = 0;
    this.retryTimer = null;
    this.pingTimer = null;
    this._onVisible = () => {
      if (document.visibilityState === 'visible' && this.wanted && !this.isOpen) this._connect();
    };
  }

  get isOpen() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect() {
    if (this.wanted) return;
    this.wanted = true;
    document.addEventListener('visibilitychange', this._onVisible);
    this._connect();
  }

  disconnect() {
    this.wanted = false;
    document.removeEventListener('visibilitychange', this._onVisible);
    clearTimeout(this.retryTimer);
    this._stopPing();
    const ws = this.ws;
    this.ws = null;
    ws?.close();
    this.onStatus?.(false);
  }

  /** Cambia i topic ricevuti (es. in base alla pagina aperta). */
  setTopics(topics) {
    const same = topics.length === this.topics.length && topics.every((t, i) => t === this.topics[i]);
    this.topics = topics;
    if (!same) this._sendTopics();
  }

  _sendTopics() {
    if (this.isOpen) this.ws.send(JSON.stringify({ type: 'subscribe', topics: this.topics }));
  }

  _connect() {
    const token = this.getToken();
    if (!token || this.ws) return;

    const ws = new WebSocket(wsUrl(), ['fm.v1', `token.${token}`]);
    this.ws = ws;

    ws.onopen = () => {
      this.attempt = 0;
      this._sendTopics();
      this._startPing();
      this.onStatus?.(true);
      this.onOpen?.();
    };
    ws.onmessage = (e) => {
      if (e.data === 'pong') return;
      try {
        this.onMessage?.(JSON.parse(e.data));
      } catch {
        /* messaggio non valido: ignorato */
      }
    };
    ws.onclose = () => {
      if (this.ws !== ws) return; // chiusura voluta o socket già sostituito
      this.ws = null;
      this._stopPing();
      this.onStatus?.(false);
      this._scheduleRetry();
    };
    ws.onerror = () => ws.close();
  }

  _scheduleRetry() {
    if (!this.wanted) return;
    const delay = BACKOFF_MS[Math.min(this.attempt++, BACKOFF_MS.length - 1)];
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => this._connect(), delay);
  }

  _startPing() {
    this._stopPing();
    this.pingTimer = setInterval(() => {
      if (this.isOpen) this.ws.send('ping');
    }, PING_MS);
  }

  _stopPing() {
    clearInterval(this.pingTimer);
    this.pingTimer = null;
  }
}
