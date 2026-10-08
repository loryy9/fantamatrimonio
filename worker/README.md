# Fanta Matrimonio su Cloudflare Workers

API + frontend in un unico Worker (TypeScript + Hono) sulla stessa origin: il frontend Svelte usa `/api` relativo.

| Componente        | Tecnologia |
| ----------------- | ---------- |
| API               | Hono su Cloudflare Workers, rotte `/api/*` |
| Database          | **Neon** (PostgreSQL serverless), driver `@neondatabase/serverless` via WebSocket |
| Foto              | **Cloudflare R2**, servite dal Worker su `/api/media/:file` (bucket privato) |
| Email             | SMTP (Gmail o altro) con `worker-mailer` |
| Reminder          | Cron Trigger orario (`scheduled`) |
| Frontend          | Workers Static Assets (`../frontend/dist`, fallback SPA) |
| Password / token  | `bcryptjs` / `jose` (JWT HS256) |

## 1. Database Neon

1. Crea il progetto su [neon.com](https://neon.com) e copia la connection string **pooled** (host con `-pooler`).
2. Crea lo schema: esegui `../db/schema_complete.sql` nel SQL Editor di Neon (contiene già tutte le migrazioni v1→v6).
3. Se hai già dati da portare: `pg_dump --no-owner --no-acl "<vecchia-url>" | psql "<neon-url>"`.

## 2. Sviluppo locale

```bash
cd worker
npm install
cp .dev.vars.example .dev.vars    # inserisci DATABASE_URL di Neon (meglio un branch di sviluppo) e i segreti
npm run build:frontend
npm run dev                       # http://127.0.0.1:8000 (stessa porta del proxy di vite)
```

- R2 gira in locale in modo simulato da `wrangler dev`: non serve alcun bucket per sviluppare.
- Cron in locale: `curl http://127.0.0.1:8000/cdn-cgi/local/scheduled`.
- Con un Postgres locale (`localhost`) il driver passa da un proxy WebSocket:
  `docker run -d -p 5433:5432 -e POSTGRES_PASSWORD=pw postgres:16` e
  `docker run -d -p 5434:80 -e LISTEN_ADDR=:80 -e ALLOW_ADDR_REGEX='.*' -e UPSTREAM_ADDR=host.docker.internal:5433 ghcr.io/neondatabase/wsproxy`
  e `DATABASE_URL=postgresql://postgres:pw@localhost:5434/postgres` (la porta è quella del proxy).

## 3. Deploy

```bash
npx wrangler login
npx wrangler r2 bucket create fantamatrimonio-photos
npx wrangler secret put DATABASE_URL
npx wrangler secret put JWT_SECRET
npx wrangler secret put ADMIN_USERNAME
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put ADMIN_SECRET_KEY
npx wrangler secret put GMAIL_ADDRESS        # oppure SMTP_HOST / SMTP_USER / SMTP_PASSWORD / SMTP_FROM
npx wrangler secret put GMAIL_APP_PASSWORD
# imposta FRONTEND_URL in wrangler.jsonc (usato nei link delle email), poi:
npm run deploy                               # builda il frontend e pubblica
```

Se riusi lo stesso `JWT_SECRET` di prima, i login esistenti restano validi.

## Note

- **Piano Workers a pagamento**: bcrypt costa ~150 ms di CPU (hash nuovi) fino a ~450 ms (hash esistenti cost 12) per
  login/registrazione; il piano Free consente 10 ms.
- **Segreti obbligatori**: `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SECRET_KEY` non hanno valori di default;
  se mancano l'area admin risponde 503.
- **Foto già caricate**: gli URL salvati nel DB puntano al vecchio storage. Copia i file in R2 mantenendo il nome e aggiorna
  `user_submissions.image_url` con il nuovo prefisso, oppure imposta `MEDIA_BASE_URL` se serve un dominio personalizzato per le foto.
- **Rate limit** `POST /api/events` (5/ora per IP): condiviso solo con il KV `RATE_LIMIT_KV` (vedi `wrangler.jsonc`),
  altrimenti è in memoria per istanza.
- Gli errori di validazione 422 hanno la forma `{"detail":[{loc,msg,type}]}` con messaggi in italiano.
