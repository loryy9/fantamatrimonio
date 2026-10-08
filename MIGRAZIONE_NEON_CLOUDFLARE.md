# Migrazione a Cloudflare Workers + Neon + R2

Stato: il codice è pronto in `worker/`. Mancano le operazioni di infrastruttura (sotto) e il deploy.
Il vecchio backend FastAPI/Supabase è stato rimosso dal working tree (recuperabile dalla cronologia git).

## 1. Architettura finale

| Prima | Dopo |
| --- | --- |
| FastAPI su Railway (`uvicorn`) | Un solo Worker Cloudflare (TypeScript + Hono) |
| PostgreSQL su Supabase (`psycopg2`) | **Neon**, driver `@neondatabase/serverless` (WebSocket) |
| Supabase Storage | **Cloudflare R2**, foto servite dal Worker su `/api/media/:file` |
| `smtplib` | `worker-mailer` (SMTP + STARTTLS), stesse variabili Gmail/SMTP |
| `process_reminders.py` con cron esterno | Cron Trigger orario (`scheduled`) |
| `StaticFiles` + fallback SPA | Workers Static Assets (`frontend/dist`) |

Il frontend non cambia: continua a chiamare `/api` sulla stessa origin.

## 2. Operazioni da fare (in ordine)

### A. Neon
1. Crea un progetto su neon.com (regione vicina agli utenti, es. Francoforte).
2. Copia la connection string **pooled** (host con `-pooler`, `sslmode=require`).
3. Nel SQL Editor di Neon esegui `db/schema_complete.sql` (include già le migrazioni v1→v6, enum, indici e trigger dei punti).
4. **Solo se hai dati da conservare**: esporta da Supabase e importa in Neon
   ```bash
   pg_dump --no-owner --no-acl --data-only --disable-triggers "<URL-SUPABASE>" > dati.sql
   psql "<URL-NEON>" -f dati.sql
   ```
   Se importi i dati dopo lo schema, i punti (`users.total_points`) vengono copiati così come sono: non ricalcolarli.
   Poi controlla i conteggi tabella per tabella (events, users, challenges, user_submissions, accounts).
5. Consigliato: crea un *branch* Neon per lo sviluppo e usa quello in `.dev.vars`.

### B. Cloudflare
1. Account Cloudflare con **piano Workers a pagamento** (vedi considerazioni).
2. `cd worker && npm install && npx wrangler login`
3. Crea il bucket: `npx wrangler r2 bucket create fantamatrimonio-photos`
   (se scegli un altro nome, aggiornalo in `wrangler.jsonc`).
4. Imposta i segreti (uno alla volta, ti chiede il valore):
   ```bash
   npx wrangler secret put DATABASE_URL          # stringa pooled di Neon
   npx wrangler secret put JWT_SECRET            # lo STESSO del vecchio backend, se vuoi mantenere i login
   npx wrangler secret put ADMIN_USERNAME
   npx wrangler secret put ADMIN_PASSWORD
   npx wrangler secret put ADMIN_SECRET_KEY
   npx wrangler secret put GMAIL_ADDRESS         # oppure SMTP_HOST / SMTP_USER / SMTP_PASSWORD / SMTP_FROM
   npx wrangler secret put GMAIL_APP_PASSWORD
   ```
5. In `wrangler.jsonc` imposta `FRONTEND_URL` con l'URL pubblico finale (finisce nei link delle email).
6. (Opzionale) KV per il rate limit: `npx wrangler kv namespace create RATE_LIMIT_KV` e decommenta il binding.
7. Deploy: `npm run deploy` (builda il frontend e pubblica).
8. (Opzionale) Collega un dominio personalizzato dalla dashboard Cloudflare → Workers → Domains.

### C. Foto già caricate (solo se ci sono dati reali)
Gli URL in `user_submissions.image_url` puntano a Supabase Storage e smetteranno di funzionare.
1. Scarica i file dal bucket Supabase e caricali in R2 **mantenendo lo stesso nome file**
   (es. con `wrangler r2 object put fantamatrimonio-photos/<nome> --file <file>` o con `rclone`).
2. Aggiorna gli URL:
   ```sql
   UPDATE user_submissions
   SET image_url = 'https://TUO-DOMINIO/api/media/' || regexp_replace(image_url, '^.*/', '')
   WHERE image_url IS NOT NULL;
   ```
   Se hai impostato `MEDIA_BASE_URL`, usa quel prefisso.
3. Se invece i dati sono di prova, salta tutto: ripartire da zero è più semplice.

### D. Verifica post-deploy (checklist)
- [ ] `GET /api/health` → `{"status":"ok"}`
- [ ] Creazione matrimonio con email + codice OTP (arriva la mail?)
- [ ] Login ospite con email/OTP e senza email (nickname + parola segreta)
- [ ] Quiz, voto, caccia fotografica, upload foto singolo e multiplo, eliminazione foto
- [ ] La foto si vede in galleria (URL `/api/media/...`) e i punti si aggiornano
- [ ] Classifica e dettaglio utente
- [ ] Registrazione account, login-secure, upgrade da ospite, dashboard
- [ ] Link "completa account" dalla mail di reminder
- [ ] Area admin (login, liste, cancellazioni)
- [ ] Cron: `npx wrangler tail` all'ora piena deve mostrare "Reminder: trovati=…"
- [ ] App mobile: puntare l'URL base al nuovo dominio e provare login e upload

### E. Cutover e pulizia
1. Tieni il vecchio backend attivo finché la checklist non è verde (i due sistemi non possono scrivere sullo stesso DB: scegli un momento e congela le scritture durante `pg_dump`/import).
2. Cambia l'URL base nell'app mobile e nel frontend (se usava un dominio Railway) e fai il rilascio.
3. Spegni Railway e, passato un periodo di sicurezza, il progetto Supabase.
4. Commit: le cancellazioni (`backend/`, `PIANO_REALTIME_GALLERIA.md`) sono già in staging.

## 3. Sviluppo locale

```bash
cd worker
cp .dev.vars.example .dev.vars     # DATABASE_URL del branch Neon di sviluppo + segreti
npm run build:frontend
npm run dev                        # http://127.0.0.1:8000
```
R2 è simulato in locale da `wrangler dev`. Cron: `curl http://127.0.0.1:8000/cdn-cgi/local/scheduled`.
Per usare un Postgres locale invece di Neon serve il proxy WebSocket di Neon (istruzioni nel README del worker).

## 4. Considerazioni

**Cosa è stato verificato**
- Ho eseguito 183 richieste identiche contro il vecchio FastAPI e contro il Worker (Postgres locale): stessi stati e stessi body, tranne il testo degli errori di validazione 422 (7 casi).
- Verificati anche: compatibilità hash bcrypt e JWT col vecchio backend, invio email via SMTP, Cron, upload/lettura/cancellazione foto su R2 (simulato), dry-run di `wrangler deploy`.
- **Non verificato**: connessione a un vero Neon, invio con Gmail reale, R2 reale, comportamento in produzione sotto carico. Fai un primo deploy su un ambiente di prova.
- I test Python (`test_multi_tenant`, `test_all_points`) importavano l'app in-process e sono stati cancellati col backend. Ora non c'è una suite automatica nel repo: se vuoi, conviene trasformare il mio script di parità in test di integrazione stabili.

**Costi e limiti**
- **Workers a pagamento necessario.** bcrypt consuma ~150 ms di CPU per hash nuovi (cost 10) e ~450 ms per verificare gli hash esistenti (cost 12); il piano Free concede 10 ms, quindi login e registrazioni fallirebbero. Alternativa futura: passare a PBKDF2 nativo (WebCrypto) con rehash trasparente al login.
- Neon Free ha compute che va in sospensione: la prima richiesta dopo inattività è più lenta (qualche centinaio di ms). Per la festa conviene non averlo in cold start.
- R2: nessun costo di egress, ma le foto passano dal Worker (conta come richieste). Le risposte hanno cache immutabile di un anno, quindi il browser non le riscarica.
- Limite upload: 100 MB per richiesta su Workers (il codice accetta fino a 50 MB per file, 10 file per volta).

**Differenze di comportamento da conoscere**
- **Niente più default insicuri**: il vecchio backend ripiegava su `admin`/`admin` e su chiavi scritte nel codice. Ora `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SECRET_KEY` sono obbligatori; senza, l'area admin risponde 503. Se non cambi `JWT_SECRET` i login esistenti restano validi; se lo cambi, tutti devono rifare l'accesso.
- **Rate limit** di `POST /api/events` (5/ora per IP): senza KV vale solo per istanza del Worker, quindi è più debole. Collega `RATE_LIMIT_KV` se ti serve.
- **Cache in memoria delle sfide foto rimossa**: tra istanze non è coerente. Costa una query indicizzata per upload.
- **Errori 422** con la stessa struttura `{"detail":[{loc,msg,type}]}` ma messaggi in italiano.
- **Email HTML**: i nomi inseriti dagli utenti ora sono escapati (prima erano interpolati in chiaro).
- **UUID malformati** nel path ora danno 422 invece di 500.
- **Redirect slash finale**: `/api/x/` → 301 verso `/api/x` (FastAPI usava 307).
- Gli URL foto hanno il dominio del Worker (o `MEDIA_BASE_URL`): se cambi dominio, gli URL già salvati nel DB restano al vecchio dominio. Per evitarlo in futuro si può salvare solo il nome file e comporre l'URL in lettura.
- Neon non ha gli stessi "poolers" di Supabase: usa sempre la stringa *pooled* per evitare di esaurire le connessioni (ogni richiesta apre una connessione WebSocket).

**Rischi aperti / idee**
- Il rate limit sugli OTP (20 s) è per email+scopo, non per IP: un attaccante può comunque generare mail verso indirizzi altrui. Valutare un limite per IP.
- `/api/admin/login` non ha limitazione sui tentativi: con password debole è forzabile. Usa una password lunga o metti l'area admin dietro Cloudflare Access.
- Il codice OTP e i token sono salvati in chiaro nel DB (come prima). Accettabile per OTP a 15 minuti; per le password si usa bcrypt.
- Se cresci, valuta Durable Objects/WebSocket per la galleria in tempo reale (il vecchio piano su Supabase Realtime è stato eliminato perché non più applicabile).
- Nessuna cancellazione dei file R2 quando si elimina un evento o un account (la cascade del DB toglie solo le righe): le foto orfane restano nel bucket. Si può aggiungere una pulizia periodica nel Cron.

## 5. File principali

- `worker/src/index.ts` – app, middleware, rotta media, Cron
- `worker/src/db.ts` – connessione Neon e transazioni
- `worker/src/storage.ts` – R2
- `worker/src/routes/*.ts` – auth, challenges, submissions, leaderboard, events, dashboard, admin
- `worker/wrangler.jsonc` – binding R2, Cron, assets, variabili
- `worker/README.md` – comandi di sviluppo e deploy
- `db/schema_complete.sql` – schema da eseguire su Neon
