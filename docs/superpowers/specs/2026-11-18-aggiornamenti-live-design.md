# Aggiornamenti live (WebSocket) — Design

Data: 2026-11-18 · Branch: `websocket`

## 1. Intento

Oggi chi è dentro una partita vede le modifiche degli altri solo grazie a un polling ogni 20 s
(`appState.startPolling()` in `frontend/src/lib/state.svelte.js`, avviato dal layout del gioco) o ricaricando
la pagina. Vogliamo che le modifiche fatte da **altri utenti** arrivino **subito**, ma **solo a chi sta
guardando la pagina interessata**. Chi è su un'altra pagina non riceve nulla: quando ci entra scarica i dati
freschi come già fa oggi.

Esempio: Mario è sulla classifica, Luca completa una missione → la riga di Luca sale con un'animazione sullo
schermo di Mario, senza refresh visibile. Anna, che è in galleria, non riceve niente per quell'azione.

## 2. Obiettivi / non-obiettivi / anti-obiettivi

**Obiettivi**
- Aggiornamenti istantanei per: classifica (punti e numero iscritti), galleria, lista sfide, impostazioni
  evento (timer), dashboard dettagliata del matrimonio (`/dashboard_utente`).
- Eliminare il polling da 20 s del web.
- Animazioni che mostrano *cosa* è cambiato.
- Bloccare le modifiche degli sposi alle sfide una volta iniziata la partita (vedi §8).
- Sostituire il toast "+X punti" con un'animazione "+X" grande + coriandoli.

**Non-obiettivi**
- App Flutter (`mobile/`): esclusa, continua col suo polling. Il protocollo resta comunque generico.
- Avvisi personali ("hai guadagnato punti", "gli sposi hanno aggiunto un quiz") ricevuti dal live: **non** si fanno.
- Avviso "N nuove foto" in galleria quando si è scrollati in basso: rimandato.
- Pannello admin (`/admin`): non live.
- Schermata per gli sposi per modificare orari/timer dopo la creazione: oggi non esiste (`api.updateEvent` non è
  usata) e resta fuori (voce nel `TODO`). Il backend (blocco §8 + topic `event`) viene comunque fatto, quindi si
  verifica chiamando l'API direttamente; il frontend del §8 riguarda solo i comandi delle sfide.

**Anti-obiettivi (sarebbe un fallimento anche se "funziona")**
- Refresh visibile, spinner, salto dello scroll o ridisegno di tutte le immagini a ogni aggiornamento.
- Ricevere aggiornamenti per pagine che non si stanno guardando.
- Una sfida/foto che sparisce sotto le mani mentre la si sta usando o guardando.
- Un costo Cloudflare che cresce con il tempo di connessione (per questo: hibernation).

## 3. Vincoli

- Backend: Worker Cloudflare (Hono) in `worker/`. **Produzione futura: Cloudflare Workers.** Oggi i test girano
  su Dokploy con `wrangler dev` in Docker (`Dockerfile`): la soluzione deve funzionare in entrambi.
- Le istanze Worker non condividono memoria → serve un punto di raccolta per partita: **Durable Object**.
- Database Neon via `@neondatabase/serverless`; i punti (`users.total_points`) li aggiorna un trigger DB.
- Frontend SvelteKit (Svelte 5 runes), stato globale in `appState` (`frontend/src/lib/state.svelte.js`).
- Auth: due tipi di token (session token ospite o JWT account) risolti da `resolveUser(db, cfg, authorization, eventId)`
  in `worker/src/auth.ts`. La dashboard usa il JWT account + `event_id`.
- Il browser non permette header custom sull'apertura di un WebSocket.

## 4. Approcci considerati

| | Approccio | Pro | Contro |
|---|---|---|---|
| **A (scelto)** | WebSocket su un **Durable Object per partita con Hibernation API**; il client dichiara gli argomenti della pagina corrente e il server filtra | Una connessione sola per tutta la sessione; filtro per pagina lato server come richiesto; costo ~0 quando nessuno scrive; funziona anche in `wrangler dev` | Un po' più codice nel DO (mappa socket → argomenti) |
| B | Server-Sent Events via DO | `EventSource` semplice, riconnessione automatica | Riapertura a ogni cambio pagina; token in URL; niente hibernation → DO attivo e fatturato per tutta la festa |
| C | Come A ma filtro lato client | DO più semplice | Contraddice la richiesta: arrivano avvisi anche a chi non guarda la pagina |

Scartati: servizi esterni (Pusher/Ably — dipendenza a pagamento superflua), `LISTEN/NOTIFY` di Postgres
(richiede una connessione persistente impossibile da un Worker).

Scelto **A** dall'utente.

## 5. Decisioni prese con l'utente

1. **Messaggio = solo avviso** ("argomento X cambiato"), poi il client richiama in background le API esistenti
   (riusa autorizzazioni e privacy già presenti, nessuna logica duplicata). L'aggiornamento è invisibile: Svelte
   aggiorna solo ciò che cambia.
2. **Solo aggiornamenti causati da altri utenti**, e **solo per la pagina che si sta guardando**.
3. **Argomenti live**: classifica, galleria, iscritti (mostrati in classifica e nella dashboard dettagliata),
   sfide, evento.
4. **Dashboard dettagliata del matrimonio**: tutto ciò che mostra si aggiorna live.
5. **Cambio orari della partita** (`start_time`, `end_time`, `enable_timer`): gli ospiti connessi vedono subito
   il nuovo stato (es. il gioco si sblocca da solo).
6. **Partita eliminata**: messaggio "Gli sposi hanno chiuso questa partita" e ritorno alla dashboard/home.
7. **Foto aperta a schermo intero e cancellata dall'autore**: resta visibile finché l'utente non la chiude o
   scorre; poi sparisce dalla griglia con dissolvenza.
8. **Connessione persa**: riconnessione automatica; al rientro si ricaricano i dati della pagina corrente.
   Nessun polling di riserva.
9. **Tab in background** (`visibilitychange` → hidden): si chiude la connessione; al ritorno si riapre e si
   ricarica la pagina corrente.
10. **Toast "Hai guadagnato +X punti"** del polling: eliminato insieme al polling.
11. **Guadagno punti per azione propria**: **nessun toast**; al suo posto un "+X" grande al centro dello schermo
    che sale e svanisce (~1,5 s) insieme ai coriandoli. Vale per tutti i punti in cui oggi si chiama
    `showToast(..., points)` con punti > 0 (es. `HuntView.svelte:36`, `GalleryView.svelte:224`, quiz, voto).
12. **Animazioni classifica**: la riga scorre alla nuova posizione (FLIP), i punti salgono contando, la riga si
    illumina ~2 s con un badge "+N". Anche il numero di iscritti sale contando.
13. **Animazioni galleria**: foto nuove entrano in cima con dissolvenza + leggero ingrandimento, quelle cancellate
    escono in dissolvenza. Nessuna animazione al primo caricamento della pagina.
14. **Blocco modifiche sposi**: incluso in questo lavoro (§8).
15. `prefers-reduced-motion`: i cambiamenti avvengono senza animazioni *(scelta mia, comunicata)*.

## 6. Architettura

```
 Browser (pagina classifica)                Worker (Hono)                 Durable Object "EventLive" (1 per evento)
 ─────────────────────────                  ─────────────                 ────────────────────────────────────────
 POST /api/live/ticket  ───────────────▶  verifica token, rilascia ticket
 WS  /api/live?ticket=…  ──────────────▶  verifica ticket → idFromName(eventId) ──▶ acceptWebSocket(ws), attachment {userId, topics:[]}
 {"type":"subscribe","topics":[...]} ──────────────────────────────────────────────▶ aggiorna topics della socket

 Altro utente: POST /api/submissions/quiz/…  → risposta inviata
                                            waitUntil(publish(eventId, ["leaderboard"])) ──────────▶ invia
                                                                                                    {"type":"changed","topics":["leaderboard"]}
                                                                                                    solo alle socket iscritte a quel topic
 ◀──────────────────────────────────────────────────────────────────────────────────────────────── 
 debounce ~800 ms → appState.refreshLeaderboard() → animazioni
```

### 6.1 Durable Object `EventLive` (nuovo, `worker/src/live.ts`)
- Uno per evento: `env.EVENT_LIVE.idFromName(eventId)`.
- Usa la **WebSocket Hibernation API** (`this.ctx.acceptWebSocket`, `webSocketMessage`, `webSocketClose`,
  `serializeAttachment`/`deserializeAttachment` per `{ userId, role, topics }`), così lo stato sopravvive
  all'ibernazione.
- Keep-alive con `this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping","pong"))`
  (non risveglia il DO).
- Endpoint interni (chiamati solo dal Worker via stub, mai esposti):
  - `GET /connect` (upgrade) → accetta la socket con attachment già verificato dal Worker.
  - `POST /publish` `{ topics: string[] }` → invia `changed` alle socket con almeno un topic in comune.
  - `POST /close` `{ reason: "event_deleted" }` → invia `{type:"event_deleted"}` a **tutte** le socket e le chiude.
- Messaggi client → server: `{"type":"subscribe","topics":[...]}` (sostituisce l'insieme corrente). Topic
  sconosciuti ignorati. Messaggi malformati ignorati.
- Nessun dato di gioco nel DO, nessuna query DB.

### 6.2 Configurazione (`worker/wrangler.jsonc`, `worker/src/env.ts`)
- Binding `durable_objects: [{ name: "EVENT_LIVE", class_name: "EventLive" }]`.
- Migration `{ tag: "v1", new_sqlite_classes: ["EventLive"] }` (DO SQLite-backed: disponibili anche sul piano free).
- Export della classe da `worker/src/index.ts`.
- Verificare che `wrangler dev` nel container Dokploy persista/avvii correttamente il DO (lo stato DO è in
  `.wrangler`, già montato come volume).

### 6.3 Autenticazione della connessione (ticket)
- `POST /api/live/ticket?event_id=…` con l'header `Authorization` normale. Usa `resolveUser` (funziona sia per
  session token sia per JWT account + `event_id`, quindi copre gioco **e** dashboard). **Attenzione**:
  `getStoredToken` in `frontend/src/lib/api.js` preferisce il session token di gioco (`fm_auth_token`), che ignora
  `event_id`; dalla dashboard la richiesta del ticket deve mandare esplicitamente il JWT account, altrimenti si
  ottiene un ticket per la partita sbagliata. Risponde con un JWT
  firmato con `JWT_SECRET`, `type:"live"`, `sub=userId`, `eid=eventId`, `role`, **scadenza 60 s**.
- `GET /api/live?ticket=…` (upgrade): il Worker verifica il ticket e inoltra la richiesta allo stub del DO
  dell'evento. Ticket non valido → 401 prima di toccare il DO.
- Il ticket finisce nell'URL, ma è monouso di fatto (scade in 60 s) e non è il token di sessione: il token vero
  non compare mai negli URL/log. *(Scelta mia: realizza il "token fuori dall'URL" detto all'utente, ma con
  verifica nel Worker invece che nel DO, così il DO non apre connessioni al DB.)*
- La connessione non viene ri-verificata dopo l'apertura: se la sessione scade, la socket resta viva fino alla
  prossima riconnessione (accettabile: riceve solo avvisi, i dati passano dalle API che verificano sempre).

### 6.4 Pubblicazione (`worker/src/live.ts` → `publish(c, eventId, topics)`)
- Helper usato dalle route **dopo** la scrittura riuscita, in `c.executionCtx.waitUntil(...)`: non rallenta la
  risposta e un errore del DO non fa fallire la richiesta (solo `console.error`).
- **Nessuna esclusione dell'autore** *(scelta mia)*: l'avviso arriva a tutte le socket iscritte, comprese quelle
  dell'autore. Così si coprono gli stessi utenti su più schermi (es. sposi con dashboard su un dispositivo e gioco
  su un altro). Per lo schermo che ha fatto l'azione il refresh è invisibile (dati già aggiornati); il "+X" è
  legato all'azione propria, non al live, quindi non si duplica. Il campo `exceptUserId` di `/publish` non serve.

### 6.5 Topic e mappa mutazione → topic

| Topic | Significa | Chi ricarica cosa |
|---|---|---|
| `leaderboard` | punti cambiati o iscritti cambiati | `refreshLeaderboard()` (+ dashboard: ricarica dettaglio) |
| `gallery` | foto aggiunte/cancellate | `refreshGallery()` (+ dashboard) |
| `challenges` | sfide create/modificate/cancellate | `refreshChallenges()` |
| `event` | impostazioni evento cambiate (orari/timer/nomi) | `refreshUser(true)` / ricarica evento → ricalcolo timer |

| Route (file) | Topic pubblicati |
|---|---|
| `POST /api/auth/join` — nuovo ospite in un evento (`routes/auth.ts`) | `leaderboard` |
| `POST /api/submissions/photo`, `/photos` | `gallery`, `leaderboard` |
| `DELETE /api/submissions/photo/:id` | `gallery`, `leaderboard` |
| `POST /api/submissions/hunt/:id` | `gallery`, `leaderboard` |
| `POST /api/submissions/quiz/:id`, `/vote/:id` | `leaderboard` |
| `POST/PATCH/DELETE /api/challenges…`, `/bulk` | `challenges`, `leaderboard` (patch/delete ricalcolano punti) |
| `PATCH /api/events/me` | `event` |
| `DELETE /api/events/me`, `DELETE /api/admin/events/:id` | `close` (event_deleted) |
| `DELETE /api/admin/users/:account_id` | `leaderboard` per ogni evento in cui l'utente era ospite; con `delete_events=true`, `close` (event_deleted) per ogni partita eliminata (`routes/admin.ts:199`) |

Il builder deve controllare con `grep` che non esistano altre route che scrivono `users`, `user_submissions`,
`challenges`, `events` e aggiungerle alla tabella.

### 6.6 Frontend

**Nuovo modulo `frontend/src/lib/live.svelte.js`** (client unico, singleton):
- `connect(eventId)` / `disconnect()`; `setTopics(topics)` invia `subscribe` (anche dopo ogni riconnessione).
- Registro `topic → handler di refresh`; quando arriva `changed`, accumula i topic e dopo un **debounce ~800 ms**
  esegue una volta sola il refresh di ciascun topic accumulato.
- Riconnessione con backoff esponenziale (1 s → max 30 s, con jitter). Ad ogni (ri)connessione **successiva
  alla prima** esegue il refresh di tutti i topic correnti (decisione 8).
- `visibilitychange`: hidden → `disconnect()`; visible → `connect()` + refresh topic correnti (decisione 9).
- Ping `"ping"` ogni ~30 s per tenere viva la connessione dietro proxy/NAT.
- `event_deleted` → messaggio "Gli sposi hanno chiuso questa partita" (ConfirmDialog o pagina dedicata) e
  `goto` alla dashboard utente se ha un account, altrimenti alla home del sito.

**Chi si iscrive a cosa** (le pagine dichiarano i topic con un piccolo helper, es. `useLiveTopics([...])` in un
`$effect` che li rimuove all'uscita):

| Pagina | Topic |
|---|---|
| Layout gioco `(game)/partita/[code]/+layout.svelte` | `event` (vale su tutte le pagine: decide se il gioco è bloccato) |
| `leaderboard` | `leaderboard` |
| `gallery` | `gallery` |
| `quiz`, `hunt` (e `home` se mostra sfide) | `challenges` |
| `(site)/dashboard_utente` con un evento aperto in dettaglio | `leaderboard`, `gallery`, `challenges`, `event` → ricarica il dettaglio (`GET /api/dashboard/events/:id`) |

La dashboard si connette solo quando è aperto il dettaglio di un evento, all'evento aperto; se ne apre un altro
cambia connessione.

**Rimozioni**: `startPolling`/`stopPolling`/`pollingTimer` da `state.svelte.js` e il loro uso nel layout; la
logica di confronto punti + toast in `refreshUser`.

**Animazioni** (tutte disattivate con `prefers-reduced-motion: reduce`):
- *Classifica* (`LeaderboardView.svelte`): `{#each}` con chiave `id` + `animate:flip`; punti con `Tween` di
  `svelte/motion`; confronto con la classifica precedente → per gli utenti con punti aumentati, classe di
  evidenziazione ~2 s e badge "+N". Contatore iscritti con `Tween`. Nessuna evidenziazione al primo caricamento.
- *Galleria* (`GalleryView.svelte`): ingresso `in:` dissolvenza + leggero scale, uscita `out:fade`, solo per
  cambi successivi al primo caricamento. Lightbox: se la foto aperta sparisce dai dati, resta mostrata (copia
  locale) finché l'utente non chiude/scorre; poi si applica la rimozione. L'indice si ricava già dall'id
  (`GalleryView.svelte:16`).
- *"+X punti"*: nuovo componente overlay (es. `PointsBurst.svelte`) montato nel layout radice, comandato da
  `appState.celebratePoints(n)` che lancia anche `fireCelebration()`. `showToast(..., points)` non mostra più
  toast quando `points > 0`: tutti i chiamanti con punti passano a `celebratePoints(n)` senza toast. Stile: font
  serif e colori del tema esistente (`--wine` ecc.).

## 7. Formato messaggi (versione 1)

Server → client:
```json
{ "type": "changed", "topics": ["leaderboard", "gallery"] }
{ "type": "event_deleted" }
```
Client → server:
```json
{ "type": "subscribe", "topics": ["leaderboard"] }
"ping"            // risposta automatica "pong"
```

## 8. Blocco modifiche degli sposi

**Quando la partita è "iniziata"** (`isGameStarted(db, event)` in un helper backend condiviso):
- se `enable_timer` e `start_time` impostato → da `start_time` in poi (anche dopo `end_time`);
- altrimenti → appena esiste almeno una `user_submission` di un utente con ruolo `guest` per una sfida dell'evento.

**Cosa si blocca** (risposta `409` o `422` con messaggio "La partita è iniziata: le sfide non sono più modificabili."):
- `POST /api/challenges`, `POST /api/challenges/bulk`, `PATCH /api/challenges/:id`, `DELETE /api/challenges/:id`;
- in `PATCH /api/events/me`: modifica di `start_time` ed `enable_timer`.

**Resta permesso**: `end_time` (allungare/accorciare la festa, propagato live via topic `event`), nomi degli
sposi, eliminazione della partita.

**Frontend**: `eventOut` espone un campo `game_started: boolean`; dove gli sposi modificano le sfide
(`OnboardingSetup.svelte`, pagina `(site)/partita/[code]/setup`, dashboard) i comandi di modifica sono
disattivati con il messaggio sopra. (Nessuna UI per gli orari oggi: vedi non-obiettivi.)

## 9. Test e verifica
- Backend: test del DO (publish filtra per topic ed esclude l'autore; `event_deleted` chiude tutte le socket;
  ticket scaduto/falsificato → 401); test di `isGameStarted` e del blocco sulle route.
- Manuale con due browser su `wrangler dev`: classifica live, galleria live con lightbox aperta, cambio pagina
  (nessun avviso per la pagina lasciata), tab in background e rientro, kill della rete e riconnessione,
  eliminazione partita, dashboard dettagliata live.
- Verifica nel container Dokploy che i DO funzionino con `wrangler dev`.

## 10. Lasciato al builder
- Struttura interna dei file, nomi esatti di helper/componenti.
- Codice di stato esatto per il blocco (409 vs 422), coerente con il resto delle API.
- Valori precisi di debounce, backoff, durata animazioni (entro i range indicati).
- Se il refresh "evento" usa `refreshUser(true)` o una chiamata `GET /api/events/me` dedicata.
- Aggiornare `TODO` (voce `[] WEBSOCKET`) e `MIGRAZIONE_NEON_CLOUDFLARE.md` (nuovo binding DO).
