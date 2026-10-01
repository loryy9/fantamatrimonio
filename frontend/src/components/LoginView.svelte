<script>
  import { appState } from '../lib/state.svelte.js';
  import { formatName } from '../lib/formatters.js';

  // Assigned after init so the compiler keeps it reactive for bind:value.
  let inviteCode = $state('');
  inviteCode = new URLSearchParams(window.location.search).get('code') || '';
  let firstName = $state('');
  let lastName = $state('');
  let secretWord = $state('');
  let email = $state('');
  let isCoupleLogin = $state(window.location.hash === '#/sposi');
  let isSubmitting = $state(false);
  let errorMessage = $state('');

  function switchMode(couple) {
    isCoupleLogin = couple;
    errorMessage = '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!inviteCode.trim() || !firstName.trim() || !lastName.trim() || !secretWord.trim()) {
      errorMessage = 'Per favore compila tutti i campi!';
      return;
    }

    errorMessage = '';
    isSubmitting = true;

    try {
      const res = await appState.login(
        inviteCode.trim().toUpperCase(),
        formatName(firstName),
        formatName(lastName),
        secretWord.trim(),
        isCoupleLogin,
        email.trim() || null
      );
      if (!res.success) {
        errorMessage = res.error || 'Accesso non riuscito. Controlla i dati inseriti.';
      }
    } catch (err) {
      errorMessage = err.message || 'Errore di connessione.';
    } finally {
      isSubmitting = false;
    }
  }
</script>

<div class="join-layout">
  <div class="join-intro">
    {#if isCoupleLogin}
      <span class="eyebrow eyebrow-couple">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M5 20h14"/></svg>
        Area Riservata
      </span>
      <h1 class="page-title">Console <span class="gold-gradient-text">Sposi</span></h1>
      <p class="page-lead">
        Accedi al pannello di gestione del tuo matrimonio. Da qui potrai personalizzare le domande,
        gestire i quiz, visualizzare le foto e controllare le risposte dei tuoi ospiti in tempo reale.
      </p>
      <ul class="tips">
        <li>Inserisci il codice invito del vostro matrimonio.</li>
        <li>Inserisci il tuo nome e la parola segreta scelta alla registrazione.</li>
        <li>Avrai accesso immediato alla dashboard di gestione.</li>
      </ul>
      <p class="switch">
        Sei un invitato?
        <button type="button" class="link-btn" onclick={() => switchMode(false)}>Accedi come Invitato</button>
      </p>
    {:else}
      <span class="eyebrow">Invitati</span>
      <h1 class="page-title">Entra nel <span class="gold-gradient-text">matrimonio</span></h1>
      <p class="page-lead">
        Inserisci il codice invito ricevuto dagli sposi e le tue credenziali. Nessuna password complessa:
        bastano il tuo nome e una parola segreta che ricorderai.
      </p>
      <ul class="tips">
        <li>Se è la prima volta, il tuo profilo viene creato automaticamente.</li>
        <li>Per rientrare da un altro dispositivo usa gli stessi dati.</li>
      </ul>
      <p class="switch">
        Siete gli sposi?
        <button type="button" class="link-btn" onclick={() => switchMode(true)}>Accedi alla Console Sposi</button>
        <span class="sep">oppure</span>
        <button type="button" class="link-btn" onclick={() => appState.setAuthView('create')}>Crea un nuovo matrimonio</button>
      </p>
      <p class="switch">
        Hai già un account?
        <button type="button" class="link-btn" onclick={() => appState.setAuthView('login-secure')}>Accedi con email e password</button>
      </p>
    {/if}
  </div>

  <form class="auth-card join-form" onsubmit={handleSubmit}>
    <div class="auth-toggle" role="tablist" aria-label="Modalità di accesso">
      <button
        type="button"
        role="tab"
        aria-selected={!isCoupleLogin}
        class="auth-toggle-btn"
        class:active={!isCoupleLogin}
        onclick={() => switchMode(false)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <span>Invitato</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={isCoupleLogin}
        class="auth-toggle-btn"
        class:active={isCoupleLogin}
        class:sposi-active={isCoupleLogin}
        onclick={() => switchMode(true)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M5 20h14"/></svg>
        <span>Sposi</span>
      </button>
    </div>

    <h2 class="form-title font-serif">
      {isCoupleLogin ? 'Accesso Console Sposi' : 'Accedi o Registrati'}
    </h2>

    {#if errorMessage}
      <div class="form-error" role="alert">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
        <span>{errorMessage}</span>
      </div>
    {/if}

    <div class="input-group">
      <label for="inviteCode" class="input-label">Codice invito matrimonio</label>
      <input
        id="inviteCode"
        type="text"
        class="input-field code-input"
        placeholder="Es. K7M2QX"
        bind:value={inviteCode}
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
        required
      />
    </div>

    <div class="row">
      <div class="input-group">
        <label for="firstName" class="input-label">
          {isCoupleLogin ? 'Nome sposo / sposa' : 'Nome'}
        </label>
        <input
          id="firstName"
          type="text"
          class="input-field"
          placeholder={isCoupleLogin ? 'Es. Giulia' : 'Es. Mario'}
          bind:value={firstName}
          autocomplete="given-name"
          required
        />
      </div>
      <div class="input-group">
        <label for="lastName" class="input-label">Cognome</label>
        <input
          id="lastName"
          type="text"
          class="input-field"
          placeholder={isCoupleLogin ? 'Es. Bellotti' : 'Es. Rossi'}
          bind:value={lastName}
          autocomplete="family-name"
          required
        />
      </div>
    </div>

    <div class="input-group">
      <label for="secretWord" class="input-label">
        {isCoupleLogin ? 'Parola segreta sposi' : 'Parola personale'}
      </label>
      <input
        id="secretWord"
        type="password"
        class="input-field"
        placeholder={isCoupleLogin ? 'La parola impostata alla creazione' : 'Es. pizza, stella, 1234...'}
        bind:value={secretWord}
        autocomplete="current-password"
        required
      />
      <span class="field-hint">
        {isCoupleLogin
          ? 'Inserisci la parola segreta scelta al momento della creazione del matrimonio.'
          : 'Serve per rientrare dal tuo telefono o cambiare dispositivo.'}
      </span>
    </div>

    {#if !isCoupleLogin}
      <div class="input-group email-optional">
        <label for="guestEmail" class="input-label email-label">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
          Vuoi ricevere i ricordi della festa?
        </label>
        <input
          id="guestEmail"
          type="email"
          class="input-field"
          placeholder="La tua email (facoltativa)"
          bind:value={email}
          autocomplete="email"
        />
        <span class="field-hint">Facoltativa · Ti manderemo un riepilogo con foto e risultati dopo il matrimonio.</span>
      </div>
    {/if}

    <button type="submit" class="btn btn-primary btn-lg btn-block" disabled={isSubmitting}>
      {#if isSubmitting}
        <div class="spinner spinner-on-dark"></div>
        <span>{isCoupleLogin ? 'Verifica credenziali...' : 'Entrando in pista...'}</span>
      {:else}
        <span>{isCoupleLogin ? 'Entra nella Console Sposi' : 'Entra nel gioco'}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      {/if}
    </button>
  </form>
</div>

<style>
  .join-layout {
    display: grid;
    grid-template-columns: 1fr minmax(0, 480px);
    gap: 56px;
    align-items: center;
    padding-top: 12px;
  }

  .join-intro {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .eyebrow {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--gold-dark);
    padding: 6px 14px;
    border-radius: var(--radius-full);
    background: rgba(201, 169, 110, 0.12);
    border: 1px solid rgba(201, 169, 110, 0.3);
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .eyebrow-couple {
    background: rgba(184, 134, 11, 0.18);
    border-color: rgba(184, 134, 11, 0.4);
    color: var(--gold-dark);
  }

  .tips {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 0.9rem;
    color: var(--text-muted);
  }

  .tips li {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .tips li::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--gold-primary);
    flex-shrink: 0;
  }

  .switch {
    font-size: 0.92rem;
    color: var(--text-muted);
    margin-top: 8px;
    line-height: 1.6;
  }

  .sep {
    margin: 0 4px;
    opacity: 0.6;
  }

  .join-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .auth-toggle {
    display: flex;
    background: rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: var(--radius-full);
    padding: 4px;
    gap: 4px;
    margin-bottom: 8px;
  }

  .auth-toggle-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px 16px;
    border-radius: var(--radius-full);
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--text-muted);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .auth-toggle-btn:hover {
    color: var(--text-main);
  }

  .auth-toggle-btn.active {
    background: #fff;
    color: var(--text-main);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    font-weight: 700;
  }

  .auth-toggle-btn.active.sposi-active {
    color: var(--gold-dark);
    box-shadow: 0 2px 10px rgba(184, 134, 11, 0.15);
  }

  .form-title {
    font-size: 1.55rem;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .form-error {
    margin-bottom: 4px;
  }

  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }

  .code-input {
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-weight: 700;
  }

  .spinner-on-dark {
    border-color: rgba(255, 255, 255, 0.4);
    border-top-color: #fff;
  }

  @media (max-width: 900px) {
    .join-layout {
      grid-template-columns: 1fr;
      gap: 28px;
    }
  }

  @media (max-width: 520px) {
    .row { grid-template-columns: 1fr; gap: 0; }
    :global(.auth-card) { padding: 24px; }
  }

  .email-optional {
    padding-top: 14px;
    border-top: 1px dashed rgba(201, 169, 110, 0.35);
    margin-top: 6px;
  }

  .email-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--gold-dark);
    font-weight: 600;
  }
</style>
