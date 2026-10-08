<script>
  import { appState } from '../lib/state.svelte.js';
  import EmailVerificationField from './EmailVerificationField.svelte';

  let email = $state('');
  let password = $state('');
  let isSubmitting = $state(false);
  let errorMessage = $state('');
  let mode = $state('login'); // 'login' | 'register'

  let regName = $state('');
  let regEmail = $state('');
  let regPassword = $state('');
  let regConfirm = $state('');
  let regVerificationCode = $state('');
  let regEmailVerified = $state(false);

  async function handleLogin(e) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      appState.showToast('Email e password sono obbligatori.', 'error');
      return;
    }
    isSubmitting = true;
    try {
      const res = await appState.loginSecure(email.trim(), password.trim());
      if (!res.success) {
        appState.showToast(res.error || 'Email o password non corretti.', 'error');
      }
    } catch (err) {
      appState.showToast(err.message || 'Errore di connessione.', 'error');
    } finally {
      isSubmitting = false;
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPassword.trim()) {
      appState.showToast('Tutti i campi sono obbligatori.', 'error');
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
      const res = await appState.register(regEmail.trim(), regPassword, regName.trim(), regVerificationCode.trim());
      if (!res.success) {
        appState.showToast(res.error || 'Registrazione non riuscita.', 'error');
      }
    } catch (err) {
      appState.showToast(err.message || 'Errore di connessione.', 'error');
    } finally {
      isSubmitting = false;
    }
  }

  function switchMode(m) {
    mode = m;
    errorMessage = '';
  }
</script>

<div class="secure-layout">
  <div class="secure-intro">
    {#if mode === 'login'}
      <span class="eyebrow">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        Area Personale
      </span>
      <h1 class="page-title">Accedi alla <span class="gold-gradient-text">Dashboard Utente</span></h1>
      <p class="page-lead">
        Accedi al tuo account personale per vedere tutti i matrimoni a cui partecipi o che hai creato,
        le foto scattate, i quiz e i tuoi punteggi.
      </p>
      <p class="switch">
        Non hai ancora un account?
        <button type="button" class="link-btn" onclick={() => switchMode('register')}>Registrati</button>
      </p>
    {:else}
      <span class="eyebrow">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
        Nuovo Account
      </span>
      <h1 class="page-title">Crea il tuo <span class="gold-gradient-text">account</span></h1>
      <p class="page-lead">
        Registrati per accedere alla dashboard e tenere traccia di tutti i matrimoni a cui parteciperai.
      </p>
      <p class="switch">
        Hai già un account?
        <button type="button" class="link-btn" onclick={() => switchMode('login')}>Accedi</button>
      </p>
    {/if}
    <div class="guest-shortcut">
      <span class="guest-shortcut-title">Sei un invitato alla festa?</span>
      <p class="guest-shortcut-text">Non hai bisogno di un creare un account se non lo hai già! Ti basta il codice che ti hanno dato gli sposi.</p>
      <button type="button" class="btn btn-secondary btn-sm" onclick={() => appState.setAuthView('join')}>
        Entra con codice invito →
      </button>
    </div>
  </div>

  {#if mode === 'login'}
    <form class="auth-card secure-form" onsubmit={handleLogin}>
      <h2 class="form-title font-serif">Accedi</h2>

      {#if errorMessage}
        <div class="form-error" role="alert">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
          <span>{errorMessage}</span>
        </div>
      {/if}

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
    <form class="auth-card secure-form" onsubmit={handleRegister}>
      <h2 class="form-title font-serif">Registrati</h2>

      {#if errorMessage}
        <div class="form-error" role="alert">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
          <span>{errorMessage}</span>
        </div>
      {/if}

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
      <div class="input-group">
        <label for="regName" class="input-label">Il tuo nome</label>
        <input id="regName" type="text" class="input-field" placeholder="Es. Giulia Bianchi" bind:value={regName} autocomplete="name" required />
      </div>

      <div class="input-group">
        <label for="regPassword" class="input-label">Password</label>
        <input id="regPassword" type="password" class="input-field" placeholder="Almeno 6 caratteri" bind:value={regPassword} autocomplete="new-password" minlength="6" required disabled={!regEmailVerified || isSubmitting} />
      </div>

      <div class="input-group">
        <label for="regConfirm" class="input-label">Conferma password</label>
        <input id="regConfirm" type="password" class="input-field" placeholder="Ripeti la password" bind:value={regConfirm} autocomplete="new-password" required disabled={!regEmailVerified || isSubmitting} />
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
          <span>Dopo la verifica compariranno nome, password e il pulsante per creare l’account.</span>
        </div>
      {/if}
    </form>
  {/if}
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

  .form-error {
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

  .guest-shortcut {
    margin-top: 14px;
    padding: 16px;
    border-radius: var(--radius-md);
    background: rgba(201, 169, 110, 0.08);
    border: 1px solid rgba(201, 169, 110, 0.25);
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }

  .guest-shortcut-title {
    font-size: 0.92rem;
    font-weight: 700;
    color: var(--text-main);
  }

  .guest-shortcut-text {
    font-size: 0.84rem;
    color: var(--text-muted);
    line-height: 1.45;
  }
</style>
