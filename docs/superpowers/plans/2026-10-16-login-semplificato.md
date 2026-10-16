# Login semplificato: piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ridurre l'accesso a due porte (ospiti e sposi/account) con email + codice OTP, e rendere facile e visibile il rientro degli ospiti senza email.

**Architecture:** Un nuovo router Hono `worker/src/routes/access.ts` (montato su `/api/auth` accanto a `auth.ts`) aggiunge gli endpoint nuovi, appoggiandosi a due moduli piccoli (`accounts.ts`, `attempts.ts`). Gli endpoint vecchi restano attivi (compatibilità app mobile e link già inviati). Il frontend Svelte passa ai nuovi endpoint e smette di usare gli altri.

**Tech Stack:** Cloudflare Workers + Hono + zod + jose + Neon/Postgres (worker); Svelte 5 + Vite (frontend); Vitest + PGlite (nuovi, solo test del worker).

**Spec:** `docs/superpowers/specs/2026-10-16-login-semplificato-design.md`

## Global Constraints

- Messaggi utente e commenti in italiano, come nel resto del codice.
- Email sempre normalizzate con `normalizeEmail` (`worker/src/verification.ts`).
- `POST /api/auth/login` **non si tocca**: l'app mobile (`mobile/lib/features/auth/auth_controller.dart`) lo usa con `first_name` + `last_name` + `secret_word`.
- Restano attivi `/register`, `/login-secure`, `/upgrade`, `/claim-info`, `/complete-claim`, `/send-verification-code`, `/verify-code`. La loro rimozione è fuori da questo piano.
- OTP valido 15 minuti, un invio ogni 20 secondi (già in `createAndSendCode`). Il nuovo scopo OTP è `"login"`.
- Sessione ospite 30 giorni (default di `sessions.expires_at`). JWT account: `cfg.jwtExpireHours` (720).
- Link di rientro: valido 30 giorni (scelta mia, punto aperto della spec §8), invalidato quando se ne genera uno nuovo.
- Rate limit "Rientra": 5 tentativi falliti ogni 15 minuti per coppia (evento, nickname) e 30 ogni 15 minuti per IP.
- Il working tree ha molte modifiche non committate in `frontend/` e `worker/src/routes/dashboard.ts`. Prima di iniziare, vanno committate o messe da parte dall'utente, e il lavoro va fatto su un branch dedicato (`login-semplificato`).
- La migrazione `db/migration_v7_access.sql` va applicata a mano su Neon prima del deploy (azione dell'utente, come per le migrazioni precedenti).

## Deviazioni dalla spec (decise leggendo il codice)

1. **Nessuna rimozione del ramo legacy né degli endpoint vecchi**: l'app mobile usa `/auth/login` (ramo legacy). La spec §5 fase 5 diventa un lavoro futuro, dopo l'aggiornamento di mobile.
2. **Nessun nuovo `/otp/request`**: si riusano `/auth/send-verification-code` e `/auth/verify-code` con `purpose: "login"`. Il nuovo endpoint consuma il codice.
3. **Nessun refactor dei middleware** (spec fase 2): `requireUser`/`requireAccount` restano. Gli ospiti con email ricevono sia sessione sia JWT, quelli senza email solo la sessione.
4. **Nickname duplicato in "Nuovo" (senza email)**: rifiutato sempre (409), anche con la stessa parola, così due persone diverse non si fondono per caso. La spec diceva "parola diversa"; questa regola è più stretta.
5. **Una sola `SecureLoginView`** riscritta al posto di una nuova `AccountLoginView` (la route `login-secure` esiste già).
6. **Parola segreta sposi**: `/auth/login` con `is_couple` resta, ma il frontend non lo usa più. Il punto aperto "serve ancora come PIN?" resta aperto.

## Review Focus

1. Un refuso in "Rientra" **non deve creare** un utente (e non deve resettare punteggio e foto): errore 404 chiaro.
2. "Nuovo" con un nickname senza email già usato nell'evento: 409 con messaggio che rimanda a "Rientra".
3. Email con maiuscole o spazi (`"  Mario@Mail.IT "`) = stesso account di `mario@mail.it`; vecchi `users` con quella email e `account_id` nullo vengono collegati.
4. Link di rientro vecchio dopo averne generato uno nuovo: rifiutato. Richiesta fatta da chi non è sposo dell'evento, o per un ospite di un altro evento: 403 / 404.
5. OTP: errato o già usato non crea né account né utente (in particolare in `/auth/join`).

---

## File Structure

**Backend (`worker/`)**
- Create `src/accounts.ts`: `findOrCreateVerifiedAccount`, `joinEvent`, `startSession`.
- Create `src/attempts.ts`: rate limit su tabella `auth_attempts`.
- Create `src/routes/access.ts`: tutti i nuovi endpoint di accesso.
- Modify `src/index.ts`: monta `access`.
- Modify `src/routes/auth.ts`: `/claim-info` diventa magic link.
- Modify `src/routes/dashboard.ts`: `has_email` nei partecipanti (solo sposi) e route `rejoin-link`.
- Modify `src/auth.ts`: `createRejoinToken`.
- Modify `src/email.ts`: etichetta OTP `login`.
- Create `test/helpers.ts` e test per ogni task, `vitest.config.ts`.

**Database**
- Create `db/migration_v7_access.sql` e aggiornare `db/schema_complete.sql`.

**Frontend (`frontend/src/`)**
- Modify `lib/api.js`, `lib/state.svelte.js`.
- Rewrite `components/LoginView.svelte` e `components/SecureLoginView.svelte`.
- Create `components/AnonymousAccess.svelte`, `components/RecoveryModal.svelte`.
- Modify `components/SiteHeader.svelte`, `Navbar.svelte`, `DashboardView.svelte`, `App.svelte`.
- Delete `components/ClaimAccountModal.svelte`, `components/UpgradeAccountModal.svelte`.

---

### Task 1: Harness di test (Vitest + PGlite) e migrazione DB

**Files:**
- Create: `db/migration_v7_access.sql`
- Modify: `db/schema_complete.sql` (aggiungi in fondo le stesse istruzioni della migrazione)
- Modify: `worker/package.json` (devDependencies `vitest`, `@electric-sql/pglite`; script `"test": "vitest run"`)
- Create: `worker/vitest.config.ts`, `worker/test/helpers.ts`, `worker/test/harness.test.ts`

**Interfaces:**
- Produces (`worker/test/helpers.ts`):
  - `makeTestApp(): Promise<TestApp>`
  - `interface TestApp { app: Hono<AppEnv>; db: Db; cfg: Config; reset(): Promise<void>; request(path: string, init?: { method?: string; json?: unknown; token?: string }): Promise<Response>; seedEvent(opts?: { code?: string }): Promise<{ eventId: string; code: string; coupleAccountId: string; coupleUserId: string; coupleJwt: string }>; lastOtp(email: string): Promise<string> }`
  - `app` monta `auth`, `access`, `dashboard`, con lo stesso `onError` di `src/index.ts`. Il modulo `../src/email` è mockato (`sendVerificationEmail` ritorna `true`, `processDueReminders` no-op).
  - Fino al Task 3 `access` non esiste: l'helper lo importa dinamicamente solo se il file esiste, oppure il Task 3 aggiunge l'import. Scegli la seconda: l'import viene aggiunto al Task 3.

- [ ] **Step 1: Scrivi `db/migration_v7_access.sql`** con:
  - `ALTER TABLE users ADD COLUMN IF NOT EXISTS rejoin_nonce TEXT;`
  - `CREATE TABLE IF NOT EXISTS auth_attempts (id BIGSERIAL PRIMARY KEY, key TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`
  - `CREATE INDEX IF NOT EXISTS idx_auth_attempts_key ON auth_attempts (key, created_at);`
  Copia le stesse istruzioni in fondo a `db/schema_complete.sql`.

- [ ] **Step 2: Installa le dipendenze di test**

Run: `cd worker && npm install -D vitest @electric-sql/pglite`
Expected: installazione senza errori; `package.json` aggiornato.

- [ ] **Step 3: Scrivi il test del harness** in `worker/test/harness.test.ts`:

```ts
import { describe, expect, it, beforeAll } from "vitest";
import { makeTestApp, type TestApp } from "./helpers";

describe("harness", () => {
  let t: TestApp;
  beforeAll(async () => { t = await makeTestApp(); });

  it("carica lo schema e risponde alle query", async () => {
    const row = await t.db.queryOne("SELECT COUNT(*) AS n FROM auth_attempts");
    expect(Number(row!.n)).toBe(0);
  });

  it("seedEvent crea un evento con sposi e account", async () => {
    const ev = await t.seedEvent({ code: "TESTCODE" });
    expect(ev.code).toBe("TESTCODE");
    const user = await t.db.queryOne("SELECT role FROM users WHERE id = $1", [ev.coupleUserId]);
    expect(user!.role).toBe("couple");
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd worker && npx vitest run test/harness.test.ts`
Expected: FAIL (`./helpers` non esiste).

- [ ] **Step 5: Implementa `worker/vitest.config.ts` e `worker/test/helpers.ts`**
  - `vitest.config.ts`: `environment: "node"`, `include: ["test/**/*.test.ts"]`.
  - `makeTestApp`: crea `new PGlite()`, esegue `db/schema_complete.sql` (leggilo con `fs`; se PGlite rifiuta una istruzione, esegui il file statement per statement ignorando solo quelle che usano estensioni non disponibili, e annota quali).
  - `Db` si costruisce con `new Db(fakeClient as unknown as Client)`, dove `fakeClient` ha `connect`, `end` (no-op) e `query(text, params)` che chiama `pg.query` e ritorna `{ rows }`.
  - `cfg`: oggetto `Config` con `jwtSecret: "test-secret"`, `jwtExpireHours: 720`, `registrationReminderDays: 7`, `frontendUrl: "http://localhost:5173"`, altri campi vuoti.
  - `vi.mock("../src/email", ...)`: `sendVerificationEmail` → `true`, `processDueReminders` → `{processed:0,sent:0,failed:0}`, `sendEmail` → `true`.
  - `reset()`: `TRUNCATE accounts, events, auth_attempts, email_verification_codes RESTART IDENTITY CASCADE`.
  - `lastOtp(email)`: legge l'ultimo `code` non usato da `email_verification_codes` per quell'email.
  - `seedEvent`: inserisce evento (con `invite_code`), account sposi verificato, utente `couple` collegato, e un JWT con `createJwt` (`worker/src/auth.ts`).

- [ ] **Step 6: Run test to verify it passes**

Run: `cd worker && npx vitest run test/harness.test.ts`
Expected: PASS (2 test).

- [ ] **Step 7: Commit**

```bash
git add db worker/package.json worker/package-lock.json worker/vitest.config.ts worker/test
git commit -m "test: harness Vitest + PGlite e migrazione v7 (rejoin_nonce, auth_attempts)"
```

---

### Task 2: Moduli `accounts.ts` e `attempts.ts`

**Files:**
- Create: `worker/src/accounts.ts`, `worker/src/attempts.ts`
- Test: `worker/test/accounts.test.ts`, `worker/test/attempts.test.ts`

**Interfaces:**
- Consumes: `Db`, `Row` da `worker/src/db.ts`; `normalizeEmail` da `worker/src/verification.ts`; `ApiError` da `worker/src/errors.ts`; `makeTestApp` dal Task 1.
- Produces:
  - `findOrCreateVerifiedAccount(db: Db, email: string, displayName?: string | null): Promise<Row>`: normalizza l'email; se l'account esiste lo marca `is_verified = TRUE` (senza toccare `password_hash`); altrimenti lo crea con `password_hash = NULL`, `is_verified = TRUE`, `registered_at = NOW()`, `display_name = displayName?.trim() || parte locale dell'email`. In ogni caso collega a quell'account tutti gli `users` con `LOWER(email) = email` e `account_id IS NULL`.
  - `joinEvent(db: Db, eventId: string, account: Row, nickname: string): Promise<{ user: Row; isNew: boolean }>`: se esiste uno `users` per (evento, account) aggiorna `first_name` al nickname, altrimenti lo inserisce (`role 'guest'`, `last_name ''`, `secret_word ''`, `email = account.email`).
  - `startSession(db: Db, userId: string, accountId: string | null): Promise<string>`: inserisce una riga in `sessions` con `crypto.randomUUID()` e ritorna il token.
  - `assertAttemptsAllowed(db: Db, key: string, max: number, windowMinutes: number): Promise<void>`: lancia `ApiError(429, "Troppi tentativi. Riprova tra qualche minuto.")` se ci sono `>= max` righe di `auth_attempts` con quella chiave nella finestra.
  - `recordFailedAttempt(db: Db, key: string): Promise<void>`.

- [ ] **Step 1: Scrivi i test** (`accounts.test.ts`) con nomi e asserzioni:
  - `"crea un account verificato senza password"`: `findOrCreateVerifiedAccount(db, "  Mario@Mail.IT ")` → `email === "mario@mail.it"`, `is_verified === true`, `password_hash === null`, `display_name === "mario"`.
  - `"non sovrascrive la password di un account esistente"`: account con `password_hash = 'x'`, dopo la chiamata `password_hash` è ancora `'x'`.
  - `"collega i vecchi users con la stessa email"`: `users` con `email='mario@mail.it'`, `account_id NULL` → dopo la chiamata `account_id` uguale all'id dell'account.
  - `"joinEvent: stesso account due volte non duplica e aggiorna il nickname"`: seconda chiamata `isNew === false`, un solo `users`, `first_name` aggiornato.
  - `"joinEvent: stesso account in due eventi crea due users"`.
  - `attempts.test.ts`: `"blocca dopo 5 fallimenti"` (5 × `recordFailedAttempt`, poi `assertAttemptsAllowed(db,"k",5,15)` rigetta con status 429); `"i fallimenti vecchi non contano"` (inserisci una riga con `created_at = NOW() - INTERVAL '20 minutes'` → passa).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd worker && npx vitest run test/accounts.test.ts test/attempts.test.ts`
Expected: FAIL (moduli non definiti).

- [ ] **Step 3: Implementa `worker/src/accounts.ts` e `worker/src/attempts.ts`** con le firme sopra. Query parametriche come nel resto del codice (`$1, $2`).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd worker && npx vitest run test/accounts.test.ts test/attempts.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck e commit**

Run: `cd worker && npm run typecheck`
Expected: nessun errore.

```bash
git add worker/src/accounts.ts worker/src/attempts.ts worker/test
git commit -m "feat(worker): helper account verificato, join evento e rate limit"
```

---

### Task 3: `POST /auth/email-login` e `POST /auth/join`

**Files:**
- Create: `worker/src/routes/access.ts`
- Modify: `worker/src/index.ts` (`import access from "./routes/access"` e `app.route("/api/auth", access)` subito dopo `auth`)
- Modify: `worker/src/email.ts` (`PURPOSE_LABELS`: aggiungi `login: "accesso"`)
- Modify: `worker/test/helpers.ts` (monta `access`)
- Test: `worker/test/access-email.test.ts`

**Interfaces:**
- Consumes: `findOrCreateVerifiedAccount`, `joinEvent`, `startSession` (Task 2); `verifyCode`, `normalizeEmail` (`verification.ts`); `createJwt`, `decodeJwt`, `isJwt`, `bearerToken` (`auth.ts`); `accountOut`, `eventOut`, `userOut` (`serializers.ts`); `parseJson` (`util.ts`).
- Produces:
  - `POST /api/auth/email-login` body `{ email: string, verification_code: string }` → 200 `{ jwt, account, events: eventOut[] }`. Codice errato/scaduto/usato → 400 `"Codice di verifica non valido o scaduto."`. Il codice si consuma (`verifyCode(..., "login", true)`). Eventi = quelli degli `users` dell'account, come in `/login-secure`.
  - `POST /api/auth/join` body `{ invite_code: string, nickname: string, email?: string, verification_code?: string }` → 200 `{ token, jwt, account, user, event, is_new }`.
    - Se c'è `Authorization: Bearer <JWT account>` valido → usa quell'account (niente OTP).
    - Altrimenti servono `email` + `verification_code` (scopo `"login"`, consumato) e l'account si ottiene con `findOrCreateVerifiedAccount`.
    - Codice evento inesistente → 404 `"Codice matrimonio non trovato. Controlla il codice inserito."`. Nickname vuoto → 422 `"Inserisci un nickname per partecipare."`. Né JWT né email+codice → 422.
    - Alla prima partecipazione di un ospite (`is_new`) inserisce la riga in `registration_reminders` come fa oggi `/login` (stesso schema: `user_id, event_id, email, send_after = now + cfg.registrationReminderDays`).
    - Il token è `startSession(db, user.id, account.id)`.

- [ ] **Step 1: Scrivi i test** in `access-email.test.ts` (usa `t.request`, `t.seedEvent`, `t.lastOtp`; per ottenere l'OTP prima chiama `POST /auth/send-verification-code` con `purpose: "login"`):
  - `"email-login: codice corretto crea account verificato e ritorna jwt"`.
  - `"email-login: email con maiuscole e spazi dà lo stesso account"` (due login con `"A@B.it"` e `" a@b.IT "` → stesso `account.id`).
  - `"email-login: codice errato → 400 e nessun account creato"`.
  - `"email-login: lo stesso codice non vale due volte"`.
  - `"email-login: collega i vecchi users con quella email"`.
  - `"join: email + otp + nickname crea account, user guest e sessione"` (`is_new === true`, `token` presente, riga in `registration_reminders`).
  - `"join: otp errato → 400 e nessun user creato"`.
  - `"join: con JWT di un account niente otp, solo nickname"`.
  - `"join: codice evento inesistente → 404"`, `"join: nickname vuoto → 422"`.
  - `"join: stesso account in due eventi → due user distinti"`.
  - `"join: secondo join stesso evento aggiorna nickname, is_new false"`.
  - `"legacy: /auth/login con first_name+last_name+secret_word continua a funzionare"` (compatibilità mobile: crea un utente via `/auth/login` e verifica `is_new` e `token`).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd worker && npx vitest run test/access-email.test.ts`
Expected: FAIL (404 sulle nuove route).

- [ ] **Step 3: Implementa** `worker/src/routes/access.ts` (`const router = new Hono<AppEnv>(); ... export default router;`) con le due route, schemi zod nello stile di `auth.ts`. Aggiorna `index.ts`, `email.ts` e `helpers.ts` come da elenco file.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd worker && npx vitest run test/access-email.test.ts && npm run typecheck`
Expected: PASS e typecheck pulito.

- [ ] **Step 5: Commit**

```bash
git add worker/src worker/test
git commit -m "feat(worker): email-login e join unificato con OTP (scopo login)"
```

---

### Task 4: Ospiti senza email: `join-anonymous` e `rejoin-anonymous`

**Files:**
- Modify: `worker/src/routes/access.ts`
- Test: `worker/test/access-anonymous.test.ts`

**Interfaces:**
- Consumes: `startSession`, `assertAttemptsAllowed`, `recordFailedAttempt` (Task 2); `normalize` (`util.ts`).
- Produces:
  - `POST /api/auth/join-anonymous` body `{ invite_code, nickname, secret_word }` → 200 `{ token, user, event, is_new: true }`.
    - Crea `users` (`role 'guest'`, `last_name ''`, `email NULL`, `secret_word = normalize(word)`).
    - Nickname già usato nell'evento da un ospite con `email IS NULL` (confronto `LOWER`) → 409 `"Questo nickname è già in uso. Se sei già entrato, usa «Rientra»; altrimenti scegli un altro nickname."`.
    - Nickname o parola vuoti → 422. Evento inesistente → 404.
  - `POST /api/auth/rejoin-anonymous` body `{ invite_code, nickname, secret_word }` → 200 `{ token, user, event, is_new: false }`.
    - **Non crea mai utenti.** Non trovato → 404 `"Non troviamo questo nickname con questa parola. Controlla le maiuscole o chiedi agli sposi di aiutarti."` e registra un fallimento.
    - Prima di cercare chiama `assertAttemptsAllowed` su `rejoin:<eventId>:<nick minuscolo>` (max 5, 15 min) e su `rejoin-ip:<IP>` (max 30, 15 min; IP da header `CF-Connecting-IP`, altrimenti `"unknown"`).
    - Confronto case-insensitive su nickname e parola.

- [ ] **Step 1: Scrivi i test** in `access-anonymous.test.ts`:
  - `"join-anonymous crea l'ospite senza email"`.
  - `"join-anonymous: nickname già usato (anche con la stessa parola) → 409"`.
  - `"join-anonymous: stesso nickname in un altro evento è permesso"`.
  - `"rejoin: nickname e parola corretti ritornano lo stesso user.id e i punti"` (imposta `total_points = 40` e verifica che resti 40).
  - `"rejoin: maiuscole diverse nel nickname e nella parola funzionano"`.
  - `"rejoin: parola sbagliata → 404 e il numero di users NON cambia"` (Review Focus 1).
  - `"rejoin: nickname con refuso → 404 e il numero di users NON cambia"`.
  - `"rejoin: dopo 5 fallimenti il sesto tentativo, anche con la parola giusta, → 429"`.
  - `"rejoin: ospite con email non è raggiungibile da questo endpoint"` (un user con email e stessa parola → 404).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd worker && npx vitest run test/access-anonymous.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementa le due route** in `access.ts`. Riusa un helper locale `loadEventByCode(db, code)` (404 con il messaggio standard) condiviso con `join`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd worker && npx vitest run test/access-anonymous.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/src worker/test
git commit -m "feat(worker): join-anonymous e rejoin-anonymous (mai creare utenti al rientro) con rate limit"
```

---

### Task 5: Link di rientro generato dagli sposi

**Files:**
- Modify: `worker/src/auth.ts` (aggiungi `createRejoinToken`)
- Modify: `worker/src/routes/dashboard.ts` (route `rejoin-link` e campo `has_email`)
- Modify: `worker/src/routes/access.ts` (route `rejoin-link` di consumo)
- Test: `worker/test/rejoin-link.test.ts`

**Interfaces:**
- Consumes: `requireAccount` (`auth.ts`), `startSession`, `decodeJwt`.
- Produces:
  - `createRejoinToken(cfg: Config, userId: string, eventId: string, nonce: string, days = 30): Promise<string>`: JWT con `{ sub: userId, event_id, nonce, type: "rejoin_guest" }`.
  - `POST /api/dashboard/events/:event_id/guests/:user_id/rejoin-link` (con `requireAccount`) → 200 `{ url: string }` dove `url = ${cfg.frontendUrl}/rientra?token=<jwt>`.
    - 403 se l'account non ha uno `users.role = 'couple'` in quell'evento.
    - 404 se `user_id` non è un ospite (`role 'guest'`) di quell'evento.
    - Genera un nuovo `nonce` (`crypto.randomUUID()`), lo salva in `users.rejoin_nonce`: i link precedenti non valgono più.
  - `POST /api/auth/rejoin-link` body `{ token: string, new_secret_word?: string }` → 200 `{ token, user, event, is_new: false }`. Token non valido, scaduto, di altro tipo o con nonce diverso da `users.rejoin_nonce` → 400 `"Il link di rientro non è valido o è scaduto."`. Se `new_secret_word` è presente, aggiorna `users.secret_word` con `normalize(new_secret_word)`. Non svuota `rejoin_nonce` (il link resta riusabile fino a quando gli sposi ne generano un altro).
  - `GET /api/dashboard/events/:event_id` (esistente): ogni elemento di `participants` ha in più `has_email: boolean` **solo se chi chiede è sposo** (altrimenti il campo manca). Serve aggiungere `email` alla `SELECT` dei partecipanti e non serializzarla.

- [ ] **Step 1: Scrivi i test** in `rejoin-link.test.ts`:
  - `"lo sposo genera un link e l'ospite rientra sullo stesso user"` (punti invariati).
  - `"rigenerare il link invalida il precedente"` (Review Focus 4).
  - `"un ospite non può generare link"` → 403.
  - `"un ospite di un altro evento → 404"`.
  - `"new_secret_word aggiorna la parola e poi rejoin-anonymous funziona con la nuova"`.
  - `"token manomesso o di altro tipo (es. un jwt account) → 400"`.
  - `"has_email è presente per gli sposi e assente per gli ospiti"` nel dettaglio evento.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd worker && npx vitest run test/rejoin-link.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementa** `createRejoinToken` (stesso `sign` di `createClaimToken`, esportando o riusando il helper interno) e le tre modifiche alle route. Per i test aggiungi `dashboard` a `helpers.ts` se non c'è già.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd worker && npx vitest run && npm run typecheck`
Expected: tutti i test del worker PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/src worker/test
git commit -m "feat(worker): link di rientro generato dagli sposi (revocabile) e has_email nei partecipanti"
```

---

### Task 6: Il link email di recupero diventa un magic link

**Files:**
- Modify: `worker/src/routes/auth.ts` (handler di `/claim-info`)
- Test: `worker/test/claim-magic-link.test.ts`

**Interfaces:**
- Consumes: `findOrCreateVerifiedAccount` (Task 2), `createClaimToken` (`auth.ts`).
- Produces: `POST /api/auth/claim-info` ritorna **sempre** `already_registered: true`, `jwt`, `account`, `user`, `event`, `token`. Se l'account non esiste viene creato senza password con `findOrCreateVerifiedAccount(db, email, display)`, e `users.account_id` dell'utente del link viene impostato. Il vecchio ramo `already_registered: false` non esiste più. `/complete-claim` resta invariato.

- [ ] **Step 1: Scrivi i test** in `claim-magic-link.test.ts`:
  - `"claim-info per un ospite senza account crea l'account e ritorna jwt"`.
  - `"claim-info per un account già con password ritorna jwt senza modificare la password"`.
  - `"claim-info con token non valido → 400"`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd worker && npx vitest run test/claim-magic-link.test.ts`
Expected: FAIL (primo test: `already_registered` è `false`).

- [ ] **Step 3: Modifica l'handler** in `auth.ts` come descritto. Aggiorna il commento in testa al file.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd worker && npx vitest run && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/src worker/test
git commit -m "feat(worker): claim-info come magic link (account creato senza password)"
```

---

### Task 7: Frontend, client API e stato

**Files:**
- Modify: `frontend/src/lib/api.js`
- Modify: `frontend/src/lib/state.svelte.js`

**Interfaces:**
- Produces (`api.js`, tutti `async`, stile degli altri metodi con `request(...)`):
  - `emailLogin(email, verificationCode)` → `POST /auth/email-login`
  - `join({ inviteCode, nickname, email, verificationCode })` → `POST /auth/join`
  - `joinAnonymous({ inviteCode, nickname, secretWord })`, `rejoinAnonymous({ inviteCode, nickname, secretWord })`
  - `rejoinWithLink(token, newSecretWord = null)` → `POST /auth/rejoin-link`
  - `createRejoinLink(eventId, userId)` → `POST /dashboard/events/:event_id/guests/:user_id/rejoin-link`
- Produces (`state.svelte.js`, metodi di `AppState` che ritornano `{ success: boolean, error?: string }`):
  - `_enterGame(res, inviteCode)`: estrae da `login()` la parte comune dopo la chiamata API (salva token, `setUser`, `event`, toast benvenuto/bentornato, `setGameTab('home', true)`, `loadInitialData`, `startPolling`). `login()` lo chiama a sua volta.
  - `emailLogin(email, code)`: come `loginSecure` (svuota lo stato di gioco, va a `/dashboard_utente`, carica gli eventi).
  - `joinWithAccount({ inviteCode, nickname, email, verificationCode })`, `joinAnonymous(payload)`, `rejoinAnonymous(payload)`: chiamano `_enterGame`. `joinAnonymous` salva in localStorage la chiave `fm_recovery_hint` = `JSON.stringify({ code, nickname, secretWord })` e imposta `recoveryModal = 'first'`; `rejoinAnonymous` salva lo stesso hint senza aprire il modal.
  - `rejoinWithLink(token, newWord)`: usa `api.rejoinWithLink`, poi `_enterGame`.
  - `recoveryModal = $state(null)` (`null | 'first' | 'info' | 'logout'`) e `get isAnonymous()` = `!!this.token && !this.jwtToken && !this.account`.
  - `requestLogout()`: se `isAnonymous` imposta `recoveryModal = 'logout'`, altrimenti chiama `logout()`.
  - `readRecoveryHint()` ritorna `{ code, nickname, secretWord } | null` con `try/catch` su `localStorage`.
  - In `init()`, se `window.location.pathname === '/rientra'` e c'è `?token=`, risolve il link (`rejoinWithLink`) prima del resto; in caso di errore mostra un toast e porta alla schermata `join`.
  - `resolveClaim`: il ramo `already_registered` diventa l'unico (il ramo con `ClaimAccountModal` si toglie nel Task 11).

- [ ] **Step 1: Aggiungi i metodi a `api.js`** nello stile esistente.

- [ ] **Step 2: Aggiungi stato e metodi a `state.svelte.js`**, estraendo `_enterGame` da `login()` senza cambiarne il comportamento.

- [ ] **Step 3: Verifica la build**

Run: `cd frontend && npm run build`
Expected: build completata senza errori.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib
git commit -m "feat(frontend): client API e stato per i nuovi accessi"
```

---

### Task 8: Schermata "Partecipa" (ospiti) e percorso senza email

**Files:**
- Rewrite: `frontend/src/components/LoginView.svelte`
- Create: `frontend/src/components/AnonymousAccess.svelte`

**Interfaces:**
- Consumes: `appState.joinWithAccount`, `appState.joinAnonymous`, `appState.rejoinAnonymous`, `appState.hasAccount`, `readRecoveryHint()` (Task 7); `EmailVerificationField` (props esistenti: `bind:email`, `bind:verificationCode`, `bind:verified`, `purpose`, `label`, `placeholder`, `disabled`).
- Produces: `AnonymousAccess.svelte`, props `{ inviteCode: string }` (bindable), due modalità interne: `'new'` (Nuovo) e `'rejoin'` (Rientra).

Struttura di `LoginView.svelte` (riusa gli stili e la preview evento esistenti, tieni il blocco "Siete gli sposi?" che porta a `login-secure`):
1. Campo codice matrimonio con anteprima (codice esistente invariato).
2. Se `appState.hasAccount`: solo nickname, pulsante "Entra nel gioco" → `joinWithAccount`.
3. Altrimenti: `EmailVerificationField` con `purpose="login"`; dopo la verifica compare il nickname; "Entra nel gioco" → `joinWithAccount`.
4. Sotto il pulsante, due link ben visibili:
   - **"Sei già entrato e hai chiuso la pagina? Rientra qui"** → apre `AnonymousAccess` in modalità `'rejoin'`.
   - **"Non ho un'email"** → `AnonymousAccess` in modalità `'new'`.
5. Se `readRecoveryHint()` esiste e il codice coincide, precompila il nickname.

`AnonymousAccess.svelte`:
- Modalità `'new'`: nickname + parola segreta, testo che spiega che servirà per rientrare, pulsante → `appState.joinAnonymous`. Un errore 409 mostra il messaggio del server con un pulsante "Rientra" che passa alla modalità `'rejoin'`.
- Modalità `'rejoin'`: nickname + parola segreta (precompilati dall'hint se c'è), pulsante "Rientra" → `appState.rejoinAnonymous`. Errore 404 mostrato in chiaro sotto il form (non solo toast). Sotto: "Hai dimenticato la parola? Chiedi agli sposi un link di rientro".
- Un toggle in alto per passare da una modalità all'altra.

- [ ] **Step 1: Riscrivi `LoginView.svelte`** secondo la struttura sopra, rimuovendo il vecchio checkbox `noEmail` e il campo `secretWord` inline.

- [ ] **Step 2: Crea `AnonymousAccess.svelte`**.

- [ ] **Step 3: Verifica la build**

Run: `cd frontend && npm run build`
Expected: nessun errore né warning di accessibilità nuovi.

- [ ] **Step 4: Verifica a mano** (`cd worker && npm run dev` in un terminale e `cd frontend && npm run dev` in un altro, poi apri `/entra`; usa la skill `run`):
  - Ospite con email: codice evento → email → OTP → nickname → entra nel gioco.
  - "Non ho un'email" → nuovo ospite entra; ricarica pagina: resta dentro.
  - Esci (Task 10 non è ancora fatto: svuota `localStorage`), "Rientra" con nickname e parola giusti → stesso punteggio.
  - "Rientra" con un refuso → messaggio d'errore chiaro e **nessun nuovo ospite** nella lista dei partecipanti.
  - Nuovo con un nickname già usato → messaggio che rimanda a "Rientra".

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components
git commit -m "feat(frontend): schermata Partecipa lineare con Rientra esplicito e percorso senza email"
```

---

### Task 9: Login sposi / account (email + codice, password opzionale)

**Files:**
- Rewrite: `frontend/src/components/SecureLoginView.svelte`

**Interfaces:**
- Consumes: `appState.emailLogin(email, code)`, `appState.loginSecure(email, password)` (esistente), `EmailVerificationField` con `purpose="login"`.

Comportamento:
- Di default: email → codice OTP → "Accedi" (`emailLogin`). Dopo la verifica del codice il pulsante si abilita.
- Link "Entra con password" alterna al form `email + password` (`loginSecure`, comportamento attuale).
- La modalità "Registrati" (`register`, nome/email/password/conferma) sparisce: chi non ha un account lo crea entrando con un codice, oppure da `CreateEventView`.
- Testo di aiuto: "Ti mandiamo un codice via email. Niente password da ricordare."

- [ ] **Step 1: Riscrivi `SecureLoginView.svelte`**, riusando gli stili esistenti.

- [ ] **Step 2: Verifica la build**

Run: `cd frontend && npm run build`
Expected: nessun errore.

- [ ] **Step 3: Verifica a mano** su `/dashboard_utente`:
  - Email nuova + codice → arriva alla dashboard (account creato).
  - Account con password esistente: codice → dashboard; "Entra con password" → dashboard.
  - Codice sbagliato → errore e nessun accesso.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/SecureLoginView.svelte
git commit -m "feat(frontend): login account con codice email, password opzionale"
```

---

### Task 10: Rientro facile: modal di recupero, conferma di uscita e menu

**Files:**
- Create: `frontend/src/components/RecoveryModal.svelte`
- Modify: `frontend/src/App.svelte` (monta `<RecoveryModal />` accanto a `InstructionsModal`)
- Modify: `frontend/src/components/SiteHeader.svelte`, `frontend/src/components/Navbar.svelte`

**Interfaces:**
- Consumes: `appState.recoveryModal`, `appState.requestLogout()`, `appState.logout()`, `appState.isAnonymous`, `appState.user`, `readRecoveryHint()` (Task 7).

`RecoveryModal.svelte` (stile di `InstructionsModal.svelte`) mostra in base a `appState.recoveryModal`:
- `'first'`: titolo "Salva i tuoi dati di rientro", nickname e parola in evidenza, pulsanti **Copia** (`navigator.clipboard.writeText` con testo "Fanta Matrimonio, codice <code>, nickname <n>, parola <p>") e **Condividi** (`navigator.share` se disponibile, altrimenti nascosto), pulsante "Ho capito".
- `'info'`: stesso contenuto, titolo "Come rientrare", con la spiegazione dei passi ("Se chiudi la pagina: apri il sito, scegli «Rientra», inserisci codice, nickname e parola") e il suggerimento di chiedere agli sposi un link di rientro.
- `'logout'`: "Se esci dovrai reinserire nickname e parola segreta" con nickname e parola mostrati; pulsanti "Annulla" e "Esci comunque" (`appState.logout()`).

Modifiche al menu:
- Sia `SiteHeader.svelte` sia `Navbar.svelte`: `handleLogout` chiama `appState.requestLogout()` al posto di `confirm(...)` + `logout()` (per account e sposi `requestLogout` esce subito dopo il `confirm` esistente: mantieni il `confirm` solo quando **non** `isAnonymous`).
- Voce **"Come rientrare"** nel dropdown di `SiteHeader` e un pulsante nella `Navbar`, visibili solo se `appState.isAnonymous`; impostano `appState.recoveryModal = 'info'`.
- Il pulsante "Registra account" (`showUpgradeModal`) in `Navbar.svelte` si rimuove (vedi Task 11).

- [ ] **Step 1: Crea `RecoveryModal.svelte`** e montalo in `App.svelte`.

- [ ] **Step 2: Aggiorna `SiteHeader.svelte` e `Navbar.svelte`** come sopra.

- [ ] **Step 3: Verifica la build**

Run: `cd frontend && npm run build`
Expected: nessun errore.

- [ ] **Step 4: Verifica a mano** (ospite senza email):
  - Dopo "Non ho un'email" compare "Salva i tuoi dati di rientro"; "Copia" mette il testo negli appunti.
  - "Esci" mostra il modal di conferma con nickname e parola; "Annulla" non esce.
  - "Come rientrare" nel menu riapre le istruzioni.
  - Un ospite con email e uno sposo escono come prima (nessun modal nuovo).

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): modal di recupero, conferma di uscita per ospiti senza email e voce Come rientrare"
```

---

### Task 11: Link di rientro (sposi e pagina `/rientra`) e pulizia modali vecchi

**Files:**
- Modify: `frontend/src/components/DashboardView.svelte`
- Modify: `frontend/src/lib/state.svelte.js` (route `/rientra` in `syncRouteFromUrl`, rimozione stato claim/upgrade)
- Modify: `frontend/src/App.svelte` (rimuove i due modal)
- Delete: `frontend/src/components/ClaimAccountModal.svelte`, `frontend/src/components/UpgradeAccountModal.svelte`

**Interfaces:**
- Consumes: `api.createRejoinLink(eventId, userId)`, `participants[].has_email` (Task 5), `appState.rejoinWithLink` (Task 7).

Dashboard sposi (sezione `participants` di `DashboardView.svelte`):
- Se `eventDetail.is_couple` e `p.role === 'guest'` e `p.has_email === false`, accanto al punteggio compare **"Link di rientro"**. Il click chiama `api.createRejoinLink(eventDetail.event.id, p.id)`, copia l'URL negli appunti e mostra un toast "Link copiato: mandalo all'ospite. I link precedenti non valgono più." Se `navigator.share` esiste, offre anche "Condividi".

Pagina `/rientra?token=...`:
- Mostra un breve riquadro "Rientra nel matrimonio" con un campo opzionale "Nuova parola segreta (se l'hai dimenticata)" e il pulsante "Entra", che chiama `appState.rejoinWithLink(token, newWord)`. Va resa da `LoginView` quando `window.location.pathname === '/rientra'` (nessun nuovo file).

Pulizia:
- Rimuovi da `state.svelte.js`: `showUpgradeModal`, `showClaimModal`, `pendingClaimToken`, `claimData`, `completeClaim`, `upgradeAccount`, il ramo `?upgrade=1` e il ramo di `resolveClaim` che apriva il modal.
- Rimuovi da `api.js`: nulla (gli endpoint restano usati dal mobile e dai vecchi link).
- Rimuovi gli import e i tag dei due modal da `App.svelte` ed elimina i due file.

- [ ] **Step 1: Aggiungi il pulsante nella lista partecipanti** e il riquadro `/rientra`.

- [ ] **Step 2: Rimuovi stato e componenti vecchi** come elencato.

- [ ] **Step 3: Verifica la build**

Run: `cd frontend && npm run build && grep -rn "UpgradeAccountModal\|ClaimAccountModal\|showUpgradeModal\|showClaimModal" src || echo "nessun riferimento residuo"`
Expected: build ok e "nessun riferimento residuo".

- [ ] **Step 4: Verifica a mano**:
  - Da sposo, dashboard → partecipanti: "Link di rientro" compare solo per ospiti senza email; copia un URL `/rientra?token=...`.
  - Aprendo l'URL in una finestra anonima l'ospite rientra con i punti di prima.
  - Rigenerando il link, il primo smette di funzionare con messaggio chiaro.
  - Un link di recupero email (`/completa-account?claim=...`) porta direttamente alla dashboard senza chiedere password.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): link di rientro dagli sposi, pagina /rientra e rimozione modal upgrade/claim"
```

---

### Task 12: Verifica finale

**Files:** nessuna modifica prevista (solo correzioni emerse dalla verifica).

- [ ] **Step 1: Test e tipi del worker**

Run: `cd worker && npx vitest run && npm run typecheck`
Expected: tutti i test PASS, typecheck pulito.

- [ ] **Step 2: Build del frontend**

Run: `cd frontend && npm run build`
Expected: build completata.

- [ ] **Step 3: Percorso completo in locale** (skill `verification-before-completion`): ripeti le verifiche a mano dei Task 8, 9, 10 e 11 con worker e frontend avviati, annotando l'esito di ciascuna.

- [ ] **Step 4: Controlla la compatibilità mobile**: `curl -s -X POST http://localhost:8000/api/auth/login -H "content-type: application/json" -d '{"invite_code":"<CODICE>","first_name":"Test","last_name":"Mobile","secret_word":"sole"}'`
Expected: risposta 200 con `token`, `user`, `event`, `is_new`.

- [ ] **Step 5: Ricorda all'utente di applicare `db/migration_v7_access.sql` su Neon** prima del deploy, poi preparare il merge con la skill `finishing-a-development-branch`.

---

## Self-review

- **Copertura della spec:** §3 porta 1 → Task 3, 8; porta 2 → Task 3, 9; §4.1 → Task 4, 8; §4.2 → Task 10; §4.3 → Task 7, 10; §4.4 → Task 5, 11; §4.5 (nickname precompilato, rate limit) → Task 4, 8; fase 3 (magic link) → Task 6, 11; fase 6 (test) → Task 1-6. Fase 2 e fase 5 sono deviazioni esplicite (sopra).
- **Coerenza dei nomi:** `findOrCreateVerifiedAccount`, `joinEvent`, `startSession`, `assertAttemptsAllowed`, `recordFailedAttempt`, `createRejoinToken`, `emailLogin`, `joinWithAccount`, `joinAnonymous`, `rejoinAnonymous`, `rejoinWithLink`, `createRejoinLink`, `recoveryModal`, `isAnonymous`, `requestLogout`, `readRecoveryHint` sono usati allo stesso modo in tutti i task.
- **Rischio principale:** PGlite potrebbe non eseguire tutto `schema_complete.sql` (trigger/funzioni). Il Task 1 lo verifica subito e prevede il fallback documentato.
