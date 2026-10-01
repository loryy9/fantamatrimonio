# Piano: aggiornamento in tempo reale della galleria con Supabase Realtime

## Stato attuale del progetto
- Il frontend Svelte non usa `supabase-js`: parla solo con il backend FastAPI (`frontend/src/lib/api.js`). Solo il backend usa Supabase (service key, Storage).
- L'autenticazione è custom (token di sessione in localStorage), non Supabase Auth: lato Supabase i client sarebbero solo `anon`.
- La galleria si aggiorna con un polling in `frontend/src/lib/state.svelte.js` (`setInterval`, circa riga 290) e con `refreshGallery()`.
- `GalleryView.svelte` fa già inserimenti ottimistici (id `temp-…`), poi sostituiti con l'id reale.
- Tabella coinvolta: `user_submissions` (`image_url`, `event_id`, multi-tenant).

## Fase 0 – Decisione architetturale

| Opzione | Funzionamento | Pro / Contro |
|---|---|---|
| **A. Postgres Changes** | Il client si sottoscrive direttamente a `user_submissions`. | Poco lavoro sul backend. Richiede una policy RLS con `SELECT` per `anon`: ogni client potrebbe leggere le foto di tutti gli eventi. Limiti di scalabilità (ogni evento viene verificato per ogni utente sottoscritto). |
| **B. Broadcast dal backend (consigliata)** | Dopo insert/delete il backend emette un messaggio su un canale per evento; il frontend si sottoscrive. | Tabella non esposta, isolamento per evento, scala meglio. Richiede una piccola modifica al backend. |

Raccomandazione: **B**. Il messaggio porta il minimo necessario (id, url, autore, caption, data) oppure solo un "ping" che fa rifare il fetch della galleria.

## Fase 1 – Configurazione Supabase
1. Abilitare Realtime sul progetto.
2. Con la B: scegliere canali pubblici con nome non indovinabile (`gallery:{event_id}`, UUID) oppure privati (richiedono policy su `realtime.messages` e un JWT valido). Nel caso attuale i pubblici con UUID sono un compromesso accettabile.
3. Con la A: aggiungere la tabella alla publication `supabase_realtime`, impostare la replica identity per avere i dati sulle DELETE, scrivere la policy RLS.
4. Aggiungere la **anon key** al frontend: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, anche in `.env.example`.

## Fase 2 – Backend (solo opzione B)
1. In `backend/routers/submissions.py`, dopo l'insert riuscito (`/photos`, `/photo`) e dopo la delete, emettere un evento sul canale dell'evento.
2. Definire il contratto dell'evento: tipo (`photo_added` / `photo_removed`), payload minimo, id univoco.
3. Invio non bloccante e tollerante ai fallimenti: se Realtime non risponde, l'upload deve comunque riuscire.
4. Valutare eventi aggiuntivi per classifica/punteggi in un secondo momento.

## Fase 3 – Frontend: modulo realtime
1. Aggiungere `@supabase/supabase-js` e creare un modulo dedicato (es. `frontend/src/lib/realtime.js`) con client singleton.
2. Esporre `subscribeGallery(eventId, handlers)` e `unsubscribe()`.
3. Ciclo di vita:
   - sottoscrizione dopo il login, quando utente ed evento sono noti;
   - disiscrizione al logout o al cambio evento (in `state.svelte.js`, dove `galleryPhotos` viene azzerato, righe ~153 e ~205);
   - gestione di `visibilitychange`: al ritorno in primo piano su mobile la connessione potrebbe essere caduta.

## Fase 4 – Frontend: integrazione con lo stato
1. **Insert:** aggiungere in cima a `galleryPhotos`, con **deduplica per id**. L'autore ha già la foto tramite l'update ottimistico: l'evento non deve creare un doppione né sovrascrivere l'id `temp-…`.
2. **Delete:** rimuovere per id; se la foto è aperta nella lightbox (`activeModalPhoto`), chiuderla.
3. **Ordinamento:** mantenere `created_at` decrescente.
4. **Paginazione:** `visibleCount` e infinite scroll non devono "saltare" all'arrivo di nuove foto. Valutare un badge "N nuove foto" se l'utente sta scrollando in basso.
5. Per l'autore dell'upload, ignorare l'evento se l'id è già presente.

## Fase 5 – Robustezza e fallback
1. **Polling di sicurezza:** mantenerlo ma con intervallo molto più lungo (30–60 s), o attivo solo quando il canale non è `SUBSCRIBED`.
2. **Riconnessione:** dopo una riconnessione fare `refreshGallery(true)` per recuperare gli eventi persi (Realtime non garantisce il replay).
3. **Errori:** mostrare uno stato discreto "connessione persa" solo se necessario.
4. **Limiti del piano Supabase:** verificare client concorrenti e messaggi al secondo attesi (festa con molti invitati, batch da 10 foto).

## Fase 6 – Mobile (Flutter)
Con l'opzione B il contratto dell'evento è condiviso: basta sottoscriversi allo stesso canale con `supabase_flutter` (verificare in `mobile/pubspec.yaml`). Fase separata, ma progettare il payload pensando a entrambi i client.

## Fase 7 – Test e verifica
1. Test manuale con due dispositivi/browser sullo stesso evento: upload singolo e multiplo, eliminazione.
2. Isolamento: le foto dell'evento X non devono comparire nell'evento Y.
3. Perdita di connessione (modalità aereo): al ritorno la galleria si riallinea.
4. Aggiornare i test esistenti (es. `gallery_controller_test`) se cambia la logica di stato.
5. Nessun leak di sottoscrizioni dopo logout/login ripetuti.

## Ordine di lavoro
Fase 0 → 1 → 2 → 3 → 4 → 5 → test → 6 (mobile).

## Domande aperte
- Opzione **B** (Broadcast dal backend) o **A** (Postgres Changes, RLS più permissiva)?
- Realtime anche per classifica e punteggi, o solo galleria?
- Mobile nello stesso giro o dopo?
