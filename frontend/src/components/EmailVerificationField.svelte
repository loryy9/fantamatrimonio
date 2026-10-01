<script>
  import { api } from '../lib/api.js';

  let {
    email = $bindable(''),
    verificationCode = $bindable(''),
    purpose = 'register_account',
    disabled = false,
    label = 'Email',
    placeholder = 'nome@esempio.com',
    required = true
  } = $props();

  let sending = $state(false);
  let codeSent = $state(false);
  let statusMessage = $state('');
  let isError = $state(false);
  let countdown = $state(0);
  let timer = null;

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

  async function handleSendCode() {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      statusMessage = 'Inserisci un indirizzo email valido prima di richiedere il codice.';
      isError = true;
      return;
    }

    sending = true;
    statusMessage = '';
    isError = false;

    try {
      const res = await api.sendVerificationCode(cleanEmail, purpose);
      codeSent = true;
      statusMessage = `Codice a 6 cifre inviato a ${cleanEmail}! Controlla la posta (incluso Spam).`;
      isError = false;
      startCountdown(25);
    } catch (err) {
      statusMessage = err.message || 'Errore durante l\'invio del codice. Riprova.';
      isError = true;
    } finally {
      sending = false;
    }
  }

  function handleCodeInput(e) {
    const clean = e.target.value.replace(/\D/g, '').slice(0, 6);
    verificationCode = clean;
  }
</script>

<div class="verification-wrapper">
  <!-- Campo Email Principale -->
  <div class="input-group">
    <label class="input-label" for="vf-email">
      {label} {#if required}<span class="req">*</span>{/if}
    </label>
    <div class="input-action-row">
      <input
        id="vf-email"
        type="email"
        class="input-field email-input"
        bind:value={email}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autocomplete="email"
      />
      <button
        type="button"
        class="btn-send-otp"
        class:btn-sent={codeSent}
        disabled={disabled || sending || countdown > 0 || !email?.includes('@')}
        onclick={handleSendCode}
      >
        {#if sending}
          <span class="btn-spinner"></span>
          <span>Invio...</span>
        {:else if countdown > 0}
          <span>Rinvia ({countdown}s)</span>
        {:else if codeSent}
          <span>Invia di nuovo</span>
        {:else}
          <span>Invia codice</span>
        {/if}
      </button>
    </div>
  </div>

  <!-- Campo Codice OTP quando inviato -->
  {#if codeSent}
    <div class="input-group otp-card">
      <div class="otp-header">
        <label class="input-label" for="vf-code">
          Codice di verifica ricevuto {#if required}<span class="req">*</span>{/if}
        </label>
        <span class="otp-pill">6 cifre</span>
      </div>
      <input
        id="vf-code"
        type="text"
        inputmode="numeric"
        maxlength="6"
        class="input-field otp-input"
        value={verificationCode}
        oninput={handleCodeInput}
        placeholder="••••••"
        required
        disabled={disabled}
        autocomplete="one-time-code"
      />
      <span class="otp-hint">Inserisci il codice ricevuto per confermare che l'indirizzo email ti appartiene.</span>
    </div>
  {/if}

  {#if statusMessage}
    <div class="otp-feedback" class:feedback-err={isError} class:feedback-ok={!isError} role="alert">
      <span class="feedback-icon">{isError ? '⚠️' : '✉️'}</span>
      <span class="feedback-text">{statusMessage}</span>
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
    color: #e05252;
  }

  .input-action-row {
    display: flex;
    gap: 10px;
    align-items: stretch;
    width: 100%;
  }

  .email-input {
    flex: 1;
    min-width: 0;
  }

  .btn-send-otp {
    flex-shrink: 0;
    padding: 0 18px;
    height: 48px;
    font-size: 0.86rem;
    font-weight: 700;
    border-radius: 16px;
    border: 1px solid rgba(140, 47, 75, 0.25);
    background: linear-gradient(135deg, rgba(140, 47, 75, 0.08), rgba(201, 169, 110, 0.12));
    color: var(--wine, #8c2f4b);
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    white-space: nowrap;
  }

  .btn-send-otp:hover:not(:disabled) {
    background: linear-gradient(135deg, rgba(140, 47, 75, 0.16), rgba(201, 169, 110, 0.22));
    border-color: var(--wine, #8c2f4b);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(140, 47, 75, 0.12);
  }

  .btn-send-otp:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .btn-send-otp.btn-sent {
    border-color: rgba(201, 169, 110, 0.45);
    color: var(--gold-dark, #8b6d2e);
    background: rgba(201, 169, 110, 0.1);
  }

  .btn-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(140, 47, 75, 0.25);
    border-top-color: var(--wine, #8c2f4b);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .otp-card {
    background: linear-gradient(180deg, rgba(201, 169, 110, 0.08) 0%, rgba(201, 169, 110, 0.02) 100%);
    border: 1px dashed rgba(201, 169, 110, 0.45);
    border-radius: 18px;
    padding: 14px 16px;
    animation: slideDown 0.25s ease;
  }

  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .otp-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2px;
  }

  .otp-pill {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 2px 8px;
    border-radius: 12px;
    background: rgba(201, 169, 110, 0.2);
    color: var(--gold-dark, #8b6d2e);
  }

  .otp-input {
    font-size: 1.4rem;
    letter-spacing: 0.35em;
    font-weight: 700;
    text-align: center;
    background: #fff;
    border: 1.5px solid rgba(201, 169, 110, 0.5);
    border-radius: 14px;
    padding: 10px 14px;
    color: var(--text-main, #241c20);
  }

  .otp-input:focus {
    border-color: var(--gold-dark, #8b6d2e);
    box-shadow: 0 0 0 3px rgba(201, 169, 110, 0.2);
    background: #fff;
  }

  .otp-hint {
    font-size: 0.8rem;
    color: var(--text-muted, #7a7276);
    line-height: 1.35;
    margin-top: 2px;
  }

  .otp-feedback {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 0.84rem;
    padding: 10px 14px;
    border-radius: 14px;
    line-height: 1.4;
  }

  .feedback-ok {
    background: rgba(34, 197, 94, 0.08);
    color: #15803d;
    border: 1px solid rgba(34, 197, 94, 0.25);
  }

  .feedback-err {
    background: rgba(239, 68, 68, 0.08);
    color: #b91c1c;
    border: 1px solid rgba(239, 68, 68, 0.25);
  }

  @media (max-width: 520px) {
    .input-action-row {
      flex-direction: column;
      gap: 8px;
    }
    .btn-send-otp {
      width: 100%;
      height: 44px;
    }
  }
</style>
