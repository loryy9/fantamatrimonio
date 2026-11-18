// Client WebSocket per gli aggiornamenti live: logica pura, senza dipendenze da Svelte.
// Gestisce ticket, subscribe, debounce degli avvisi, ping e riconnessione con backoff.
export class LiveClient {
  constructor({
    getTicket,
    url,
    onChanged,
    onEventDeleted,
    WebSocketImpl = globalThis.WebSocket,
    debounceMs = 800,
    pingMs = 30000,
    random = Math.random
  }) {
    this.getTicket = getTicket;
    this.url = url;
    this.onChanged = onChanged;
    this.onEventDeleted = onEventDeleted;
    this.WebSocketImpl = WebSocketImpl;
    this.debounceMs = debounceMs;
    this.pingMs = pingMs;
    this.random = random;

    this.topics = [];
    this.ws = null;
    this.wanted = false; // true tra connect() e disconnect()
    this.generation = 0; // invalida ticket/socket di tentativi superati
    this.connecting = false;
    this.everOpened = false; // dalla prima apertura in poi ogni apertura fa refresh
    this.attempt = 0;
    this.reconnectTimer = null;
    this.pingTimer = null;
    this.debounceTimer = null;
    this.pending = new Set();
  }

  connect() {
    if (this.wanted) return; // idempotente
    this.wanted = true;
    this._open();
  }

  disconnect() {
    this.wanted = false;
    this.generation++;
    this.connecting = false;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    clearTimeout(this.debounceTimer);
    this.debounceTimer = null;
    this.pending.clear();
    this._stopPing();
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
      try { ws.close(); } catch { /* già chiusa */ }
    }
  }

  setTopics(topics) {
    this.topics = [...topics];
    this._sendSubscribe();
  }

  _sendSubscribe() {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify({ type: 'subscribe', topics: this.topics }));
    }
  }

  async _open() {
    if (this.connecting) return;
    this.connecting = true;
    const gen = this.generation;
    let ticket;
    try {
      ticket = await this.getTicket();
    } catch {
      if (gen !== this.generation) return;
      this.connecting = false;
      this._scheduleReconnect();
      return;
    }
    if (gen !== this.generation) return; // disconnect() nel frattempo
    this.connecting = false;

    const ws = new this.WebSocketImpl(this.url(ticket));
    this.ws = ws;
    ws.onopen = () => {
      if (gen !== this.generation) return;
      this.attempt = 0;
      this._sendSubscribe();
      this._startPing();
      // Riapertura: gli avvisi persi nel frattempo si recuperano con un refresh dei topic correnti.
      if (this.everOpened && this.topics.length > 0) this.onChanged([...this.topics]);
      this.everOpened = true;
    };
    ws.onmessage = (ev) => this._onMessage(ev.data);
    ws.onclose = () => {
      if (gen !== this.generation) return;
      this.ws = null;
      this._stopPing();
      if (this.wanted) this._scheduleReconnect();
    };
  }

  _onMessage(raw) {
    if (raw === 'pong') return;
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type === 'changed' && Array.isArray(msg.topics)) {
      msg.topics.forEach((t) => this.pending.add(t));
      if (!this.debounceTimer) {
        this.debounceTimer = setTimeout(() => {
          this.debounceTimer = null;
          const topics = [...this.pending];
          this.pending.clear();
          if (topics.length) this.onChanged(topics);
        }, this.debounceMs);
      }
    } else if (msg.type === 'event_deleted') {
      // Evento eliminato: niente riconnessione, decide il chiamante.
      this.disconnect();
      this.onEventDeleted();
    }
  }

  _scheduleReconnect() {
    if (!this.wanted || this.reconnectTimer) return;
    const base = Math.min(30000, 1000 * 2 ** this.attempt);
    this.attempt++;
    const delay = base * (1 + (this.random() - 0.5) * 0.4); // jitter ±20%
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.wanted) this._open();
    }, delay);
  }

  _startPing() {
    this._stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === 1) this.ws.send('ping');
    }, this.pingMs);
  }

  _stopPing() {
    clearInterval(this.pingTimer);
    this.pingTimer = null;
  }
}
