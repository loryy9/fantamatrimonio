<script>
  import { appState } from '../lib/state.svelte.js';
  import { formatName } from '../lib/formatters.js';

  // Assigned after init so the compiler keeps it reactive for bind:value.
  let inviteCode = $state('');
  inviteCode = new URLSearchParams(window.location.search).get('code') || '';
  let firstName = $state('');
  let lastName = $state('');
  let secretWord = $state('');
  let isSubmitting = $state(false);
  let errorMessage = $state('');

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
        secretWord.trim()
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
      <button type="button" class="link-btn" onclick={() => appState.setAuthView('create')}>Crea il vostro matrimonio</button>
    </p>
  </div>

  <form class="auth-card join-form" onsubmit={handleSubmit}>
    <h2 class="form-title font-serif">Accedi o Registrati</h2>

    {#if errorMessage}
      <div class="form-error" role="alert">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
        <span>{errorMessage}</span>
      </div>
    {/if}

    <div class="input-group">
      <label for="inviteCode" class="input-label">Codice invito</label>
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
        <label for="firstName" class="input-label">Nome</label>
        <input id="firstName" type="text" class="input-field" placeholder="Es. Mario" bind:value={firstName} autocomplete="given-name" required />
      </div>
      <div class="input-group">
        <label for="lastName" class="input-label">Cognome</label>
        <input id="lastName" type="text" class="input-field" placeholder="Es. Rossi" bind:value={lastName} autocomplete="family-name" required />
      </div>
    </div>

    <div class="input-group">
      <label for="secretWord" class="input-label">Parola personale</label>
      <input id="secretWord" type="text" class="input-field" placeholder="Es. pizza, stella, 1234..." bind:value={secretWord} autocomplete="off" required />
      <span class="field-hint">Serve per rientrare dal tuo telefono o cambiare dispositivo.</span>
    </div>

    <button type="submit" class="btn btn-primary btn-lg btn-block" disabled={isSubmitting}>
      {#if isSubmitting}
        <div class="spinner spinner-on-dark"></div>
        <span>Entrando in pista...</span>
      {:else}
        <span>Entra nel gioco</span>
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
  }

  .tips {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 0.9rem;
    color: var(--text-muted);
  }

  .tips li::before {
    content: '✦';
    color: var(--gold-primary);
    margin-right: 10px;
  }

  .switch {
    font-size: 0.92rem;
    color: var(--text-muted);
    margin-top: 8px;
  }

  .join-form {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-title {
    font-size: 1.6rem;
    font-weight: 700;
    margin-bottom: 8px;
  }

  .form-error {
    margin-bottom: 8px;
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
</style>
