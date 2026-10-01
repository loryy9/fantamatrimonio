<script>
  import { appState } from '../lib/state.svelte.js';

  let email = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let isSubmitting = $state(false);
  let errorMessage = $state('');

  const displayName = $derived(
    appState.user ? `${appState.user.first_name} ${appState.user.last_name}` : ''
  );

  function close() {
    appState.showUpgradeModal = false;
    errorMessage = '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      errorMessage = 'Email e password sono obbligatori.';
      return;
    }
    if (password.length < 6) {
      errorMessage = 'La password deve essere di almeno 6 caratteri.';
      return;
    }
    if (password !== confirmPassword) {
      errorMessage = 'Le password non coincidono.';
      return;
    }

    errorMessage = '';
    isSubmitting = true;
    try {
      const res = await appState.upgradeAccount(email.trim(), password, displayName);
      if (!res.success) {
        errorMessage = res.error || 'Registrazione non riuscita.';
      }
    } catch (err) {
      errorMessage = err.message || 'Errore di connessione.';
    } finally {
      isSubmitting = false;
    }
  }
</script>

{#if appState.showUpgradeModal}
  <div class="modal-overlay" onclick={close} role="presentation">
    <div class="modal-card" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Registra il tuo account">
      <button class="modal-close" onclick={close} aria-label="Chiudi">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>

      <div class="modal-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
      </div>

      <h2 class="modal-title font-serif">Salva i tuoi ricordi</h2>
      <p class="modal-lead">
        Registra il tuo account per accedere alla dashboard con tutti i matrimoni a cui hai partecipato,
        le foto e i risultati — anche dopo la festa.
      </p>

      <form onsubmit={handleSubmit}>
        {#if errorMessage}
          <div class="form-error" role="alert">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
            <span>{errorMessage}</span>
          </div>
        {/if}

        <div class="input-group">
          <label for="upgradeEmail" class="input-label">Email</label>
          <input id="upgradeEmail" type="email" class="input-field" placeholder="es. mario@email.com" bind:value={email} autocomplete="email" required />
        </div>

        <div class="input-group">
          <label for="upgradePassword" class="input-label">Password</label>
          <input id="upgradePassword" type="password" class="input-field" placeholder="Almeno 6 caratteri" bind:value={password} autocomplete="new-password" minlength="6" required />
        </div>

        <div class="input-group">
          <label for="upgradeConfirm" class="input-label">Conferma password</label>
          <input id="upgradeConfirm" type="password" class="input-field" placeholder="Ripeti la password" bind:value={confirmPassword} autocomplete="new-password" required />
        </div>

        <button type="submit" class="btn btn-primary btn-block" disabled={isSubmitting}>
          {#if isSubmitting}
            <div class="spinner spinner-on-dark"></div>
            <span>Registrazione...</span>
          {:else}
            <span>Registra account</span>
          {/if}
        </button>
      </form>

      <button class="skip-btn" onclick={close}>Magari dopo</button>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: grid;
    place-items: center;
    padding: 16px;
    background: rgba(36, 28, 32, 0.65);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    animation: fadeIn 0.2s ease;
  }

  .modal-card {
    position: relative;
    width: 100%;
    max-width: 420px;
    padding: 32px 28px;
    border-radius: 28px;
    background: var(--paper);
    box-shadow: 0 24px 56px rgba(36, 28, 32, 0.35);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .modal-close {
    position: absolute;
    top: 14px;
    right: 14px;
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: rgba(0, 0, 0, 0.05);
    cursor: pointer;
    color: var(--text-muted);
    transition: background 0.15s;
  }

  .modal-close:hover {
    background: rgba(0, 0, 0, 0.1);
  }

  .modal-icon {
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: rgba(201, 169, 110, 0.12);
    border: 1px solid rgba(201, 169, 110, 0.3);
    color: var(--gold-dark);
  }

  .modal-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-main);
  }

  .modal-lead {
    font-size: 0.9rem;
    color: var(--text-muted);
    line-height: 1.5;
    max-width: 34ch;
  }

  form {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 8px;
    text-align: left;
  }

  .form-error {
    margin-bottom: 4px;
  }

  .skip-btn {
    margin-top: 4px;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-dim);
    padding: 6px;
    transition: color 0.15s;
  }

  .skip-btn:hover {
    color: var(--text-muted);
  }

  .spinner-on-dark {
    border-color: rgba(255, 255, 255, 0.4);
    border-top-color: #fff;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(20px) scale(0.97); }
    to { opacity: 1; transform: none; }
  }
</style>
