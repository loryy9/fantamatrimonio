# Aggiornamenti live — Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire il polling da 20 s con avvisi WebSocket per pagina (classifica, galleria, sfide, evento, dashboard), con animazioni dei cambiamenti, "+X punti" al posto del toast e blocco delle modifiche alle sfide a partita iniziata.

**Architecture:** Un Durable Object `EventLive` per evento (WebSocket Hibernation API) tiene le socket con i topic a cui ciascuna è iscritta. Le route Hono, dopo ogni scrittura, chiamano `publish(c, eventId, topics)` in `waitUntil`; il DO inoltra `{type:"changed",topics}` solo alle socket iscritte. Il client (`LiveClient`) apre una connessione per partita con un ticket JWT da 60 s, dichiara i topic della pagina corrente e, con debounce, richiama le API esistenti.

**Tech Stack:** Cloudflare Workers + Durable Objects (SQLite-backed) + Hono + jose (worker); SvelteKit / Svelte 5 runes (frontend); Vitest + `@cloudflare/vitest-pool-workers` (nuovi, test worker); Vitest (nuovo, test frontend su logica pura).

**Spec:** `docs/superpowers/specs/2026-11-18-aggiornamenti-live-design.md`

## Global Constraints

- Messaggi utente e commenti in italiano, come nel resto del codice.
- Si lavora sul branch `websocket` (già attivo, working tree pulito all'inizio).
- Topic ammessi, esattamente: `leaderboard`, `gallery`, `challenges`, `event`. Topic sconosciuti ignorati.
- Messaggi v1 server→client: `{"type":"changed","topics":[...]}`, `{"type":"event_deleted"}`. Client→server: `{"type":"subscribe","topics":[...]}` e la stringa `"ping"` (risposta automatica `"pong"`).
- Ticket live: JWT HS256 con `JWT_SECRET`, `type:"live"`, `sub=userId`, `eid=eventId`, `role`, scadenza **60 s**.
- L'avviso arriva a **tutte** le socket iscritte, autore compreso (nessuna esclusione).
- `publish` gira sempre in `c.executionCtx.waitUntil` e non fa mai fallire la richiesta (solo `console.error`).
- Debounce client **~800 ms**; backoff riconnessione 1 s → max 30 s con jitter; ping ogni ~30 s.
- Tab nascosta (`visibilitychange` hidden) → disconnessione; visibile → riconnessione + refresh dei topic correnti. Ogni riconnessione dopo la prima → refresh dei topic correnti.
- Nessun polling residuo nel web (`startPolling`/`stopPolling`/`pollingTimer` rimossi).
- Nessuna animazione al primo caricamento di una pagina; con `prefers-reduced-motion: reduce` nessuna animazione.
- Partita iniziata = (`enable_timer` && `start_time` && `now >= start_time`) **oppure** esiste una `user_submission` di un utente `guest` su una sfida dell'evento.
- Messaggio blocco, esatto: `La partita è iniziata: le sfide non sono più modificabili.`
- Messaggio partita chiusa, esatto: `Gli sposi hanno chiuso questa partita`.
- App Flutter (`mobile/`) non si tocca.

## Review Focus

1. **Ticket della dashboard col token sbagliato**: `getStoredToken` in `frontend/src/lib/api.js` preferisce `fm_auth_token`, che ignora `event_id`. Dalla dashboard il ticket deve essere chiesto col JWT account → Task 6 passa l'header esplicito.
2. **Raffica di avvisi** (10 ospiti finiscono il quiz insieme): una sola ricarica per topic per finestra di debounce → test in Task 5.
3. **Riconnessione che perde l'iscrizione**: dopo una riconnessione il client deve rimandare `subscribe` con i topic correnti, altrimenti la socket non riceve più nulla → test in Task 5.
4. **Foto aperta nel lightbox e cancellata**: deve restare visibile e navigabile finché non si chiude → test della funzione pura in Task 8.
5. **Errore del DO durante una scrittura** (DO irraggiungibile, binding assente in un ambiente): la richiesta dell'utente deve riuscire comunque → test in Task 2.

---

## File Structure

**Backend (`worker/`)**
- Create `src/live/EventLive.ts` — classe Durable Object (socket, topic, broadcast).
- Create `src/live/topics.ts` — costanti topic, `parseTopics`.
- Create `src/live/ticket.ts` — `createLiveTicket`, `verifyLiveTicket`.
- Create `src/live/publish.ts` — `publish`, `closeEventLive`.
- Create `src/routes/live.ts` — `POST /api/live/ticket`, `GET /api/live` (upgrade).
- Create `src/gameLock.ts` — `isGameStarted`, `loadGameStarted`, `assertChallengesEditable`.
- Modify `src/index.ts` (monta router, esporta `EventLive`), `src/env.ts` (binding), `wrangler.jsonc` (DO + migration), `src/serializers.ts` (`game_started`).
- Modify le route che scrivono: `routes/auth.ts`, `routes/submissions.ts`, `routes/challenges.ts`, `routes/events.ts`, `routes/admin.ts`, `routes/dashboard.ts`.
- Create `vitest.config.ts`, `test/*.test.ts`.

**Frontend (`frontend/`)**
- Create `src/lib/liveClient.js` — classe pura `LiveClient` (testabile, nessuna dipendenza Svelte).
- Create `src/lib/live.svelte.js` — singleton collegato ad `appState`, helper `useLiveTopics`.
- Create `src/lib/leaderboardDiff.js` — `computeGains`.
- Create `src/lib/galleryRetain.js` — `withRetainedPhoto`.
- Create `src/components/PointsBurst.svelte`.
- Modify `src/lib/state.svelte.js`, `src/lib/api.js`, `src/routes/+layout.svelte`, `src/routes/(game)/partita/[code]/+layout.svelte` e le pagine del gioco, `src/components/LeaderboardView.svelte`, `GalleryView.svelte`, `DashboardView.svelte`, `OnboardingSetup.svelte`, `HuntView.svelte`, `QuizView.svelte`.
- Create `vitest.config.js`, `src/lib/*.test.js`.

---

### Task 0: Commit di spec e TODO

- [ ] **Step 1:** `git add docs/superpowers/specs/2026-11-18-aggiornamenti-live-design.md docs/superpowers/plans/2026-11-18-aggiornamenti-live.md TODO`
- [ ] **Step 2:** `git commit -m "docs: design e piano aggiornamenti live"`

---

### Task 1: Durable Object `EventLive` + infrastruttura di test del worker

**Files:**
- Create: `worker/src/live/topics.ts`, `worker/src/live/EventLive.ts`, `worker/vitest.config.ts`, `worker/test/eventLive.test.ts`
- Modify: `worker/wrangler.jsonc`, `worker/src/env.ts`, `worker/src/index.ts`, `worker/package.json`

**Interfaces:**
- Produces:
  - `export const TOPICS = ["leaderboard","gallery","challenges","event"] as const; export type Topic = typeof TOPICS[number];`
  - `export function parseTopics(input: unknown): Topic[]` — tiene solo stringhe presenti in `TOPICS`, senza duplicati; input non-array → `[]`.
  - `export class EventLive extends DurableObject<Env>` con `fetch(request)` che gestisce:
    - `GET /connect` con header `Upgrade: websocket` e header `X-Live-User` = JSON `{userId, role}` → `101` con socket accettata via `this.ctx.acceptWebSocket(server)` e `serializeAttachment({userId, role, topics: []})`.
    - `POST /publish` body `{topics: string[]}` → `204`; invia `{"type":"changed","topics":[intersezione]}` a ogni socket con intersezione non vuota.
    - `POST /close` → `204`; invia `{"type":"event_deleted"}` a tutte e le chiude (code `4000`, reason `event_deleted`).
  - `webSocketMessage(ws, msg)`: se JSON `{type:"subscribe",topics}` → aggiorna attachment con `parseTopics(topics)`; altro → ignora.
  - Nel costruttore: `this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping","pong"))`.
  - `Env.EVENT_LIVE: DurableObjectNamespace<EventLive>`.

- [ ] **Step 1: Infrastruttura test.** In `worker/` aggiungi devDependencies `vitest` e `@cloudflare/vitest-pool-workers` (versione più recente, con la `vitest` richiesta come peer dal pool), script `"test": "vitest run"`. Crea `vitest.config.ts` seguendo il README della versione installata, puntando a `./wrangler.jsonc` e con binding `JWT_SECRET: "test-secret"`. Se il caricamento fallisce perché manca `../frontend/dist`, sovrascrivi gli assets nella config miniflare dei test oppure crea la cartella vuota nel setup: scegli quello supportato dalla versione installata.
- [ ] **Step 2: Config DO.** In `wrangler.jsonc` aggiungi `"durable_objects": {"bindings": [{"name": "EVENT_LIVE", "class_name": "EventLive"}]}` e `"migrations": [{"tag": "v1", "new_sqlite_classes": ["EventLive"]}]`. Aggiorna `Env` ed esporta `EventLive` da `src/index.ts` (`export { EventLive } from "./live/EventLive"`).
- [ ] **Step 3: Scrivi i test falliti** in `test/eventLive.test.ts` (helper: `connect(stub, userId)` che fa `stub.fetch("http://do/connect", {headers:{Upgrade:"websocket","X-Live-User":JSON.stringify({userId, role:"guest"})}})`, `ws.accept()`, raccoglie i messaggi in un array):
  - `parseTopics(["leaderboard","foo","leaderboard",3])` → `["leaderboard"]`; `parseTopics("x")` → `[]`.
  - `publish consegna solo agli iscritti al topic`: A subscribe `["leaderboard"]`, B subscribe `["gallery"]`; publish `["leaderboard"]` → A riceve `{"type":"changed","topics":["leaderboard"]}`, B niente.
  - `publish manda solo l'intersezione`: A subscribe `["leaderboard","gallery"]`; publish `["gallery","challenges"]` → A riceve `topics:["gallery"]`.
  - `subscribe sostituisce i topic`: A subscribe `["leaderboard"]` poi `["gallery"]`; publish `["leaderboard"]` → niente.
  - `messaggi malformati ignorati`: A invia `"{oops"` e `{"type":"boh"}`; la socket resta aperta e riceve un publish successivo.
  - `close notifica e chiude tutte`: A e B (anche senza subscribe) ricevono `{"type":"event_deleted"}` e un evento `close` con code `4000`.
  - `connect senza Upgrade` → `426`.
- [ ] **Step 4:** `cd worker && npm test` → FAIL (moduli mancanti).
- [ ] **Step 5: Implementa** `topics.ts` ed `EventLive.ts`. Le socket si leggono con `this.ctx.getWebSockets()`; i topic dall'attachment. Nessun dato di gioco e nessuna query DB nel DO.
- [ ] **Step 6:** `npm test` → PASS; `npm run typecheck` → nessun errore.
- [ ] **Step 7:** `git add worker && git commit -m "feat(live): Durable Object EventLive con topic per socket"`

---

### Task 2: Ticket, route `/api/live` e helper `publish`

**Files:**
- Create: `worker/src/live/ticket.ts`, `worker/src/live/publish.ts`, `worker/src/routes/live.ts`, `worker/test/live.test.ts`
- Modify: `worker/src/index.ts`

**Interfaces:**
- Consumes: `EventLive` e i suoi path `/connect`, `/publish`, `/close` (Task 1); `resolveUser` e `sign`/`jwtKey` di `src/auth.ts` (esporta il necessario oppure firma con `jose` nello stesso modo, HS256).
- Produces:
  - `createLiveTicket(cfg: Config, user: {id: string; event_id: string; role: string}): Promise<string>` — 60 s.
  - `verifyLiveTicket(cfg: Config, token: string): Promise<{userId: string; eventId: string; role: string} | null>` — `null` se firma errata, scaduto o `type !== "live"`.
  - `publish(c: Context<AppEnv>, eventId: string, topics: Topic[]): void` — `waitUntil(stub.fetch("http://do/publish", …))`, errori solo loggati; se `c.env.EVENT_LIVE` manca → no-op.
  - `closeEventLive(c: Context<AppEnv>, eventId: string): void` — come sopra su `/close`.
  - `POST /api/live/ticket?event_id=…` (`requireUser`) → `{ticket: string}`.
  - `GET /api/live?ticket=…` → ticket non valido `401` JSON `{detail}`; senza `Upgrade: websocket` `426`; altrimenti inoltra a `env.EVENT_LIVE.get(idFromName(eventId))` su `/connect` con header `X-Live-User`.

- [ ] **Step 1: Test falliti** in `test/live.test.ts`:
  - `ticket valido`: `verifyLiveTicket(cfg, await createLiveTicket(cfg,{id:"u1",event_id:"e1",role:"guest"}))` → `{userId:"u1",eventId:"e1",role:"guest"}`.
  - `ticket scaduto`: con `vi.useFakeTimers()` avanza 61 s → `null`.
  - `JWT account non è un ticket`: `verifyLiveTicket(cfg, await createJwt(cfg,"a1"))` → `null`.
  - `upgrade con ticket falso` via `SELF.fetch("http://x/api/live?ticket=abc",{headers:{Upgrade:"websocket"}})` → `401`.
  - `end-to-end`: upgrade con ticket valido per `e1` → `101`; invia subscribe `["gallery"]`; poi `env.EVENT_LIVE.get(env.EVENT_LIVE.idFromName("e1")).fetch("http://do/publish",{method:"POST",body:JSON.stringify({topics:["gallery"]})})` → la socket riceve `changed`.
  - `publish non lancia se il DO fallisce`: con un `c` finto il cui `env.EVENT_LIVE.get()` ritorna uno stub con `fetch` che rigetta, `publish(c,"e1",["gallery"])` non lancia e la promise passata a `waitUntil` si risolve.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3: Implementa** `ticket.ts`, `publish.ts`, `routes/live.ts`; monta `app.route("/api/live", live)` prima del 404 `/api/*`. La route di upgrade non deve toccare il DB (il middleware apre la connessione solo alla prima query, quindi va bene).
- [ ] **Step 4:** `npm test` → PASS; `npm run typecheck` → ok.
- [ ] **Step 5:** `git commit -am "feat(live): ticket, endpoint /api/live e helper publish"` (aggiungi i file nuovi).

---

### Task 3: Pubblicazione dalle route che scrivono

**Files:**
- Modify: `worker/src/routes/auth.ts` (`POST /join`), `worker/src/routes/submissions.ts`, `worker/src/routes/challenges.ts`, `worker/src/routes/events.ts`, `worker/src/routes/admin.ts`

**Interfaces:**
- Consumes: `publish`, `closeEventLive` (Task 2).

- [ ] **Step 1: Aggiungi le chiamate** dopo la scrittura riuscita (dopo il commit della transazione, prima del `return`), con l'`event_id` dell'utente/evento coinvolto:

| Route | Chiamata |
|---|---|
| `POST /api/auth/join` (solo se crea un nuovo `users` nell'evento) | `publish(c, eventId, ["leaderboard"])` |
| `POST /api/submissions/photo`, `/photos`, `DELETE /photo/:id`, `POST /hunt/:id` | `["gallery","leaderboard"]` |
| `POST /api/submissions/quiz/:id`, `/vote/:id` | `["leaderboard"]` |
| `POST /api/challenges`, `/bulk`, `PATCH /:id`, `DELETE /:id` | `["challenges","leaderboard"]` |
| `PATCH /api/events/me` (solo se ha aggiornato qualcosa) | `["event"]` |
| `DELETE /api/events/me`, `DELETE /api/admin/events/:event_id` | `closeEventLive(c, eventId)` |
| `DELETE /api/admin/users/:account_id` | per ogni evento in cui l'account era `guest`: `["leaderboard"]`; con `delete_events=true`, per ogni partita eliminata (`admin.ts:199`): `closeEventLive` — raccogli gli id **prima** del DELETE |

- [ ] **Step 2: Controllo di completezza.** Esegui `grep -nE "INSERT INTO|UPDATE |DELETE FROM" worker/src -r` e verifica che ogni scrittura su `users`, `user_submissions`, `challenges`, `events` raggiungibile da una route abbia la sua chiamata (escluse sessioni, account, codici di verifica e reminder). Aggiungi quelle mancanti seguendo lo stesso criterio (punti/iscritti → `leaderboard`, foto → `gallery`, sfide → `challenges`, evento → `event`).
- [ ] **Step 3:** `npm test` e `npm run typecheck` → ok.
- [ ] **Step 4: Verifica manuale.** `npm run dev`; in un terminale apri una socket con un ticket reale (`POST /api/live/ticket` col token di un ospite, poi `npx wscat -c "ws://localhost:8000/api/live?ticket=…"`), invia `{"type":"subscribe","topics":["leaderboard"]}`; con un altro ospite invia una risposta quiz → la socket riceve `{"type":"changed","topics":["leaderboard"]}`.
- [ ] **Step 5:** `git commit -am "feat(live): pubblica gli avvisi dalle route che modificano i dati"`

---

### Task 4: Blocco delle modifiche a partita iniziata (backend)

**Files:**
- Create: `worker/src/gameLock.ts`, `worker/test/gameLock.test.ts`
- Modify: `worker/src/routes/challenges.ts`, `worker/src/routes/events.ts`, `worker/src/serializers.ts`, `worker/src/routes/auth.ts` (`/me`), `worker/src/routes/dashboard.ts` (dettaglio evento)

**Interfaces:**
- Produces:
  - `isGameStarted(event: {enable_timer: boolean; start_time: Date | null}, hasGuestSubmission: boolean, now: Date): boolean`
  - `loadGameStarted(db: Db, event: Row): Promise<boolean>` — una query `EXISTS` su `user_submissions` ⨝ `users` (role `guest`) ⨝ `challenges` (`event_id`).
  - `assertChallengesEditable(db: Db, eventId: string): Promise<void>` — lancia `ApiError(409, "La partita è iniziata: le sfide non sono più modificabili.")`.
  - `eventOut(event: Row, gameStarted?: boolean)` — aggiunge `game_started` solo se il parametro è passato.

- [ ] **Step 1: Test falliti** `gameLock.test.ts`:
  - timer attivo, `now` prima di `start_time`, nessuna submission → `false`;
  - timer attivo, `now` = `start_time` → `true`; `now` dopo `end_time` → `true`;
  - timer attivo ma `start_time` null, submission ospite presente → `true`;
  - timer disattivo, nessuna submission → `false`; con submission → `true`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3: Implementa** `gameLock.ts`. Chiama `assertChallengesEditable` all'inizio di `POST /`, `POST /bulk`, `PATCH /:id`, `DELETE /:id` in `challenges.ts`. In `PATCH /api/events/me`, se `start_time` o `enable_timer` sono tra gli `updates` e la partita è iniziata → stesso 409 (`end_time` e nomi restano modificabili).
- [ ] **Step 4: Esponi `game_started`** passando `await loadGameStarted(db, event)` a `eventOut` in `GET /api/events/me`, `GET /api/auth/me` (l'evento corrente) e `GET /api/dashboard/events/:event_id`.
- [ ] **Step 5:** `npm test` → PASS; `npm run typecheck` → ok.
- [ ] **Step 6: Verifica manuale** su `wrangler dev`: evento senza timer, un ospite carica una foto, poi `PATCH /api/challenges/:id` come sposo → `409` col messaggio esatto; `PATCH /api/events/me` con solo `end_time` → `200`.
- [ ] **Step 7:** `git commit -am "feat: blocca le modifiche alle sfide a partita iniziata"` (con i file nuovi).

---

### Task 5: `LiveClient` (frontend, logica pura) + infrastruttura di test

**Files:**
- Create: `frontend/src/lib/liveClient.js`, `frontend/src/lib/liveClient.test.js`, `frontend/vitest.config.js`
- Modify: `frontend/package.json` (devDependency `vitest`, script `"test": "vitest run"`)

**Interfaces:**
- Produces: `export class LiveClient`
  - `constructor({ getTicket: () => Promise<string>, url: (ticket) => string, onChanged: (topics: string[]) => void, onEventDeleted: () => void, WebSocketImpl = globalThis.WebSocket, debounceMs = 800, pingMs = 30000, random = Math.random })`
  - `connect(): void` — idempotente; chiede il ticket e apre la socket. All'apertura invia `subscribe` con i topic correnti; se non è la prima apertura chiama anche `onChanged(topics correnti)`.
  - `disconnect(): void` — chiude senza programmare riconnessioni.
  - `setTopics(topics: string[]): void` — memorizza e, se aperta, invia `subscribe`.
  - Messaggio `changed` → accumula i topic; dopo `debounceMs` chiama **una volta** `onChanged([...insieme])`.
  - Messaggio `event_deleted` → `onEventDeleted()` e nessuna riconnessione.
  - Chiusura non richiesta (o `getTicket` che rigetta) → riconnessione dopo `min(30000, 1000·2^n)` con jitter (±20 % via `random`); il contatore si azzera all'apertura.
  - Ping: invia `"ping"` ogni `pingMs` mentre è aperta.

- [ ] **Step 1: Test falliti** con `vi.useFakeTimers()` e una `FakeWebSocket` (registra `sent`, espone `open()`, `message(data)`, `serverClose()`):
  - `invia subscribe all'apertura con i topic correnti`;
  - `setTopics a socket aperta invia subscribe` con i nuovi topic;
  - `raggruppa gli avvisi`: tre `changed` (`leaderboard`, `leaderboard`, `gallery`) in 500 ms → dopo 800 ms `onChanged` chiamato **una volta** con `["leaderboard","gallery"]`;
  - `riconnessione rimanda subscribe e fa refresh`: `serverClose()` → dopo 1 s nuova socket; alla sua `open()` invia `subscribe` con i topic correnti e chiama `onChanged(topics correnti)`;
  - `backoff`: chiusure consecutive senza apertura → attese 1 s, 2 s, 4 s … fino a un tetto di 30 s (con `random` fisso a 0.5 = nessun jitter);
  - `disconnect non riconnette`; `event_deleted chiama onEventDeleted e non riconnette`;
  - `ping ogni 30 s`.
- [ ] **Step 2:** `cd frontend && npm test` → FAIL.
- [ ] **Step 3: Implementa** `liveClient.js`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** `git commit -m "feat(live): client WebSocket con debounce e riconnessione"` (con i file nuovi e `package*.json`).

---

### Task 6: Collegamento nel frontend e rimozione del polling

**Files:**
- Create: `frontend/src/lib/live.svelte.js`
- Modify: `frontend/src/lib/api.js`, `frontend/src/lib/state.svelte.js`, `frontend/src/routes/(game)/partita/[code]/+layout.svelte`, pagine `leaderboard`, `gallery`, `quiz`, `hunt`, `home` sotto `(game)/partita/[code]/`, `frontend/src/components/DashboardView.svelte`

**Interfaces:**
- Consumes: `LiveClient` (Task 5); `POST /api/live/ticket`, `GET /api/live` (Task 2).
- Produces:
  - `api.getLiveTicket(eventId: string, accountToken?: string): Promise<{ticket: string}>` — con `accountToken`, header `Authorization: Bearer <accountToken>` esplicito (vedi Review Focus 1).
  - `live.svelte.js`: `export const live = { start(eventId, { accountToken } = {}), stop(), addTopics(owner: symbol, topics: string[]), removeTopics(owner: symbol), on(topic, handler) }` — un `LiveClient` alla volta; `start` con un `eventId` diverso chiude il precedente; i topic correnti sono l'unione dei topic di tutti gli owner; `on` registra la funzione di refresh per topic (handler multipli ammessi).
  - `useLiveTopics(topics: string[])` — da chiamare nello `<script>` di un componente: in un `$effect` fa `addTopics` e al cleanup `removeTopics`.
  - URL socket: `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/live?ticket=…` (in dev il proxy vite su `/api` deve inoltrare i WebSocket: aggiungi `ws: true` in `frontend/vite.config.js` se manca).
  - `visibilitychange`: hidden → `client.disconnect()`; visible → `client.connect()` e `onChanged(topics correnti)`.

- [ ] **Step 1:** Implementa `getLiveTicket` e `live.svelte.js`. Handler registrati in `live.svelte.js` verso `appState`: `leaderboard` → `refreshLeaderboard()`, `gallery` → `refreshGallery()`, `challenges` → `refreshChallenges()`, `event` → `refreshUser(true)` (ricalcola `appState.event` e quindi il timer).
- [ ] **Step 2:** `onEventDeleted` → `appState.alert("Gli sposi hanno chiuso questa partita", { title: "Partita chiusa" })`, poi pulizia della sessione di gioco (`_clearGame`/`_clearEventSession` come fa oggi l'uscita dalla partita) e `goto` alla dashboard utente se `appState.hasAccount`, altrimenti alla home del sito (usa `ROUTES`/`dashboardUrl` di `routes.js`).
- [ ] **Step 3:** Nel layout del gioco sostituisci `startPolling`/`stopPolling` con `live.start(appState.event.id)` / `live.stop()` e `useLiveTopics(["event"])`. Nelle pagine: leaderboard `["leaderboard"]`, gallery `["gallery"]`, quiz/hunt `["challenges"]`, home `["challenges"]` solo se mostra le sfide.
- [ ] **Step 4:** Rimuovi da `state.svelte.js` `pollingTimer`, `startPolling`, `stopPolling` (anche la chiamata in `_clearGame`) e in `refreshUser` il confronto punti con `showToast` (il parametro `silent` può restare o sparire, a tua scelta coerente con i chiamanti).
- [ ] **Step 5:** `DashboardView.svelte`: quando c'è un `selectedEvent` aperto, `live.start(selectedEvent.event.id, { accountToken: localStorage.getItem("fm_jwt_token") })` e topic `["leaderboard","gallery","challenges","event"]` con handler che ricarica dettaglio e submissions **senza** `detailLoading` (niente spinner); `goBack` e uscita dalla pagina → `live.stop()`. Estrai il caricamento di `openEvent` in una funzione `reloadDetail(eventId, { silent })`.
- [ ] **Step 6:** `npm run build` → ok; `npm test` → PASS.
- [ ] **Step 7: Verifica manuale** con due browser su `wrangler dev` + `vite dev`: A in classifica, B risponde a un quiz → A si aggiorna entro ~1 s senza refresh visibile; A in galleria, B risponde a un quiz → nessuna richiesta di rete su A (DevTools); A mette la tab in background e B carica una foto → al ritorno A vede la foto; il `DELETE` della partita come sposo porta A al messaggio e fuori dal gioco; la dashboard dello sposo si aggiorna quando B carica una foto. Nel tab Network non ci sono più richieste ogni 20 s.
- [ ] **Step 8:** `git commit -am "feat(live): collega il client live alle pagine e rimuovi il polling"` (con i file nuovi).

---

### Task 7: Animazioni della classifica

**Files:**
- Create: `frontend/src/lib/leaderboardDiff.js`, `frontend/src/lib/leaderboardDiff.test.js`
- Modify: `frontend/src/components/LeaderboardView.svelte`

**Interfaces:**
- Produces: `computeGains(prev: {id: string, total_points: number}[] | null, next: same[]): Map<string, number>` — per ogni id presente in entrambe con punti aumentati, la differenza; `prev` null o vuoto → mappa vuota (primo caricamento).

- [ ] **Step 1: Test falliti**: `computeGains(null, [...])` → vuota; `[{a,10},{b,5}]` → `[{a,10},{b,15}]` → `{b:10}`; utente nuovo in `next` → non incluso; punti diminuiti → non inclusi.
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** implementa. **Step 4:** `npm test` → PASS.
- [ ] **Step 5: UI** in `LeaderboardView.svelte`:
  - `{#each}` con chiave `id` e `animate:flip` (durata ~400 ms) per le righe che si spostano;
  - punti con `Tween` di `svelte/motion` (conteggio ~600 ms);
  - per ogni id in `computeGains(precedente, attuale)`: classe di evidenziazione e badge `+N` accanto al nome per ~2 s;
  - contatore "invitati iscritti" con `Tween`;
  - durate a 0 e nessuna evidenziazione animata con `prefers-reduced-motion: reduce` (`matchMedia`).
  Il podio, se è renderizzato separatamente dal resto della classifica, deve comunque mostrare punti contati ed evidenziazione.
- [ ] **Step 6: Verifica manuale**: B guadagna punti e supera A → su un terzo browser la riga di B scorre sopra quella di A, i punti contano, compare `+N` per ~2 s; al primo ingresso nella pagina nessuna evidenziazione.
- [ ] **Step 7:** `git commit -am "feat(classifica): animazioni dei cambiamenti live"` (con i file nuovi).

---

### Task 8: Animazioni della galleria e foto aperta mantenuta

**Files:**
- Create: `frontend/src/lib/galleryRetain.js`, `frontend/src/lib/galleryRetain.test.js`
- Modify: `frontend/src/components/GalleryView.svelte`

**Interfaces:**
- Produces: `withRetainedPhoto(photos: {id}[], retained: {photo, index} | null): {id}[]` — se `retained` è null o la foto è già presente → `photos` invariato (stesso riferimento); altrimenti una copia con `retained.photo` reinserita a `min(retained.index, photos.length)`.

- [ ] **Step 1: Test falliti**: null → stesso array; foto presente → stesso array; foto rimossa → reinserita al suo indice; indice oltre la lunghezza → in coda.
- [ ] **Step 2–4:** FAIL → implementa → PASS.
- [ ] **Step 5: UI** in `GalleryView.svelte`:
  - all'apertura del lightbox memorizza `retained = { photo, index }`; spostandosi su un'altra foto o chiudendo, `retained = null`;
  - una lista derivata `visiblePhotos = withRetainedPhoto(appState.galleryPhotos, retained)` sostituisce `appState.galleryPhotos` in griglia, `activeIndex`, `hasPrev/hasNext`, `showPhotoAt`;
  - elementi della griglia con chiave `id`: `in:` dissolvenza + scale da ~0.92 (~350 ms), `out:fade` (~300 ms), solo dopo il primo caricamento (flag impostato dopo il primo render con dati); niente transizioni con `prefers-reduced-motion`;
  - la cancellazione fatta dall'utente stesso (`GalleryView.svelte:280`) continua a funzionare come oggi.
- [ ] **Step 6: Verifica manuale**: A apre a schermo intero la foto di B, B la cancella → A continua a vederla e può scorrere avanti/indietro; chiudendo, la foto esce dalla griglia in dissolvenza. B carica una foto → su A entra in cima con l'animazione.
- [ ] **Step 7:** `git commit -am "feat(galleria): animazioni live e foto aperta mantenuta"` (con i file nuovi).

---

### Task 9: "+X punti" al posto del toast

**Files:**
- Create: `frontend/src/components/PointsBurst.svelte`
- Modify: `frontend/src/lib/state.svelte.js`, `frontend/src/routes/+layout.svelte`, tutti i chiamanti di `showToast(..., points)` con punti > 0 (almeno `HuntView.svelte:36`, `GalleryView.svelte:224`, e quelli di quiz/voto: trovali con `grep -rn "showToast(" frontend/src`)

**Interfaces:**
- Produces:
  - `appState.pointsBurst = $state(null)` con forma `{ id: number, points: number }`.
  - `appState.celebratePoints(points: number): void` — se `points > 0`: imposta `pointsBurst` (id nuovo a ogni chiamata) e chiama `fireCelebration()`; nessun toast.
  - `showToast(text, type)` — il parametro `points` e la chiamata a `fireCelebration` escono da `showToast`.

- [ ] **Step 1:** Implementa `celebratePoints` e `PointsBurst.svelte`, montato in `src/routes/+layout.svelte` accanto a `<Toast />`: testo `+{points}` grande al centro, font serif del tema e colore `--wine`, sottotitolo "punti"; sale e svanisce in ~1,5 s, `pointer-events: none`; con `prefers-reduced-motion` appare e scompare senza movimento. Una nuova chiamata durante l'animazione la riavvia (chiave su `id`).
- [ ] **Step 2:** Sostituisci ogni `showToast(testo, 'success', punti)` con punti > 0 con **solo** `appState.celebratePoints(punti)`: nessun toast di testo in quei casi (decisione dell'utente). I toast di upload senza punti (`'Foto aggiunta alla galleria!'`) restano.
- [ ] **Step 3:** Rimuovi il supporto `points` da `Toast.svelte` se non più usato.
- [ ] **Step 4:** `npm run build` → ok. **Verifica manuale**: completa una missione, carica 3 foto (deve comparire `+30`), rispondi a un quiz con punti → "+X" e coriandoli, nessun toast.
- [ ] **Step 5:** `git commit -am "feat: animazione +X punti al posto del toast"` (con il file nuovo).

---

### Task 10: Blocco delle modifiche nell'interfaccia degli sposi

**Files:**
- Modify: `frontend/src/components/OnboardingSetup.svelte`, `frontend/src/routes/(site)/partita/[code]/setup/+page.svelte` (se serve passare il flag), `frontend/src/components/DashboardView.svelte` (se mostra comandi di modifica delle sfide)

**Interfaces:**
- Consumes: `event.game_started` da `GET /api/auth/me`, `GET /api/events/me`, `GET /api/dashboard/events/:id` (Task 4).

- [ ] **Step 1:** Con `game_started === true`: i comandi che chiamano `api.updateChallenge` e `api.createChallengesBulk` (e qualsiasi creazione/cancellazione) sono disattivati, con un banner che mostra il messaggio esatto `La partita è iniziata: le sfide non sono più modificabili.`. In `CreateEventView` (creazione di un evento nuovo) non cambia nulla: lì `game_started` è sempre falso.
- [ ] **Step 2:** Se il backend risponde 409 (es. partita iniziata mentre la pagina era aperta), mostra il `detail` ricevuto come errore e ricarica l'evento per disattivare i comandi.
- [ ] **Step 3:** `npm run build` → ok. **Verifica manuale**: evento con una submission ospite → la pagina setup mostra il banner e i comandi disattivati; evento nuovo → tutto modificabile.
- [ ] **Step 4:** `git commit -am "feat: disattiva la modifica delle sfide a partita iniziata"`

---

### Task 11: Documentazione e verifica su Dokploy

**Files:**
- Modify: `MIGRAZIONE_NEON_CLOUDFLARE.md`, `TODO`, `Dockerfile` (solo se necessario)

- [ ] **Step 1:** In `MIGRAZIONE_NEON_CLOUDFLARE.md` aggiungi una sezione "Aggiornamenti live": binding `EVENT_LIVE`, migration `v1` con `new_sqlite_classes`, nessun segreto nuovo, nessuna operazione manuale oltre al `wrangler deploy`.
- [ ] **Step 2:** Nel `TODO` segna `[P] WEBSOCKET`.
- [ ] **Step 3: Verifica Docker locale:** `docker build -t fm-live . && docker run --rm -p 8000:8000 --env-file worker/.dev.vars fm-live`, poi ripeti a mano lo scenario classifica live del Task 6 su `http://localhost:8000` (i WebSocket passano dalla stessa porta). Se il DO non parte o non conserva lo stato tra riavvii in modo accettabile, documenta il comportamento: lo stato del DO è solo l'elenco delle socket e si ricostruisce alle riconnessioni.
- [ ] **Step 4:** Dì all'utente di verificare che il proxy di Dokploy (Traefik) inoltri gli upgrade WebSocket; di solito è attivo di default.
- [ ] **Step 5:** `git commit -am "docs: aggiornamenti live in guida migrazione e TODO"`
