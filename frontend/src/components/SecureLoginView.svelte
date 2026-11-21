<script>
  import { slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { appState } from '../lib/state.svelte.js';
  import { normalizeCode } from '../lib/routes.js';
  import { api } from '../lib/api.js';
  import EmailVerificationField from './EmailVerificationField.svelte';
  import SocialButtons from './SocialButtons.svelte';
  import PageIntro from './PageIntro.svelte';
  import SpouseCard from './SpouseCard.svelte';

  const cardTransition = {
    duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 240,
    easing: cubicOut
  };

  // `embedded`: usato dentro "entra con codice" / "crea matrimonio": dopo l'accesso si resta nella
  // schermata corrente invece di andare alla dashboard. `intro` sostituisce il titolo di default.
  let { embedded = false, intro = null, joinMode = false, initialMode = 'login' } = $props();

  let mode = $state(initialMode); // 'login' | 'register' | 'reset'
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

  let resetEmail = $state('');
  let resetCode = $state('');
  let resetVerified = $state(false);
  let resetPassword = $state('');
  let resetConfirm = $state('');

  function openReset() {
    resetEmail = email.trim();
    resetCode = '';
    resetVerified = false;
    resetPassword = '';
    resetConfirm = '';
    mode = 'reset';
  }

  // Codice matrimonio: richiesto solo dalla registrazione dentro "entra con codice".
  const needsCode = $derived(embedded && joinMode);
  let inviteCode = $state(normalizeCode(page.url.searchParams.get('code')));
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

  async function handleReset(e) {
    e.preventDefault();
    if (!resetVerified) return;
    if (resetPassword.length < 6) {
      appState.showToast('La password deve essere di almeno 6 caratteri.', 'error');
      return;
    }
    if (resetPassword !== resetConfirm) {
      appState.showToast('Le password non coincidono.', 'error');
      return;
    }
    isSubmitting = true;
    try {
      const res = await appState.resetPassword(resetEmail.trim(), resetCode.trim(), resetPassword, opts);
      if (!res.success) {
        appState.showToast(res.error, 'error');
        // Codice consumato o scaduto: si riparte dall'invio di un nuovo codice.
        resetVerified = false;
        resetCode = '';
        return;
      }
      email = resetEmail.trim();
      mode = 'login';
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
</script>

{#snippet submitButton(label, busyLabel)}
  <button type="submit" class="btn btn-primary btn-lg btn-block" disabled={isSubmitting}>
    {#if isSubmitting}
      <div class="spinner spinner-on-dark"></div>
      <span>{busyLabel}</span>
    {:else}
      <span>{label}</span>
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
    {/if}
  </button>
{/snippet}

<div class="secure-layout" class:embedded class:join-mode={!!intro}>
  <div class="secure-intro" class:join-mode={!!intro}>
    {#if intro}
      <div class="page-intro-slot">
        <PageIntro before="Entra nella" accent="festa" lead="Inserisci il codice del matrimonio per iniziare a giocare, scattare foto e votare con gli sposi." />
      </div>
      <div class="spouse-card-slot">
        <SpouseCard onLogin={() => (mode = 'login')} />
      </div>
    {:else if mode === 'login'}
      <PageIntro before="Bentornato al" accent="Fanta Matrimonio" lead="Accedi per partecipare ai matrimoni, vedere le tue foto, i quiz e i tuoi punteggi." />
    {:else if mode === 'reset'}
      <PageIntro before="Recupera la tua" accent="password" lead="Ti mandiamo un codice a 6 cifre via email: inseriscilo e scegli una nuova password." />
    {:else}
      <PageIntro before="Crea il tuo" accent="account" lead="Ti serve una volta sola: con lo stesso account entri in tutti i matrimoni, come invitato o come sposo." />
    {/if}
  </div>

  <div class="auth-card secure-form">
    <h2 class="form-title font-serif">{mode === 'login' ? 'Accedi' : mode === 'reset' ? 'Recupera password' : 'Registrati'}</h2>

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
          <div class="code-ok" transition:slide|local={cardTransition}>✓ Matrimonio di <strong>{eventPreview.spouse1_name} &amp; {eventPreview.spouse2_name}</strong></div>
        {:else if previewError}
          <div class="code-ko" transition:slide|local={cardTransition}>{previewError}</div>
        {:else}
          <span class="code-hint" transition:slide|local={cardTransition}>Lo trovi sul segnaposto, sul tableau o nel link degli sposi.</span>
        {/if}
      </div>
    {/if}

    {#if mode !== 'reset'}
      <SocialButtons onToken={handleSocial} busy={socialBusy || isSubmitting} label={mode === 'login' ? 'Accedi con' : 'Registrati con'} />
    {/if}

    {#if mode === 'login'}
      <form class="secure-form" onsubmit={handleLogin} transition:slide|local={cardTransition}>
        <div class="input-group">
          <label for="secEmail" class="input-label">Email</label>
          <input id="secEmail" type="email" class="input-field" placeholder="es. giulia@email.com" bind:value={email} autocomplete="email" required />
        </div>

        <div class="input-group">
          <label for="secPassword" class="input-label">Password</label>
          <input id="secPassword" type="password" class="input-field" placeholder="La tua password" bind:value={password} autocomplete="current-password" required />
          <button type="button" class="link-btn forgot-link" onclick={openReset}>Password dimenticata?</button>
        </div>

        {@render submitButton('Accedi', 'Accesso in corso...')}
      </form>
    {:else if mode === 'reset'}
      <form class="secure-form" onsubmit={handleReset} transition:slide|local={cardTransition}>
        <EmailVerificationField
          bind:email={resetEmail}
          bind:verificationCode={resetCode}
          bind:verified={resetVerified}
          purpose="reset_password"
          label="Email del tuo account"
          placeholder="es. giulia@email.com"
          disabled={isSubmitting}
        />

        {#if resetVerified}
          <div class="verified-fields" transition:slide|local={cardTransition}>
            <div class="input-group">
              <label for="resetPassword" class="input-label">Nuova password</label>
              <input id="resetPassword" type="password" class="input-field" placeholder="Almeno 6 caratteri" bind:value={resetPassword} autocomplete="new-password" minlength="6" required disabled={isSubmitting} />
            </div>

            <div class="input-group">
              <label for="resetConfirm" class="input-label">Conferma nuova password</label>
              <input id="resetConfirm" type="password" class="input-field" placeholder="Ripeti la password" bind:value={resetConfirm} autocomplete="new-password" required disabled={isSubmitting} />
            </div>

            {@render submitButton('Salva e accedi', 'Salvataggio in corso...')}
          </div>
        {/if}
      </form>
    {:else}
      <form class="secure-form" onsubmit={handleRegister} transition:slide|local={cardTransition}>
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
          <div class="verified-fields" transition:slide|local={cardTransition}>
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

          {@render submitButton('Crea il mio account', 'Creazione in corso...')}
          </div>
        {/if}
      </form>
    {/if}

    <p class="switch center">
      {#if mode === 'login'}
        Non hai ancora un account?
        <button type="button" class="link-btn" onclick={() => (mode = 'register')}>Registrati</button>
      {:else if mode === 'reset'}
        Ti sei ricordato la password?
        <button type="button" class="link-btn" onclick={() => (mode = 'login')}>Torna all'accesso</button>
      {:else}
        Hai già un account?
        <button type="button" class="link-btn" onclick={() => (mode = 'login')}>Accedi</button>
      {/if}
    </p>
  </div>
</div>

<style>
  .secure-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 520px);
    gap: 56px;
    align-items: start;
    width: 100%;
    max-width: 1100px;
    margin: 0 auto;
  }

  .secure-intro {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    position: sticky;
    top: 96px;
  }

  .switch {
    font-size: 0.92rem;
    color: var(--text-muted);
    margin-top: 4px;
    line-height: 1.6;
  }

  .switch.center {
    text-align: center;
    margin: 8px 0 0;
  }

  .secure-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .form-title {
    font-size: var(--fs-xl);
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
    .secure-intro.join-mode {
      display: contents;
      align-items: center;
      text-align: center;
    }
    .secure-layout.join-mode {
      display: flex;
      flex-direction: column;
      width: 100%;
      min-width: 0;
      align-items: stretch;
    }
    .secure-layout.embedded {
      padding-top: 8px;
    }
    .page-intro-slot {
      order: 1;
    }
    .auth-card {
      order: 2;
      width: 100%;
      min-width: 0;
      align-self: stretch;
    }
    .spouse-card-slot {
      order: 3;
      width: 100%;
    }
  }

  @media (max-width: 520px) {
    :global(.auth-card) { padding: 24px; }
  }

  .secure-layout.embedded {
    padding: 0 0 32px;
  }

  .name-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .forgot-link {
    align-self: flex-end;
    font-size: 0.85rem;
    margin-top: 2px;
  }

  .optional {
    font-weight: 400;
    color: var(--text-muted);
    font-size: 0.82em;
  }

  .code-group {
    margin-bottom: 14px;
  }
  .verified-fields {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .code-input {
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .code-ok {
    width: 100%;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
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
