<script>
  import { onMount } from 'svelte';
  import { appState } from '../lib/state.svelte.js';
  import { formatName } from '../lib/formatters.js';
  import { api } from '../lib/api.js';

  function getCodeFromUrl() {
    if (typeof window === 'undefined') return '';
    return (new URLSearchParams(window.location.search).get('code') || '').trim().toUpperCase();
  }

  let inviteCode = $state(getCodeFromUrl());
  let firstName = $state('');
  let lastName = $state('');
  let secretWord = $state('');
  let email = $state('');
  let isSubmitting = $state(false);
  let errorMessage = $state('');

  let eventPreview = $state(null);
  let previewLoading = $state(false);
  let previewError = $state('');

  let checkTimer = null;
  async function checkPreview(code) {
    const c = (code || '').trim().toUpperCase();
    if (c.length < 4) {
      eventPreview = null;
      previewError = '';
      return;
    }
    previewLoading = true;
    try {
      const res = await api.getEventPreview(c);
      eventPreview = res;
      previewError = '';
    } catch {
      eventPreview = null;
      if (c.length >= 6) {
        previewError = 'Codice matrimonio non trovato. Controlla il codice ricevuto.';
      }
    } finally {
      previewLoading = false;
    }
  }

  onMount(() => {
    function onLocation() {
      const c = getCodeFromUrl();
      if (c) {
        inviteCode = c;
      }
    }
    window.addEventListener('popstate', onLocation);
    window.addEventListener('hashchange', onLocation);

    // Se l'utente ha già un account registrato, precompila nome e email
    if (appState.account) {
      if (!email && appState.account.email) email = appState.account.email;
      if (!firstName && appState.account.display_name) {
        const parts = appState.account.display_name.trim().split(' ');
        firstName = parts[0] || '';
        if (parts.length > 1 && !lastName) {
          lastName = parts.slice(1).join(' ');
        }
      }
    }

    const urlCode = getCodeFromUrl();
    if (urlCode) {
      inviteCode = urlCode;
    }

    return () => {
      window.removeEventListener('popstate', onLocation);
      window.removeEventListener('hashchange', onLocation);
      clearTimeout(checkTimer);
    };
  });

  $effect(() => {
    const code = inviteCode.trim().toUpperCase();
    clearTimeout(checkTimer);
    if (code.length >= 4) {
      checkTimer = setTimeout(() => {
        checkPreview(code);
      }, 150);
    } else {
      eventPreview = null;
      previewError = '';
    }
  });

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
        false, // guest login
        email.trim() || null
      );
      if (!res.success) {
        errorMessage = res.error || 'Accesso non riuscito. Controlla il codice o i dati inseriti.';
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
      Inserisci il codice invito ricevuto dagli sposi e le tue credenziali. Nessuna registrazione complessa:
      bastano il tuo nome e una parola personale che ricorderai.
    </p>

    <ul class="tips">
      <li>Se è la prima volta, il tuo profilo viene creato all'istante.</li>
      <li>Per rientrare dallo stesso o da un altro dispositivo usa gli stessi dati.</li>
    </ul>

    <div class="sposi-notice-box">
      <div class="sposi-notice-header">
        <span class="sposi-notice-ring">💍</span>
        <strong>Siete gli sposi?</strong>
      </div>
      <p class="sposi-notice-p">
        Per personalizzare e gestire il vostro matrimonio, effettuate il login con il vostro account (email e password):
      </p>
      <button
        type="button"
        class="btn btn-secondary btn-sm sposi-login-btn"
        onclick={() => appState.setAuthView('login-secure')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span>Accedi alla Dashboard Sposi</span>
      </button>
      <div class="sposi-create-link-wrap">
        <span>Non avete ancora un matrimonio?</span>
        <button type="button" class="link-btn" onclick={() => appState.setAuthView('create')}>
          Crea matrimonio
        </button>
      </div>
    </div>
  </div>

  <form class="auth-card join-form" onsubmit={handleSubmit}>
    <h2 class="form-title font-serif">Partecipa alla festa</h2>

    {#if previewLoading}
      <div class="preview-banner preview-loading">
        <span class="preview-badge-icon">⏳</span>
        <div class="preview-badge-body">
          <span class="preview-badge-label">Verifica codice</span>
          <strong class="preview-badge-names">Ricerca matrimonio in corso...</strong>
        </div>
      </div>
    {:else if eventPreview}
      <div class="preview-banner">
        <span class="preview-badge-icon">💍</span>
        <div class="preview-badge-body">
          <span class="preview-badge-label">Matrimonio confermato</span>
          <strong class="preview-badge-names">{eventPreview.spouse1_name} &amp; {eventPreview.spouse2_name}</strong>
        </div>
        <span class="preview-badge-check" title="Codice valido">✓</span>
      </div>
    {:else if previewError}
      <div class="preview-warning" role="alert">
        <span>⚠️ {previewError}</span>
      </div>
    {/if}

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
        oninput={(e) => inviteCode = e.target.value.toUpperCase()}
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
        required
      />
    </div>

    <div class="row">
      <div class="input-group">
        <label for="firstName" class="input-label">Nome</label>
        <input
          id="firstName"
          type="text"
          class="input-field"
          placeholder="Es. Mario"
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
          placeholder="Es. Rossi"
          bind:value={lastName}
          autocomplete="family-name"
          required
        />
      </div>
    </div>

    <div class="input-group">
      <label for="secretWord" class="input-label">Parola personale (o PIN a scelta)</label>
      <input
        id="secretWord"
        type="password"
        class="input-field"
        placeholder="Es. stella, 1234..."
        bind:value={secretWord}
        autocomplete="current-password"
        required
      />
      <span class="field-hint">Serve per rientrare dal tuo telefono o cambiare dispositivo.</span>
    </div>

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
    align-items: start;
  }

  .join-intro {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    position: sticky;
    top: 96px;
  }

  .join-intro .page-title {
    font-size: clamp(2.2rem, 4vw, 3.1rem);
    line-height: 1.05;
    color: var(--text-main);
    margin: 0;
  }

  .join-intro .page-title::after {
    content: '';
    display: block;
    width: 40px;
    height: 2px;
    border-radius: 2px;
    background: var(--wine);
    margin-top: 14px;
  }

  .join-intro .page-lead {
    font-family: var(--font-display);
    font-style: italic;
    font-size: 1.2rem;
    line-height: 1.5;
    color: #6b5f64;
    margin: 0;
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
    margin: 0;
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
    .join-intro {
      position: static;
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

  .preview-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: var(--radius-md);
    background: linear-gradient(135deg, rgba(233, 201, 143, 0.22), rgba(201, 169, 110, 0.12));
    border: 1px solid rgba(201, 169, 110, 0.4);
    margin-bottom: 8px;
  }

  .preview-badge-icon {
    font-size: 1.4rem;
  }

  .preview-badge-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .preview-badge-label {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--gold-dark);
  }

  .preview-badge-names {
    font-size: 1.05rem;
    color: var(--text-main);
  }

  .preview-badge-check {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #2e7d32;
    color: #fff;
    font-size: 0.85rem;
    font-weight: 700;
  }

  .preview-warning {
    padding: 10px 14px;
    border-radius: var(--radius-md);
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.25);
    color: #b91c1c;
    font-size: 0.86rem;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .sposi-notice-box {
    width: 100%;
    margin-top: 20px;
    padding: 16px 18px;
    border-radius: 16px;
    background: #ffffff;
    border: 1px solid rgba(201, 169, 110, 0.35);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sposi-notice-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--wine);
  }

  .sposi-notice-p {
    font-size: 0.86rem;
    color: #63575c;
    margin: 0;
    line-height: 1.45;
  }

  .sposi-login-btn {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
    font-weight: 700;
  }

  .sposi-create-link-wrap {
    font-size: 0.82rem;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 2px;
  }
</style>
