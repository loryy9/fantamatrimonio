<script>
  import { api } from '../lib/api.js';
  import { appState } from '../lib/state.svelte.js';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { loginUrl } from '../lib/routes.js';

  let {
    email = $bindable(''),
    verificationCode = $bindable(''),
    verified = $bindable(false),
    purpose = 'register_account',
    disabled = false,
    label = 'Email',
    placeholder = 'nome@esempio.com',
    required = true
  } = $props();

  let sending = $state(false);
  let codeSent = $state(false);
  let existingEmailWarning = $state(false);
  let existingAccount = $state(false);
  let countdown = $state(0);
  let timer = null;

  function notify(text, type = 'info') {
    appState.showToast(text, type);
  }

  function handleEmailInput(e) {
    const nextEmail = e.target.value;
    email = nextEmail;
    if (verified) verified = false;
    if (codeSent) {
      codeSent = false;
      verificationCode = '';
    }
  }

  function startCountdown(seconds = 25) {
    countdown = seconds;
    clearInterval(timer);
    timer = setInterval(() => {
      countdown -= 1;
      if (countdown <= 0) {
        clearInterval(timer);
      }
    }, 1000);
  }

  async function handleSendCode(confirmExisting = false) {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      notify('Inserisci un indirizzo email valido prima di richiedere il codice.', 'error');
      return;
    }

    sending = true;
    verified = false;
    existingEmailWarning = false;
    existingAccount = false;

    try {
      const res = await api.sendVerificationCode(cleanEmail, purpose, confirmExisting);
      if (res.requires_confirmation) {
        existingEmailWarning = true;
        notify(res.message, 'info');
        return;
      }
      codeSent = true;
      notify(`Codice a 6 cifre inviato a ${cleanEmail}! Controlla la posta (incluso Spam).`, 'success');
      startCountdown(25);
    } catch (err) {
      notify(err.message || 'Errore durante l\'invio del codice. Riprova.', 'error');
      existingAccount = purpose === 'join_guest' && err.status === 409;
    } finally {
      sending = false;
    }
  }

  async function handleVerifyCode() {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanCode = (verificationCode || '').trim();
    if (cleanCode.length !== 6) {
      notify('Inserisci il codice a 6 cifre ricevuto via email.', 'error');
      return;
    }

    sending = true;
    try {
      await api.verifyCode(cleanEmail, cleanCode, purpose);
      verified = true;
      notify('Email verificata! Ora puoi completare il modulo.', 'success');
    } catch (err) {
      verified = false;
      notify(err.message || 'Codice non valido o scaduto. Riprova.', 'error');
    } finally {
      sending = false;
    }
  }

  function handleCodeInput(e) {
    const clean = e.target.value.replace(/\D/g, '').slice(0, 6);
    verificationCode = clean;
    verified = false;
    if (clean.length === 6) {
      setTimeout(() => handleVerifyCode(), 0);
    }
  }
</script>

<div class="verification-wrapper">
  <div class="input-group">
    <label class="input-label" for="vf-email">
      {label} {#if required}<span class="req">*</span>{/if}
    </label>
    <div class="input-action-row">
      <input
        id="vf-email"
        type="email"
        class="input-field email-input"
        class:is-verified={verified}
        value={email}
        oninput={handleEmailInput}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autocomplete="email"
      />
      {#if verified}
        <span class="verified-tag" role="status">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
          Verificata
        </span>
      {:else}
        <button
          type="button"
          class="btn-send-otp"
          disabled={disabled || sending || countdown > 0 || !email?.includes('@')}
          onclick={() => handleSendCode(false)}
        >
          {#if sending}
            <span class="btn-spinner"></span>
            <span>Invio...</span>
          {:else if countdown > 0}
            <span>Rinvia tra {countdown}s</span>
          {:else if codeSent}
            <span>Invia di nuovo</span>
          {:else}
            <span>Verifica email</span>
          {/if}
        </button>
      {/if}
    </div>
  </div>

  {#if existingEmailWarning}
    <div class="existing-email-confirm" role="alert">
      <p>Vuoi comunque utilizzare questa email per partecipare?</p>
      <button type="button" class="btn-confirm-existing" onclick={() => handleSendCode(true)} disabled={sending}>
        Sì, invia il codice
      </button>
    </div>
  {:else if existingAccount}
    <button type="button" class="link-btn existing-account-login" onclick={() => goto(loginUrl(page.url.searchParams.get('code')))}>
      Vai al login con email e password →
    </button>
  {/if}

  {#if codeSent && !verified}
    <div class="otp-block">
      <label class="otp-lead" for="vf-code">
        Ti abbiamo mandato un codice a <strong>{email.trim()}</strong>
      </label>
      <input
        id="vf-code"
        type="text"
        inputmode="numeric"
        maxlength="6"
        class="input-field otp-input"
        value={verificationCode}
        oninput={handleCodeInput}
        placeholder="000000"
        required
        disabled={disabled || sending}
        autocomplete="one-time-code"
      />
      <p class="otp-hint">Scrivi le 6 cifre, la verifica parte da sola. <br> Non lo trovi? Guarda nello spam.</p>
    </div>
  {/if}
</div>

<style>
  .verification-wrapper {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
  }

  .req {
    color: #b3261e;
  }

  .input-action-row {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }


  .email-input.is-verified {
    border-color: rgba(91, 155, 122, 0.55);
  }

  .btn-send-otp,
  .verified-tag {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 0 16px;
    min-height: var(--control-md);
    border-radius: 16px;
    font-size: var(--fs-base);
    font-weight: 700;
    white-space: nowrap;
  }

  /* Attivo: pieno color vino, si capisce subito che si può premere */
  .btn-send-otp {
    width: 100%;
    border: 1px solid var(--wine);
    background: var(--wine);
    color: #fff;
    box-shadow: 0 8px 16px -10px rgba(140, 47, 75, 0.7);
    cursor: pointer;
    transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
  }

  .btn-send-otp:hover:not(:disabled) {
    background: var(--wine-deep);
    border-color: var(--wine-deep);
  }

  .btn-send-otp:active:not(:disabled) {
    transform: translateY(1px);
  }

  /* Spento (email non valida o attesa per il rinvio): grigio e piatto */
  .btn-send-otp:disabled {
    border-color: rgba(36, 28, 32, 0.1);
    background: var(--bg-surface-elevated);
    color: var(--text-dim);
    box-shadow: none;
    cursor: not-allowed;
  }

  .btn-send-otp:disabled .btn-spinner {
    border-color: rgba(140, 47, 75, 0.2);
    border-top-color: var(--wine);
  }

  .verified-tag {
    width: 100%;
    color: #2f6b4c;
    background: rgba(91, 155, 122, 0.12);
  }

  .btn-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(140, 47, 75, 0.25);
    border-top-color: var(--wine);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Il codice continua il campo email: niente riquadro, testi centrati sopra e sotto la casella */
  .otp-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
    text-align: center;
  }

  .otp-lead {
    font-size: var(--fs-base);
    color: var(--text-muted);
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  .otp-lead strong {
    color: var(--text-main);
    font-weight: 600;
  }

  /* più specifico della regola globale che porta tutti gli input a 16px (anti-zoom iOS) */
  .verification-wrapper .otp-input {
    font-size: 1.5rem !important;
    font-weight: 700;
    letter-spacing: 0.4em;
    text-indent: 0.4em;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .otp-input::placeholder {
    color: rgba(36, 28, 32, 0.18);
  }

  .otp-hint {
    font-size: var(--fs-sm);
    color: var(--text-dim);
    line-height: 1.4;
  }

  .existing-email-confirm {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    text-align: center;
    font-size: var(--fs-base);
    color: var(--text-main);
    line-height: 1.4;
  }

  .btn-confirm-existing {
    border: 0;
    border-radius: 12px;
    min-height: var(--control-sm);
    padding: 0 14px;
    background: var(--wine);
    color: #fff;
    font-weight: 700;
    cursor: pointer;
  }

  .btn-confirm-existing:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  .existing-account-login {
    align-self: center;
    color: var(--wine);
  }
</style>
