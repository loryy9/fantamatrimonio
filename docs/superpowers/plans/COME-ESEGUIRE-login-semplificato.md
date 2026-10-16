# Come eseguire il piano "Login semplificato"

Documenti collegati:
- Spec: `docs/superpowers/specs/2026-10-16-login-semplificato-design.md`
- Piano di implementazione (12 task): `docs/superpowers/plans/2026-10-16-login-semplificato.md`

## Prima di iniziare

1. **Metti al sicuro il lavoro in corso.** Sul branch `worker-neon` ci sono modifiche non committate in `frontend/` e `worker/src/routes/dashboard.ts`, più `worker/pnpm-workspace.yaml`. Committale oppure usa `git stash`, così il piano parte da un albero pulito.
2. **Crea il branch di lavoro:** `git switch -c login-semplificato`
3. **Controlla gli strumenti:** `node -v` (serve Node 20 o più recente), poi `cd worker && npm install` e `cd ../frontend && npm install`.
4. **Decisioni da confermare** (se non le cambi, il piano usa questi valori):
   - Sposi: accesso con codice via email, password opzionale.
   - Link di rientro valido 30 giorni.
   - Nickname già usato in "Nuovo" (senza email): sempre rifiutato.
   - Endpoint vecchi e ramo legacy di `/auth/login` restano attivi (li usa l'app mobile).

## Come avviare l'esecuzione

Apri Claude Code nella cartella del progetto e scrivi uno di questi messaggi.

**Con subagent (consigliato):**
> Esegui il piano `docs/superpowers/plans/2026-10-16-login-semplificato.md` con superpowers:subagent-driven-development, partendo dal Task 1.

**Direttamente in sessione:**
> Esegui il piano `docs/superpowers/plans/2026-10-16-login-semplificato.md` con superpowers:executing-plans, partendo dal Task 1.

Per riprendere dopo un'interruzione, aggiungi: "Riprendi dal Task N" (le caselle `- [ ]` del piano indicano cosa è già fatto).

## Ordine e dipendenze

| Task | Cosa | Dipende da |
|---|---|---|
| 1 | Harness di test e migrazione DB | nessuno |
| 2 | Helper account e rate limit | 1 |
| 3 | `email-login` e `join` | 2 |
| 4 | Ospiti senza email: Nuovo e Rientra | 2 |
| 5 | Link di rientro degli sposi | 4 |
| 6 | Link email di recupero (magic link) | 2 |
| 7 | Client API e stato frontend | 3, 4, 5 |
| 8 | Schermata "Partecipa" | 7 |
| 9 | Login sposi / account | 7 |
| 10 | Modal di recupero e conferma di uscita | 7 |
| 11 | Link di rientro (UI) e pulizia modali | 5, 7 |
| 12 | Verifica finale | tutti |

I task 1-6 sono solo backend e si possono testare senza il frontend. Dal 7 in poi serve il backend completo.

## Dopo l'esecuzione

- **Applica `db/migration_v7_access.sql` su Neon** prima del deploy (a mano, come per le migrazioni precedenti).
- Nel Task 12 si controlla anche che `POST /api/auth/login` risponda ancora come prima, perché l'app mobile lo usa.
- Per chiudere il lavoro usa la skill `superpowers:finishing-a-development-branch`.

## Rischi da tenere d'occhio

- **PGlite:** potrebbe non caricare tutto `db/schema_complete.sql` (trigger e funzioni). Se succede nel Task 1, il piano indica il piano B (eseguire le istruzioni una a una).
- **Consegna email:** il login degli sposi dipende dall'invio dei codici. Controlla le variabili SMTP/Gmail prima di provare a mano.
- **Frontend senza test automatici:** le verifiche dei task 8-11 sono manuali, da eseguire con worker e frontend in locale (`cd worker && npm run dev`, `cd frontend && npm run dev`).
