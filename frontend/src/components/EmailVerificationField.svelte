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
      statusMessage = `Codice inviato a ${cleanEmail}! Controlla la casella di posta (e lo spam).`;
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
    // Mantieni solo cifre e limita a 6
    const clean = e.target.value.replace(/\D/g, '').slice(0, 6);
    verificationCode = clean;
  }
</script>

<div class="email-verification-group">
  <div class="field email-row">
    <label for="vf-email">{label} {#if required}<span class="req">*</span>{/if}</label>
    <div class="input-with-button">
      <input
        id="vf-email"
        type="email"
        bind:value={email}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autocomplete="email"
      />
      <button
        type="button"
        class="btn-send-code"
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

  {#if codeSent}
    <div class="field code-box">
      <div class="code-header">
        <label for="vf-code">Codice di verifica email <span class="req">*</span></label>
        <span class="code-badge">6 cifre</span>
      </div>
      <input
        id="vf-code"
        type="text"
        inputmode="numeric"
        maxlength="6"
        value={verificationCode}
        oninput={handleCodeInput}
        placeholder="123456"
        class="code-input"
        required
        disabled={disabled}
        autocomplete="one-time-code"
      />
      <span class="field-hint">Inserisci il codice ricevuto per verificare che l'email sia tua.</span>
    </div>
  {/if}

  {#if statusMessage}
    <div class="status-msg" class:status-err={isError} class:status-ok={!isError} role="alert">
      <span>{isError ? '⚠️' : '✉️'}</span>
      <span>{statusMessage}</span>
    </div>
  {/if}
</div>

<style>
  .email-verification-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .req {
    color: #e05252;
  }

  .input-with-button {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .input-with-button input {
    flex: 1;
    min-width: 0;
  }

  .btn-send-code {
    white-space: nowrap;
    padding: 10px 14px;
    font-size: 0.82rem;
    font-weight: 600;
    border-radius: var(--radius-sm, 8px);
    border: 1px solid rgba(201, 169, 110, 0.4);
    background: linear-gradient(135deg, rgba(233, 201, 143, 0.2), rgba(201, 169, 110, 0.1));
    color: var(--gold-dark, #8b6d2e);
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 42px;
  }

  .btn-send-code:hover:not(:disabled) {
    background: linear-gradient(135deg, rgba(233, 201, 143, 0.35), rgba(201, 169, 110, 0.22));
    border-color: var(--gold-dark, #8b6d2e);
    transform: translateY(-1px);
  }

  .btn-send-code:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    transform: none;
  }

  .btn-spinner {
    width: 12px;
    height: 12px;
    border: 2px solid rgba(139, 109, 46, 0.3);
    border-top-color: var(--gold-dark, #8b6d2e);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .code-box {
    background: rgba(248, 244, 235, 0.7);
    border: 1px solid rgba(201, 169, 110, 0.3);
    border-radius: var(--radius-md, 10px);
    padding: 12px 14px;
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .code-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .code-badge {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 2px 7px;
    border-radius: 20px;
    background: rgba(201, 169, 110, 0.25);
    color: var(--gold-dark, #8b6d2e);
  }

  .code-input {
    font-size: 1.3rem;
    letter-spacing: 0.35em;
    font-weight: 700;
    text-align: center;
    background: #fff;
    border: 2px solid rgba(201, 169, 110, 0.4);
    border-radius: 8px;
    padding: 8px 12px;
  }

  .code-input:focus {
    border-color: var(--gold-dark, #8b6d2e);
    outline: none;
    box-shadow: 0 0 0 3px rgba(201, 169, 110, 0.2);
  }

  .status-msg {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 0.82rem;
    padding: 9px 12px;
    border-radius: var(--radius-sm, 8px);
    line-height: 1.4;
  }

  .status-ok {
    background: #f0fdf4;
    color: #166534;
    border: 1px solid #bbf7d0;
  }

  .status-err {
    background: #fef2f2;
    color: #991b1b;
    border: 1px solid #fecaca;
  }
</style>
