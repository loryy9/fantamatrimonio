<script>
  import { onMount } from 'svelte';
  import { appState } from '../lib/state.svelte.js';
  import { api } from '../lib/api.js';
  import EmailVerificationField from './EmailVerificationField.svelte';

  function getCodeFromUrl() {
    if (typeof window === 'undefined') return '';
    return (new URLSearchParams(window.location.search).get('code') || '').trim().toUpperCase();
  }

  let inviteCode = $state(getCodeFromUrl());
  let nickname = $state('');
  let email = $state('');
  let verificationCode = $state('');
  let emailVerified = $state(false);
  let noEmail = $state(false);
  let secretWord = $state('');

  let isSubmitting = $state(false);
  let errorMessage = $state('');
  const isAccountJoin = $derived(appState.hasAccount);

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
        appState.showToast(previewError, 'error');
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

    // Se l'utente ha già un account registrato, precompila
    if (appState.account) {
      if (!email && appState.account.email) email = appState.account.email;
      if (!nickname && appState.account.display_name) {
        nickname = appState.account.display_name;
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
    if (!inviteCode.trim()) {
      appState.showToast('Inserisci il codice del matrimonio.', 'error');
      return;
    }

    if (!nickname.trim()) {
      appState.showToast('Inserisci un nickname per partecipare (es. Zia Pina, Fratello sposa).', 'error');
      return;
    }

    if (!noEmail && !isAccountJoin) {
      if (!email.trim()) {
        appState.showToast('Inserisci il tuo indirizzo email.', 'error');
        return;
      }
      if (!verificationCode.trim() || verificationCode.trim().length !== 6) {
        appState.showToast('Inserisci il codice di verifica a 6 cifre inviato alla tua email.', 'error');
        return;
      }
    } else {
      if (!secretWord.trim()) {
        appState.showToast('Inserisci una parola segreta personale per poter rientrare se chiudi il browser.', 'error');
        return;
      }
    }

    isSubmitting = true;
    try {
      const res = await appState.login({
        inviteCode: inviteCode.trim().toUpperCase(),
        nickname: nickname.trim(),
        email: noEmail ? null : email.trim(),
        verificationCode: noEmail ? null : verificationCode.trim(),
        noEmail,
        secretWord: noEmail ? secretWord.trim() : null,
      });
      if (!res.success) {
        appState.showToast(res.error || 'Accesso non riuscito. Controlla il codice o i dati inseriti.', 'error');
      }
    } catch (err) {
      appState.showToast(err.message || 'Errore di connessione.', 'error');
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
      {#if isAccountJoin}
        Inserisci il codice del matrimonio e il nickname con cui vuoi partecipare. Il tuo account verrà collegato automaticamente.
      {:else}
        Bastano la tua email e un nickname per scendere in pista! Niente password o parole complicate:
        riceverai subito un codice a 6 cifre per accedere e iniziare a giocare.
      {/if}
    </p>

    <ul class="tips">
      <li><strong>Accesso veloce:</strong> ricevi subito il codice di verifica via email.</li>
      <li><strong>Scegli il tuo nickname:</strong> comparirà in classifica, nelle foto e nei quiz.</li>
      <li><strong>I tuoi ricordi al sicuro:</strong> dopo la festa potrai registrare la tua password e accedere alla dashboard.</li>
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

    <!-- CODICE INVITO -->
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

    {#if isAccountJoin}
      <div class="account-join-notice" role="status">
        <strong>Sei già autenticato</strong>
        <span>Non serve inserire email o codice di verifica.</span>
      </div>
      <div class="input-group">
        <label for="accountGuestNick" class="input-label">Il tuo nickname</label>
        <input
          id="accountGuestNick"
          type="text"
          class="input-field"
          placeholder="Es. Zia Pina, Testimone Matteo..."
          bind:value={nickname}
          required
          disabled={isSubmitting}
        />
        <span class="field-hint">Sarà il nome visibile in questo matrimonio.</span>
      </div>
    {:else}
      <!-- OPZIONE SENZA EMAIL (PER PARENTI ANZIANI) -->
      <div
        class="no-email-card"
        class:selected={noEmail}
        onclick={() => { noEmail = !noEmail; errorMessage = ''; }}
        role="checkbox"
        aria-checked={noEmail}
        tabindex="0"
        onkeydown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); noEmail = !noEmail; errorMessage = ''; } }}
      >
        <div class="no-email-checkbox">
          {#if noEmail}
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          {/if}
        </div>
        <div class="no-email-text">
          <strong>Non possiedo un indirizzo email</strong>
          <span>Opzione per parenti anziani o chi non usa la posta elettronica</span>
        </div>
      </div>
    {/if}

    {#if !isAccountJoin && !noEmail}
      <!-- MODALITÀ STANDARD (EMAIL VERIFICATA + NICKNAME) -->
      <EmailVerificationField
        bind:email={email}
        bind:verificationCode={verificationCode}
        bind:verified={emailVerified}
        purpose="join_guest"
        label="La tua email"
        placeholder="es. mario@email.com"
        disabled={isSubmitting}
      />

      {#if emailVerified}
      <div class="input-group">
        <label for="guestNick" class="input-label">Il tuo Nickname per il gioco</label>
        <input
          id="guestNick"
          type="text"
          class="input-field"
          placeholder="es. Zia Pina, Fratello sposa, Testimone Matteo..."
          bind:value={nickname}
          required
          disabled={isSubmitting}
        />
        <span class="field-hint">Sarà il nome visibile in classifica, nelle foto e nelle sfide!</span>
      </div>
      {:else}
        <div class="verification-required-note" role="status">
          <strong>Verifica prima la tua email</strong>
          <span>Dopo la verifica comparirà il nickname e potrai entrare nel gioco.</span>
        </div>
      {/if}
    {:else if !isAccountJoin}
      <!-- MODALITÀ SENZA EMAIL (NICKNAME + PAROLA SEGRETA) -->
      <div class="no-email-notice" role="alert">
        <span class="notice-icon">👵👴</span>
        <div>
          <strong>Partecipazione senza email</strong>
          <p>Potrai giocare a tutte le sfide e caricare foto durante la festa, ma senza email non potrai creare un account permanente né rivedere le tue foto e statistiche in futuro da altri dispositivi.</p>
        </div>
      </div>

      <div class="input-group">
        <label for="guestNickNoMail" class="input-label">Il tuo Nickname</label>
        <input
          id="guestNickNoMail"
          type="text"
          class="input-field"
          placeholder="es. Zia Pina, Nonno Bruno, Zio Carlo..."
          bind:value={nickname}
          required
          disabled={isSubmitting}
        />
        <span class="field-hint">Il nome con cui ti riconosceranno sposi e invitati.</span>
      </div>

      <div class="input-group">
        <label for="secretWord" class="input-label">Parola segreta personale</label>
        <input
          id="secretWord"
          type="password"
          class="input-field"
          placeholder="Una parola semplice che ricorderai (es. sole, roma, gatto)"
          bind:value={secretWord}
          autocomplete="current-password"
          required
          disabled={isSubmitting}
        />
        <span class="field-hint">Ti servirà per rientrare nella partita dal telefono se chiudi la pagina.</span>
      </div>
    {/if}

    <button type="submit" class="btn btn-primary btn-lg btn-block submit-btn" disabled={isSubmitting || (!isAccountJoin && !noEmail && !emailVerified)}>
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

  .verification-required-note {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 14px 16px;
    border-radius: 14px;
    background: rgba(201, 169, 110, 0.1);
    border: 1px solid rgba(201, 169, 110, 0.35);
    color: var(--text-main);
  }

  .verification-required-note span {
    color: #6b5f64;
    font-size: 0.9rem;
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

  .tips {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 0.9rem;
    color: var(--text-muted);
    padding: 0;
    margin: 4px 0 0;
  }

  .tips li {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    line-height: 1.45;
  }

  .tips li::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--gold-primary);
    flex-shrink: 0;
    margin-top: 7px;
  }

  .join-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .form-title {
    font-size: 1.55rem;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .form-error {
    margin-bottom: 4px;
  }

  .code-input {
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-weight: 700;
  }

  /* Option card "Non possiedo un indirizzo email" */
  .no-email-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 16px;
    background: #ffffff;
    border: 1.5px solid rgba(201, 169, 110, 0.35);
    cursor: pointer;
    transition: all 0.15s ease;
    user-select: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
  }

  .no-email-card:hover {
    background: rgba(201, 169, 110, 0.08);
    border-color: rgba(201, 169, 110, 0.55);
  }

  .no-email-card.selected {
    background: rgba(140, 47, 75, 0.05);
    border-color: rgba(140, 47, 75, 0.4);
  }

  .no-email-checkbox {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    border: 2px solid rgba(201, 169, 110, 0.8);
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--wine);
    flex-shrink: 0;
    transition: all 0.15s ease;
  }

  .no-email-card.selected .no-email-checkbox {
    border-color: var(--wine);
    background: var(--wine);
    color: #ffffff;
  }

  .no-email-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    text-align: left;
  }

  .no-email-text strong {
    font-size: 0.88rem;
    color: var(--text-main);
  }

  .no-email-text span {
    font-size: 0.76rem;
    color: var(--text-muted);
  }

  /* Notice for users without email */
  .no-email-notice {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 14px;
    background: rgba(184, 134, 11, 0.09);
    border: 1px solid rgba(184, 134, 11, 0.3);
    color: #5c4308;
    font-size: 0.84rem;
    line-height: 1.45;
    text-align: left;
    margin-top: 2px;
  }

  .no-email-notice .notice-icon {
    font-size: 1.3rem;
    line-height: 1;
    flex-shrink: 0;
  }

  .no-email-notice strong {
    display: block;
    color: #4a3504;
    margin-bottom: 2px;
    font-weight: 700;
  }

  .no-email-notice p {
    margin: 0;
    color: #695213;
  }

  .submit-btn {
    margin-top: 6px;
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
    :global(.auth-card) { padding: 24px; }
  }

  /* Live Preview Box */
  .preview-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 16px;
    background: rgba(201, 169, 110, 0.12);
    border: 1px solid rgba(201, 169, 110, 0.4);
    margin-bottom: 4px;
  }

  .preview-loading {
    opacity: 0.85;
  }

  .preview-badge-icon {
    font-size: 1.4rem;
    line-height: 1;
  }

  .preview-badge-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
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
    margin-bottom: 4px;
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
