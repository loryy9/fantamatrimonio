# Fanta Matrimonio — frontend

SvelteKit 3 (Svelte 5) in modalità SPA: tutto gira nel browser. La build (`dist/`) è servita
dal Worker Cloudflare insieme alle API (`../worker`), che rimanda ogni URL sconosciuto a `index.html`.

## Comandi

```sh
npm run dev      # http://localhost:5173 — le chiamate /api vanno al Worker (wrangler dev, porta 8000)
npm run build    # genera dist/
```

## Pagine

Ogni pagina è una cartella in `src/routes`. Gli URL sono definiti in `src/lib/routes.js`.

| URL | Pagina | Accesso |
| --- | --- | --- |
| `/` | Landing | con un account e nessun matrimonio aperto → `/dashboard_utente`; `/?code=X` → `/entra?code=X` |
| `/entra` | Entra nella festa (codice invito) | registrazione se non si ha un account |
| `/crea` | Creazione matrimonio → configurazione sfide → codice | chiede conferma prima di uscire durante la configurazione |
| `/login` | Accedi | con un account → dashboard (o `/entra?code=X` se arrivati da un invito) |
| `/dashboard_utente` | I miei matrimoni (`?event=<id>` per il dettaglio) | serve un account |
| `/partita/<codice>/<tab>` | Gioco: `home`, `gallery`, `hunt`, `quiz`, `leaderboard` | serve il matrimonio di quel codice aperto, altrimenti → `/entra?code=<codice>` |
| `/partita/<codice>/setup` | Modifica sfide | solo sposi |
| `/admin` | Console admin | login admin |

## Struttura

```
src/
  app.html                 template HTML (con lo splash mostrato al caricamento)
  routes/
    +layout.js             SPA (ssr = false); attende il recupero della sessione prima di ogni pagina
    +layout.svelte         stili globali, toast, dialoghi di conferma
    (site)/                pagine del sito: topbar bianca + footer
    (game)/partita/[code]/ pagine del gioco: navbar bordeaux + tab in basso
    admin/
  components/              componenti delle pagine (import: #components/...)
  lib/                     stato globale, API, URL (import: #lib/...)
```

I controlli di accesso stanno nei `load` di `+page.js` / `+layout.js`: la pagina non viene
nemmeno mostrata se l'utente va reindirizzato.
