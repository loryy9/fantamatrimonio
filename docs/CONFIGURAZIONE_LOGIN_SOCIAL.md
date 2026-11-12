# Configurare il login con Google e Facebook

Il login social è opzionale: finché le chiavi non sono impostate, i pulsanti non compaiono e resta il login con email e password.

Il flusso è questo: il browser ottiene un token dal provider e lo manda a `POST /api/auth/social`. Il Worker lo verifica direttamente con Google o Facebook (`worker/src/social.ts`).

> Le schermate delle console Google e Meta cambiano spesso. Se un nome di menu non corrisponde, cerca la voce equivalente.

## 0. Prerequisiti (una volta sola)

1. Esegui `db/migration_v8_social_auth.sql` nell'SQL Editor di Neon. Aggiunge `accounts.nickname` e la tabella `account_identities`.
2. Decidi i domini che userai. Esempi:
   - sviluppo: `http://localhost:5173` (frontend Vite)
   - produzione: `https://tuodominio.it`, oppure `https://fantamatrimonio.<subdominio>.workers.dev`

   Le stesse origini vanno registrate su entrambi i provider.

---

## 1. Google

Serve solo il **Client ID**, nessun secret. Il Worker controlla che il token sia stato emesso per quel Client ID.

### 1.1 Crea il progetto
1. Vai su <https://console.cloud.google.com> e crea un progetto (es. "Fanta Matrimonio").
2. Apri **API e servizi → Schermata consenso OAuth** (oggi può chiamarsi **Google Auth Platform**).
3. Tipo di utente: **Esterno**.
4. Compila il nome app, l'email di supporto e l'email dello sviluppatore.
5. Ambiti: bastano quelli base `email`, `profile`, `openid`. Non servono ambiti sensibili.
6. Aggiungi la **privacy policy** e i domini autorizzati, se richiesti.

### 1.2 Crea il Client ID
1. Vai su **API e servizi → Credenziali → Crea credenziali → ID client OAuth**.
2. Tipo di applicazione: **Applicazione web**.
3. **Origini JavaScript autorizzate**: aggiungi
   - `http://localhost:5173`
   - `http://localhost:8000` (se apri l'app dal Worker in locale)
   - il dominio di produzione, es. `https://tuodominio.it`
4. **URI di reindirizzamento autorizzati**: lascia vuoto. Il pulsante Google (popup con ID token) non li usa.
5. Salva e copia il **Client ID**, nel formato `xxxx.apps.googleusercontent.com`.

### 1.3 Pubblica l'app
Finché l'app è in modalità **Test**, possono accedere solo gli utenti che aggiungi in "Utenti di test". Prima di aprirla agli invitati vai nella schermata consenso e premi **Pubblica app** (stato "In produzione"). Con gli ambiti base non serve la verifica di Google.

### 1.4 Imposta la variabile
- **Locale:** in `worker/.dev.vars` aggiungi
  ```
  GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
  ```
- **Produzione:** è un valore pubblico, quindi puoi metterlo in `worker/wrangler.jsonc` dentro `vars`:
  ```jsonc
  "vars": { "GOOGLE_CLIENT_ID": "xxxx.apps.googleusercontent.com", ... }
  ```
  In alternativa: `npx wrangler secret put GOOGLE_CLIENT_ID`.

---

## 2. Facebook

Servono **App ID** e **App Secret**. Il secret serve al Worker per verificare che il token sia stato emesso per la tua app, quindi non va mai nel frontend.

### 2.1 Crea l'app
1. Vai su <https://developers.facebook.com> e accedi con un account Facebook. Se è la prima volta, registrati come sviluppatore.
2. **Crea app** → caso d'uso **Autenticazione e creazione dell'account** (o "Accedi con Facebook").
3. Dai un nome all'app e inserisci l'email di contatto.

### 2.2 Abilita il login
1. Nella dashboard dell'app aggiungi il prodotto **Facebook Login** (se non c'è già).
2. In **Facebook Login → Impostazioni**:
   - attiva **Login con l'SDK JavaScript**
   - in **Domini consentiti per l'SDK JavaScript** aggiungi le origini (`https://tuodominio.it`, e `http://localhost:5173` per i test)
3. In **Impostazioni app → Di base**:
   - **Domini dell'app**: `tuodominio.it`
   - **URL dell'informativa sulla privacy**: obbligatorio per andare in produzione
   - **Categoria** dell'app
   - **URL per l'eliminazione dei dati** (o istruzioni): Meta lo chiede per le app live
4. Copia **ID app** e **Chiave segreta dell'app** (premi "Mostra").

I permessi `public_profile` e `email` sono disponibili di default e non richiedono la revisione dell'app.

### 2.3 Metti l'app in modalità Live
Finché l'app è in **Sviluppo**, possono accedere solo amministratori, sviluppatori e tester dell'app. Per aprirla a tutti, attiva l'interruttore **In sviluppo → Live** in alto nella dashboard. Meta lo permette solo dopo aver inserito privacy policy e categoria.

### 2.4 Imposta le variabili
- **Locale:** in `worker/.dev.vars`
  ```
  FACEBOOK_APP_ID=1234567890
  FACEBOOK_APP_SECRET=il_tuo_secret
  ```
- **Produzione:** l'ID è pubblico e può stare in `wrangler.jsonc` → `vars`, mentre il secret va messo come segreto:
  ```
  cd worker
  npx wrangler secret put FACEBOOK_APP_SECRET
  ```
  Imposta `FACEBOOK_APP_ID` in `vars` oppure con `wrangler secret put FACEBOOK_APP_ID`.

I pulsanti compaiono solo se `FACEBOOK_APP_ID` **e** `FACEBOOK_APP_SECRET` sono entrambi presenti.

> Il login Facebook via SDK JavaScript richiede HTTPS. Su `localhost` di solito funziona in modalità Sviluppo. Se in locale il popup non parte, prova con un dominio HTTPS (ad esempio un tunnel) oppure prova direttamente in produzione.

---

## 3. Pubblicare

```
cd worker
npm run deploy      # costruisce il frontend e fa il deploy del Worker
```

Controlla che il Worker legga le chiavi aprendo:

```
https://<tuo-dominio>/api/auth/providers
```

La risposta deve mostrare i provider attivi, ad esempio:

```json
{ "google_client_id": "xxxx.apps.googleusercontent.com", "facebook_app_id": "1234567890" }
```

Un valore `null` significa che quella variabile non è stata letta.

## 4. Prova

1. Apri `/login` e controlla che compaiano **Continua con Google** e **Continua con Facebook**.
2. Accedi con Google: deve crearsi un account (se l'email è nuova) e aprirsi la dashboard.
3. Esci e accedi di nuovo con lo stesso provider: deve entrare nello stesso account.
4. Registrati con email e password usando un indirizzo uguale a quello di un account social: l'app deve rispondere che l'email è già registrata con Google o Facebook.
5. Apri `/entra` da disconnesso: deve apparire prima il login e poi il form con il codice.

## 5. Problemi comuni

| Sintomo | Causa probabile |
|---|---|
| Nessun pulsante social | Variabili non lette: controlla `/api/auth/providers` |
| Google: "origin_mismatch" o il popup non si apre | Il dominio non è tra le **Origini JavaScript autorizzate** |
| Google: "Accesso bloccato / app in test" | L'app è in modalità Test e l'utente non è tra gli utenti di test |
| Facebook: "Dominio non incluso nelle impostazioni dell'app" | Dominio mancante in **Domini consentiti per l'SDK JavaScript** o in **Domini dell'app** |
| Facebook: funziona solo per te | L'app è in modalità Sviluppo: mettila Live |
| Errore 401 "Accesso con Facebook non valido" | `FACEBOOK_APP_SECRET` errato, oppure token di un'altra app |
| "non ha fornito un'email verificata" | L'account Facebook non ha un'email. L'utente deve registrarsi con email e password |

## Apple

Non è incluso: richiede l'Apple Developer Program (circa 99 €/anno). Se pubblicherai l'app iOS offrendo anche Google o Facebook, Apple di solito richiede anche "Accedi con Apple".
