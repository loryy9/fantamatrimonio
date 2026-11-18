// Collega il LiveClient allo stato dell'app: un solo socket alla volta, topic = unione di quelli
// richiesti dai componenti montati, handler di refresh registrati per topic.
import { goto } from '$app/navigation';
import { api } from './api.js';
import { appState } from './state.svelte.js';
import { LiveClient } from './liveClient.js';
import { ROUTES, dashboardUrl } from './routes.js';

let client = null;
let currentEventId = null;
let onDeleted = null;
const owners = new Map(); // owner (symbol) -> topics
const handlers = new Map(); // topic -> Set<funzione>

const allTopics = () => [...new Set([...owners.values()].flat())];

function dispatch(topics) {
  for (const topic of topics) {
    for (const fn of handlers.get(topic) ?? []) {
      const warn = (err) => console.warn(`Handler live "${topic}" fallito:`, err);
      try { Promise.resolve(fn()).catch(warn); } catch (err) { warn(err); } // gli altri handler proseguono
    }
  }
}

function onVisibility() {
  // Il refresh al ritorno lo fa già LiveClient alla riapertura del socket
  if (document.hidden) client?.disconnect();
  else client?.connect();
}

/** Partita chiusa dagli sposi mentre si è nel gioco: avviso, pulizia e uscita. */
async function defaultEventDeleted() {
  live.stop();
  await appState.alert('Gli sposi hanno chiuso questa partita', { title: 'Partita chiusa' });
  appState._clearEventSession();
  appState._clearGame();
  await goto(appState.hasAccount ? dashboardUrl(null) : ROUTES.home);
}

export const live = {
  /** Apre il canale live del matrimonio; con un altro eventId chiude il precedente. */
  start(eventId, { accountToken = null, onEventDeleted = null } = {}) {
    if (!eventId) return;
    if (client && currentEventId === eventId) return;
    this.stop();
    currentEventId = eventId;
    onDeleted = onEventDeleted;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    client = new LiveClient({
      getTicket: async () => {
        try {
          return (await api.getLiveTicket(eventId, accountToken)).ticket;
        } catch (err) {
          // 401/403/404: evento eliminato (o accesso revocato) mentre eravamo offline
          if ([401, 403, 404].includes(err?.status)) err.terminal = true;
          throw err;
        }
      },
      url: (ticket) => `${proto}://${location.host}/api/live?ticket=${encodeURIComponent(ticket)}`,
      onChanged: dispatch,
      onEventDeleted: () => (onDeleted ?? defaultEventDeleted)()
    });
    client.setTopics(allTopics());
    document.addEventListener('visibilitychange', onVisibility);
    if (!document.hidden) client.connect();
  },

  stop() {
    document.removeEventListener('visibilitychange', onVisibility);
    client?.disconnect();
    client = null;
    currentEventId = null;
    onDeleted = null;
  },

  addTopics(owner, topics) {
    owners.set(owner, topics);
    client?.setTopics(allTopics());
  },

  removeTopics(owner) {
    owners.delete(owner);
    client?.setTopics(allTopics());
  },

  /** Registra il refresh di un topic; restituisce la funzione per rimuoverlo. */
  on(topic, handler) {
    if (!handlers.has(topic)) handlers.set(topic, new Set());
    handlers.get(topic).add(handler);
    return () => handlers.get(topic)?.delete(handler);
  }
};

/** Handler del gioco: ogni topic ricarica la sua fetta di appState. Restituisce il cleanup. */
export function bindGameHandlers() {
  const offs = [
    live.on('leaderboard', () => appState.refreshLeaderboard()),
    live.on('gallery', () => appState.refreshGallery()),
    live.on('challenges', () => appState.refreshChallenges()),
    live.on('event', () => appState.refreshUser())
  ];
  return () => offs.forEach((off) => off());
}

/** Da chiamare nello <script> di un componente: sottoscrive i topic finché è montato. */
export function useLiveTopics(topics) {
  $effect(() => {
    const owner = Symbol('live-topics');
    live.addTopics(owner, topics);
    return () => live.removeTopics(owner);
  });
}
