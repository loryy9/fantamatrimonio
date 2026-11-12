<script>
  import { onMount } from 'svelte';
  import { appState } from '../lib/state.svelte.js';
  import { api } from '../lib/api.js';
  import EmailVerificationField from './EmailVerificationField.svelte';
  import SocialButtons from './SocialButtons.svelte';

  // `embedded`: usato dentro "entra con codice" / "crea matrimonio": dopo l'accesso si resta nella
  // schermata corrente invece di andare alla dashboard. `intro` sostituisce il titolo di default.
  let { embedded = false, intro = null, joinMode = false, initialMode = 'login' } = $props();

  let mode = $state(initialMode); // 'login' | 'register'
  let isSubmitting = $state(false);

  let email = $state('');
  let password = $state('');

  let regFirst = $state('');
  let regLast = $state('');
  let regNickname = $state('');
  let regEmail = $state('');
  let regPassword = $state('');
  let regConfirm = $state('');
  let regVerificationCode = $state('');
  let regEmailVerified = $state(false);

  // Codice matrimonio: richiesto solo dalla registrazione dentro "entra con codice".
  const needsCode = $derived(embedded && joinMode);
  let inviteCode = $state(
    typeof window === 'undefined' ? '' : (new URLSearchParams(window.location.search).get('code') || '').trim().toUpperCase()
  );
  let eventPreview = $state(null);
  let previewError = $state('');
  let socialBusy = $state(false);
  const opts = $derived({ redirect: !embedded });

  let previewTimer = null;
  $effect(() => {
    const code = inviteCode.trim().toUpperCase();
    clearTimeout(previewTimer);
    if (code.length < 4) {
      eventPreview = null;
      previewError = '';
      return;
    }
    previewTimer = setTimeout(async () => {
      try {
        eventPreview = await api.getEventPreview(code);
        previewError = '';
      } catch {
        eventPreview = null;
        previewError = code.length >= 6 ? 'Codice matrimonio non trovato. Controlla il codice ricevuto.' : '';
      }
    }, 200);
  });

  // Dopo la registrazione (email o social) entriamo direttamente nel matrimonio col codice.
  async function joinAfterSignup() {
    const res = await appState.join(inviteCode.trim().toUpperCase(), regNickname.trim());
    if (!res.success && res.code === 'NICKNAME_TAKEN') {
      appState.showToast('Account creato, ma il nickname è già in uso: scegline un altro nel passo successivo.', 'info');
    }
  }

  async function handleSocial(provider, token) {
    if (mode === 'register' && needsCode && !eventPreview) {
      appState.showToast('Inserisci prima un codice matrimonio valido.', 'error');
      return;
    }
    socialBusy = true;
    try {
      const res = await appState.loginSocial(provider, token, opts);
      if (!res.success) {
        appState.showToast(res.error, 'error');
        return;
      }
      if (mode === 'register' && needsCode) await joinAfterSignup();
    } finally {
      socialBusy = false;
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      appState.showToast('Email e password sono obbligatorie.', 'error');
      return;
    }
    isSubmitting = true;
    try {
      const res = await appState.loginSecure(email.trim(), password, opts);
      if (!res.success) appState.showToast(res.error, 'error');
    } finally {
      isSubmitting = false;
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    if (needsCode && !eventPreview) {
      appState.showToast('Inserisci un codice matrimonio valido: lo trovi sul segnaposto o te lo dà chi ti ha invitato.', 'error');
      return;
    }
    if (!regFirst.trim() || !regLast.trim()) {
      appState.showToast('Nome e cognome sono obbligatori.', 'error');
      return;
    }
    if (regPassword.length < 6) {
      appState.showToast('La password deve essere di almeno 6 caratteri.', 'error');
      return;
    }
    if (regPassword !== regConfirm) {
      appState.showToast('Le password non coincidono.', 'error');
      return;
    }
    if (!regVerificationCode.trim() || regVerificationCode.trim().length !== 6) {
      appState.showToast('Inserisci il codice di verifica a 6 cifre inviato alla tua email.', 'error');
      return;
    }
    isSubmitting = true;
    try {
      const res = await appState.register(
        {
          email: regEmail.trim(),
          password: regPassword,
          firstName: regFirst.trim(),
          lastName: regLast.trim(),
          nickname: regNickname.trim(),
          verificationCode: regVerificationCode.trim()
        },
        opts
      );
      if (!res.success) {
        appState.showToast(res.error, 'error');
        return;
      }
      if (needsCode) await joinAfterSignup();
    } finally {
      isSubmitting = false;
    }
  }

  function switchMode(m) {
    mode = m;
  }
</script>

<div class="secure-layout" class:embedded>
  <div class="secure-intro">
    <span class="eyebrow">
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      {mode === 'login' ? 'Accedi' : 'Nuovo account'}
    </span>
    {#if intro}
      <h1 class="page-title">{intro.title}</h1>
      <p class="page-lead">{intro.lead}</p>
    {:else if mode === 'login'}
      <h1 class="page-title">Bentornato <span class="gold-gradient-text">al Fanta Matrimonio</span></h1>
      <p class="page-lead">
        Accedi per partecipare ai matrimoni, vedere le tue foto, i quiz e i tuoi punteggi.
      </p>
    {:else}
      <h1 class="page-title">Crea il tuo <span class="gold-gradient-text">account</span></h1>
      <p class="page-lead">
        Ti serve una volta sola: con lo stesso account entri in tutti i matrimoni, come invitato o come sposo.
      </p>
    {/if}
    <p class="switch">
      {#if mode === 'login'}
        Non hai ancora un account?
        <button type="button" class="link-btn" onclick={() => switchMode('register')}>Registrati</button>
      {:else}
        Hai già un account?
        <button type="button" class="link-btn" onclick={() => switchMode('login')}>Accedi</button>
      {/if}
    </p>
  </div>

  <div class="auth-card secure-form">
    <h2 class="form-title font-serif">{mode === 'login' ? 'Accedi' : 'Registrati'}</h2>

    {#if mode === 'register' && needsCode}
      <div class="input-group code-group">
        <label for="regInvite" class="input-label">Codice matrimonio</label>
        <input
          id="regInvite"
          type="text"
          class="input-field code-input"
          placeholder="ES. PK9YMD"
          bind:value={inviteCode}
          oninput={(e) => (inviteCode = e.target.value.toUpperCase())}
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
        />
        {#if eventPreview}
          <div class="code-ok">✓ Matrimonio di <strong>{eventPreview.spouse1_name} &amp; {eventPreview.spouse2_name}</strong></div>
        {:else if previewError}
          <div class="code-ko">{previewError}</div>
        {:else}
          <span class="code-hint">Lo trovi sul segnaposto, sul tableau o nel link degli sposi.</span>
        {/if}
      </div>
    {/if}

    <SocialButtons onToken={handleSocial} busy={socialBusy || isSubmitting} label={mode === 'login' ? 'Accedi con' : 'Registrati con'} />

    {#if mode === 'login'}
      <form class="secure-form" onsubmit={handleLogin}>
        <div class="input-group">
          <label for="secEmail" class="input-label">Email</label>
          <input id="secEmail" type="email" class="input-field" placeholder="es. giulia@email.com" bind:value={email} autocomplete="email" required />
        </div>

        <div class="input-group">
          <label for="secPassword" class="input-label">Password</label>
          <input id="secPassword" type="password" class="input-field" placeholder="La tua password" bind:value={password} autocomplete="current-password" required />
        </div>

        <button type="submit" class="btn btn-primary btn-lg btn-block" disabled={isSubmitting}>
          {#if isSubmitting}
            <div class="spinner spinner-on-dark"></div>
            <span>Accesso in corso...</span>
          {:else}
            <span>Accedi</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          {/if}
        </button>
      </form>
    {:else}
      <form class="secure-form" onsubmit={handleRegister}>
        <EmailVerificationField
          bind:email={regEmail}
          bind:verificationCode={regVerificationCode}
          bind:verified={regEmailVerified}
          purpose="register_account"
          label="Email"
          placeholder="es. giulia@email.com"
          disabled={isSubmitting}
        />

        {#if regEmailVerified}
          <div class="name-row">
            <div class="input-group">
              <label for="regFirst" class="input-label">Nome</label>
              <input id="regFirst" type="text" class="input-field" placeholder="Giulia" bind:value={regFirst} autocomplete="given-name" required />
            </div>
            <div class="input-group">
              <label for="regLast" class="input-label">Cognome</label>
              <input id="regLast" type="text" class="input-field" placeholder="Bianchi" bind:value={regLast} autocomplete="family-name" required />
            </div>
          </div>

          <div class="input-group">
            <label for="regNickname" class="input-label">Nickname <span class="optional">(facoltativo)</span></label>
            <input id="regNickname" type="text" class="input-field" placeholder="Come vuoi comparire in classifica, es. Zia Pina" bind:value={regNickname} autocomplete="nickname" />
          </div>

          <div class="input-group">
            <label for="regPassword" class="input-label">Password</label>
            <input id="regPassword" type="password" class="input-field" placeholder="Almeno 6 caratteri" bind:value={regPassword} autocomplete="new-password" minlength="6" required disabled={isSubmitting} />
          </div>

          <div class="input-group">
            <label for="regConfirm" class="input-label">Conferma password</label>
            <input id="regConfirm" type="password" class="input-field" placeholder="Ripeti la password" bind:value={regConfirm} autocomplete="new-password" required disabled={isSubmitting} />
          </div>

          <button type="submit" class="btn btn-primary btn-lg btn-block" disabled={isSubmitting}>
            {#if isSubmitting}
              <div class="spinner spinner-on-dark"></div>
              <span>Creazione in corso...</span>
            {:else}
              <span>Crea il mio account</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            {/if}
          </button>
        {:else}
          <div class="verification-required-note" role="status">
            <strong>Verifica prima la tua email</strong>
            <span>Dopo la verifica compariranno nome, cognome, password e il pulsante per creare l’account.</span>
          </div>
        {/if}
      </form>
    {/if}
  </div>
</div>

<style>
  .secure-layout {
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

  .secure-intro {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    position: sticky;
    top: 96px;
  }

  .secure-intro .page-title {
    font-size: clamp(2.2rem, 4vw, 3.1rem);
    line-height: 1.05;
    color: var(--text-main);
    margin: 0;
  }

  .secure-intro .page-title::after {
    content: '';
    display: block;
    width: 40px;
    height: 2px;
    border-radius: 2px;
    background: var(--wine);
    margin-top: 14px;
  }

  .secure-intro .page-lead {
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

  .switch {
    font-size: 0.92rem;
    color: var(--text-muted);
    margin-top: 4px;
    line-height: 1.6;
  }

  .secure-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .form-title {
    font-size: 1.55rem;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .spinner-on-dark {
    border-color: rgba(255, 255, 255, 0.4);
    border-top-color: #fff;
  }

  @media (max-width: 900px) {
    .secure-layout {
      grid-template-columns: 1fr;
      gap: 28px;
    }
    .secure-intro {
      position: static;
    }
  }

  @media (max-width: 520px) {
    :global(.auth-card) { padding: 24px; }
  }

  .secure-layout.embedded {
    padding: 8px 0 32px;
  }

  .name-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .optional {
    font-weight: 400;
    color: var(--text-muted);
    font-size: 0.82em;
  }

  .code-group {
    margin-bottom: 14px;
  }
  .code-input {
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .code-ok {
    background: #eef7f2;
    border: 1px solid #c2e5d3;
    color: #246845;
    padding: 8px 12px;
    border-radius: 10px;
    font-size: 0.85rem;
  }
  .code-ko {
    background: #fdf2f2;
    border: 1px solid #f8cdcd;
    color: #a83232;
    padding: 8px 12px;
    border-radius: 10px;
    font-size: 0.85rem;
  }
  .code-hint {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  @media (max-width: 420px) {
    .name-row {
      grid-template-columns: 1fr;
    }
  }
</style>
