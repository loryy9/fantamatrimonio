# Piano: semplificazione del login

Data: 2026-10-16 · Stato: bozza da approvare (nessun codice modificato)

## 1. Problema

Oggi ci sono 8 percorsi di accesso e 2 tipi di token, e l'utente non capisce quale usare.

| # | Percorso | Endpoint |
|---|---|---|
| 1 | Ospite con email, OTP e nickname | `POST /auth/login` (ramo email) |
| 2 | Ospite senza email, nickname e parola segreta | `POST /auth/login` (`no_email`) |
| 3 | Sposi con codice evento e parola segreta | `POST /auth/login` (`is_couple`) |
| 4 | Legacy: nome, cognome e parola segreta | `POST /auth/login` (ramo 4) |
| 5 | Account con email e password | `/auth/register`, `/auth/login-secure` |
| 6 | Ospite che passa ad account (upgrade) | `/auth/upgrade` |
| 7 | Link di recupero via email (claim) | `/auth/claim-info`, `/auth/complete-claim` |
| 8 | Account già loggato che entra con solo nickname | `/auth/login` (header Bearer) |

- **Token:** esistono sessione UUID e JWT, trattati in modo diverso da `requireUser` e `requireAccount` (`worker/src/auth.ts`).
- **Lato utente:** l'ospite non sa se deve creare un account, se serve la password o se basta l'email. Gli sposi hanno due modi di entrare (parola segreta o password).
- **Ospiti senza email:** un errore di battitura in nickname o parola crea in silenzio un nuovo profilo a zero (vedi §4).

## 2. Obiettivi, non-obiettivi, da evitare

**Obiettivi**
- Due porte d'ingresso chiare: ospiti e sposi/account.
- Una sola identità: l'email è la chiave e l'account nasce alla prima verifica.
- Rientrare dopo un'uscita accidentale deve essere facile e visibilmente possibile.

**Non-obiettivi**
- Nessun login social (Google, Apple ecc.).
- Nessuna modifica a punteggi, quiz, foto, classifica.

**Da evitare**
- Perdere i progressi di un ospite per un errore di digitazione.
- Rompere gli account con password già esistenti.
- Obbligare l'email agli ospiti che non ne hanno una.

## 3. Nuovo modello di accesso

**Regola unica:** l'email si verifica con un codice a 6 cifre (OTP). L'account si crea automaticamente alla prima verifica, senza passaggio "upgrade".

### Porta 1: "Partecipa" (ospiti)
1. Codice matrimonio, poi email, poi OTP.
2. Nickname solo se è la prima volta in quell'evento.
3. Un account già loggato salta email e OTP e inserisce solo il nickname.
4. Link secondario "Non ho un'email" che porta al percorso senza email (§4).

### Porta 2: "Sposi / Il mio account"
1. Email, poi OTP.
2. Se l'account ha già una password esiste anche "Entra con password" (compatibilità).
3. Se l'account ha più eventi, la scelta avviene nella dashboard.
4. La parola segreta sposi non è più un metodo di login. Resta solo se serve come PIN per azioni sensibili (da verificare nel codice).

> **Scelta mia, da confermare:** sposi senza password, solo codice via email. È più semplice da usare e da mantenere. L'alternativa è tenere la password come opzione, con un percorso in più.

## 4. Ospiti senza email: rientro facile

**Stato attuale (`auth.ts`, ramo `no_email`):** si rientra con codice matrimonio, nickname e parola segreta. Se la combinazione non corrisponde, il codice **crea un nuovo utente**. Un refuso significa quindi profilo nuovo con punteggio e foto a zero. Inoltre il form è lo stesso della registrazione e non è chiaro che si possa rientrare.

### 4.1 "Nuovo" e "Rientra" sono azioni separate
- Nella schermata ospiti compare un blocco ben visibile: **"Sei già entrato e hai chiuso la pagina? Rientra qui"**.
- **Rientra** chiede codice matrimonio, nickname e parola segreta e **non crea mai un utente**.
  - Se non trova niente: "Non troviamo questo nickname con questa parola. Controlla le maiuscole o chiedi agli sposi di aiutarti".
- **Nuovo** rifiuta un nickname già usato nell'evento con una parola diversa, spiegando che deve usare "Rientra" o scegliere un altro nickname.
- Backend: due endpoint distinti (`/auth/join-anonymous` e `/auth/rejoin-anonymous`).

### 4.2 Prevenire l'uscita accidentale
- Il pulsante "Esci" per un ospite senza email apre una conferma: "Se esci dovrai reinserire nickname e parola segreta", con il suo nickname mostrato.
- La sessione dura già 30 giorni, quindi chiudere il browser non basta a farlo uscire.

### 4.3 Promemoria dei dati subito dopo l'ingresso
- Al primo accesso compare la scheda **"Salva i tuoi dati di rientro"** con nickname e parola e il pulsante **Copia / Condividi** (WhatsApp a sé stessi, oppure screenshot).
- Nel menu resta una voce permanente **"Come rientrare"**.

### 4.4 Link di rientro generato dagli sposi
- Nella dashboard sposi, accanto a ogni ospite senza email, il pulsante **"Genera link di rientro"**.
- Il link contiene un token firmato (tipo `rejoin_guest`, scadenza lunga) e riporta lo **stesso profilo utente**, quindi i progressi restano. Funziona anche per chi ha dimenticato la parola.
- Quando si usa il link, la parola segreta può essere reimpostata.
- Incluso nella prima versione.

### 4.5 Dettagli
- Il nickname viene precompilato dal dispositivo (localStorage).
- Rate limit sui tentativi di "Rientra": le parole segrete semplici si indovinano.
- Il confronto di nickname e parola resta case-insensitive, come oggi.

## 5. Fasi di implementazione

### Fase 1: backend, endpoint unificati
- `POST /auth/otp/request` e `POST /auth/otp/verify`: la verifica crea o recupera l'account e restituisce il token.
- `POST /auth/join`: collega account, evento e nickname. Sostituisce il ramo email, il ramo account (#8) e `/upgrade`.
- `POST /auth/join-anonymous` e `POST /auth/rejoin-anonymous` (§4.1).
- `POST /dashboard/guests/:id/rejoin-link` per gli sposi (§4.4), più la rotta che consuma il link.
- Rate limit sui tentativi di rientro.

### Fase 2: token e middleware
- Gli account usano il JWT. Gli ospiti senza email mantengono la sessione UUID.
- Un solo `resolveUser`. Si eliminano le eccezioni in `requireAccount`.

### Fase 3: link email di recupero
- `claim_guest` diventa un login diretto (magic link).
- `/complete-claim` non serve più. `registration_reminders` resta.

### Fase 4: frontend
- `LoginView`: flusso lineare in 3 passi, più il blocco "Rientra" (§4.1).
- Una sola `AccountLoginView` al posto di `login-secure`, `ClaimAccountModal`, `UpgradeAccountModal`.
- Conferma di uscita (§4.2), scheda "Salva i tuoi dati" (§4.3), voce "Come rientrare".
- Dashboard sposi: "Genera link di rientro" (§4.4).
- Riutilizzo di `EmailVerificationField`.

### Fase 5: migrazione e pulizia
- Gli account con password esistenti continuano a funzionare.
- Controllare nel DB se qualcuno usa il ramo legacy (#4) e poi rimuoverlo.
- Dopo uno o due rilasci togliere `/register`, `/login-secure`, `/upgrade`, `/claim-*`.

### Fase 6: test
- Un test per ogni percorso rimasto.
- Casi limite: email già associata a un altro evento, OTP scaduto, account con più eventi.
- Rientro senza email: refuso (non deve creare utenti), nickname duplicato, link di rientro, rate limit.

## 6. Funzionalità mantenute
- Ospiti senza email.
- Dashboard con più eventi.
- Recupero via email dopo la festa.
- Codici evento e anteprima.
- Accesso sposi.
- Verifica email obbligatoria prima di tutto (commit `6af7e71`).

## 7. Rischi
- **Compatibilità:** i token e gli account già emessi devono restare validi (stesso `JWT_SECRET`).
- **Consegna OTP:** il login sposi dipende dall'invio email. Serve un fallback se la mail non arriva (es. reinvio, e la password per gli account che la hanno).
- **Link di rientro:** va trattato come credenziale (scadenza, un solo evento, revocabile).

## 8. Punti aperti
- Sposi senza password (scelta consigliata) o con password opzionale?
- La parola segreta sposi serve ancora per azioni sensibili? Da verificare nel codice di `worker/src/routes`.
- Durata del link di rientro e durata del JWT (`jwtExpireHours`).
