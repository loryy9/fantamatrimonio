<script>
  import { appState } from '../lib/state.svelte.js';

  let password = $state('');
  let confirmPassword = $state('');
  let displayName = $state(appState.claimData?.display_name || '');
  let showPassword = $state(false);
  let isSubmitting = $state(false);
  let errorMessage = $state('');

  $effect(() => {
    if (appState.claimData?.display_name && !displayName) {
      displayName = appState.claimData.display_name;
    }
  });

  const eventLabel = $derived.by(() => {
    const ev = appState.claimData?.event || appState.event;
    if (!ev) return '';
    return `${ev.spouse1_name} & ${ev.spouse2_name || ''}`;
  });

  function close() {
    appState.showClaimModal = false;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    errorMessage = '';

    if (!password || password.length < 6) {
      errorMessage = 'La password deve contenere almeno 6 caratteri.';
      return;
    }

    if (password !== confirmPassword) {
      errorMessage = 'Le password non coincidono.';
      return;
    }

    isSubmitting = true;
    try {
      const res = await appState.completeClaim(password, displayName.trim());
      if (!res.success) {
        errorMessage = res.error || 'Errore durante la creazione dell\'account.';
      }
    } catch (err) {
      errorMessage = err.message || 'Errore di connessione.';
    } finally {
      isSubmitting = false;
    }
  }
</script>

{#if appState.showClaimModal && appState.claimData}
  <div class="modal-overlay" role="presentation">
    <div class="modal-card" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Completa il tuo account">
      <button class="modal-close" onclick={close} aria-label="Chiudi">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>

      <div class="modal-badge-ring">💍</div>

      <span class="eyebrow">I tuoi ricordi ti aspettano</span>
      <h2 class="modal-title font-serif">Salva il tuo account</h2>
      <p class="modal-lead">
        Ciao <strong>{appState.claimData.first_name || 'invitato'}</strong>! Abbiamo ripristinato la tua sessione{#if eventLabel} per il matrimonio di <strong>{eventLabel}</strong>{/if}.
        Imposta una password per accedere alla tua <strong>Dashboard personale</strong> e conservare lo storico dei quiz, punteggi e foto.
      </p>

      <form class="claim-form" onsubmit={handleSubmit}>
        {#if errorMessage}
          <div class="form-error" role="alert">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
            <span>{errorMessage}</span>
          </div>
        {/if}

        <div class="input-group">
          <label for="claimName" class="input-label">Nome e Cognome</label>
          <input
            id="claimName"
            type="text"
            class="input-field"
            bind:value={displayName}
            placeholder="es. Mario Rossi"
            required
            disabled={isSubmitting}
          />
        </div>

        <div class="input-group">
          <div class="label-with-badge">
            <label for="claimEmail" class="input-label">Email</label>
            <span class="verified-badge">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Verificata dal link
            </span>
          </div>
          <input
            id="claimEmail"
            type="email"
            class="input-field readonly-email"
            value={appState.claimData.email}
            readonly
            tabindex="-1"
          />
        </div>

        <div class="input-group">
          <label for="claimPassword" class="input-label">Crea password (min. 6 caratteri)</label>
          <div class="pwd-input-wrap">
            {#if showPassword}
              <input
                id="claimPassword"
                type="text"
                class="input-field"
                placeholder="La tua nuova password"
                bind:value={password}
                autocomplete="new-password"
                minlength="6"
                required
                disabled={isSubmitting}
              />
            {:else}
              <input
                id="claimPassword"
                type="password"
                class="input-field"
                placeholder="La tua nuova password"
                bind:value={password}
                autocomplete="new-password"
                minlength="6"
                required
                disabled={isSubmitting}
              />
            {/if}
            <button
              type="button"
              class="btn-toggle-pwd"
              onclick={() => showPassword = !showPassword}
              aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
            >
              {#if showPassword}
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
              {:else}
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              {/if}
            </button>
          </div>
        </div>

        <div class="input-group">
          <label for="claimConfirm" class="input-label">Conferma password</label>
          <div class="pwd-input-wrap">
            {#if showPassword}
              <input
                id="claimConfirm"
                type="text"
                class="input-field"
                placeholder="Ripeti la password"
                bind:value={confirmPassword}
                autocomplete="new-password"
                required
                disabled={isSubmitting}
              />
            {:else}
              <input
                id="claimConfirm"
                type="password"
                class="input-field"
                placeholder="Ripeti la password"
                bind:value={confirmPassword}
                autocomplete="new-password"
                required
                disabled={isSubmitting}
              />
            {/if}
          </div>
        </div>

        <button type="submit" class="btn btn-primary btn-block btn-lg submit-claim-btn" disabled={isSubmitting}>
          {#if isSubmitting}
            <div class="spinner spinner-on-dark"></div>
            <span>Creazione account in corso...</span>
          {:else}
            <span>Crea account e apri la Dashboard →</span>
          {/if}
        </button>
      </form>

      <button class="skip-btn" onclick={close}>
        Più tardi, torna alla festa
      </button>
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
    background: rgba(36, 28, 32, 0.68);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    animation: fadeIn 0.2s ease;
  }

  .modal-card {
    position: relative;
    width: 100%;
    max-width: 460px;
    padding: 34px 30px;
    border-radius: 28px;
    background: var(--paper);
    border: 1px solid rgba(201, 169, 110, 0.35);
    box-shadow: 0 24px 60px rgba(36, 28, 32, 0.35);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
    animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .modal-close {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: rgba(36, 28, 32, 0.06);
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .modal-close:hover {
    background: rgba(36, 28, 32, 0.12);
    color: var(--text-main);
  }

  .modal-badge-ring {
    font-size: 2.2rem;
    line-height: 1;
    margin-bottom: 2px;
  }

  .eyebrow {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--gold-dark);
    padding: 4px 12px;
    border-radius: var(--radius-full);
    background: rgba(201, 169, 110, 0.12);
    border: 1px solid rgba(201, 169, 110, 0.3);
  }

  .modal-title {
    font-size: 1.7rem;
    color: var(--text-main);
    margin: 0;
  }

  .modal-lead {
    font-size: 0.92rem;
    color: var(--text-muted);
    line-height: 1.5;
    margin: 0 0 6px;
  }

  .claim-form {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 14px;
    text-align: left;
    margin-top: 4px;
  }

  .label-with-badge {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }

  .verified-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.72rem;
    font-weight: 700;
    color: #2e7d32;
    background: rgba(46, 125, 50, 0.1);
    border: 1px solid rgba(46, 125, 50, 0.25);
    padding: 2px 8px;
    border-radius: 9999px;
  }

  .readonly-email {
    background: #f7f4ef !important;
    color: #4a3e43 !important;
    cursor: default;
    border-color: rgba(201, 169, 110, 0.3) !important;
    font-weight: 600;
  }

  .pwd-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .pwd-input-wrap .input-field {
    padding-right: 44px;
    width: 100%;
  }

  .btn-toggle-pwd {
    position: absolute;
    right: 12px;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    transition: color 0.15s ease;
  }

  .btn-toggle-pwd:hover {
    color: var(--text-main);
  }

  .submit-claim-btn {
    margin-top: 6px;
    padding: 14px;
    font-size: 1rem;
    font-weight: 700;
    justify-content: center;
  }

  .skip-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    padding: 6px 12px;
    border-radius: var(--radius-full);
    transition: color 0.15s;
    margin-top: 4px;
  }

  .skip-btn:hover {
    color: var(--wine);
    text-decoration: underline;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
