<script>
  import { appState } from '../lib/state.svelte.js';
  import { formatName } from '../lib/formatters.js';

  let firstName = $state('');
  let lastName = $state('');
  let secretWord = $state('');
  let isSubmitting = $state(false);
  let errorMessage = $state('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !secretWord.trim()) {
      errorMessage = 'Per favore compila tutti i campi!';
      return;
    }

    errorMessage = '';
    isSubmitting = true;

    try {
      const res = await appState.login(
        formatName(firstName),
        formatName(lastName),
        secretWord.trim()
      );
      if (!res.success) {
        errorMessage = res.error || 'Accesso non riuscito. Controlla i dati inseriti.';
      }
    } catch (err) {
      errorMessage = err.message || 'Errore di connessione.';
    } finally {
      isSubmitting = false;
    }
  }
</script>

<div class="login-wrapper">
  <div class="login-header">
    <div class="rings-badge">
      <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="9" cy="12" r="5"></circle>
        <circle cx="15" cy="12" r="5"></circle>
      </svg>
    </div>
    <h1 class="login-title font-serif gold-gradient-text">Fanta Matrimonio</h1>
    <p class="login-subtitle">
      Benvenuto al gioco del nostro matrimonio! Gioca, scatta foto, rispondi ai quiz e scala la classifica live.
    </p>
  </div>

  <div class="glass-card glass-card-gold login-card">
    <div class="card-header">
      <h2 class="card-title font-serif">Accedi o Registrati</h2>
      <p class="card-desc">Nessuna password complessa: usa solo il tuo nome e una parola segreta che ricorderai.</p>
    </div>

    {#if errorMessage}
      <div class="error-banner">
        <span class="error-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
        </span>
        <span>{errorMessage}</span>
      </div>
    {/if}

    <form onsubmit={handleSubmit} class="login-form">
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

      <div class="input-group">
        <label for="secretWord" class="input-label">Parola Personale</label>
        <input
          id="secretWord"
          type="text"
          class="input-field"
          placeholder="Es. pizza, stella, 1234..."
          bind:value={secretWord}
          autocomplete="off"
          required
        />
        <span class="input-hint">Serve per rientrare dal tuo telefono o cambiare dispositivo.</span>
      </div>

      <button type="submit" class="btn btn-primary btn-block" disabled={isSubmitting}>
        {#if isSubmitting}
          <div class="spinner"></div>
          <span>Entrando in pista...</span>
        {:else}
          <span>Entra nel Gioco</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        {/if}
      </button>
    </form>
  </div>

  <div class="login-footer">
    <p class="footer-text">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="footer-heart"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
      Che la festa abbia inizio!
    </p>
  </div>
</div>

<style>
  .login-wrapper {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    min-height: 85vh;
    padding: 24px 16px;
    gap: 24px;
  }

  .login-header {
    text-align: center;
    max-width: 380px;
  }

  .rings-badge {
    color: var(--gold-primary);
    margin-bottom: 8px;
    animation: float 3s ease-in-out infinite;
  }

  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-8px); }
  }

  .login-title {
    font-size: 2.2rem;
    font-weight: 800;
    margin-bottom: 8px;
    line-height: 1.1;
  }

  .login-subtitle {
    font-size: 0.95rem;
    color: var(--text-muted);
    line-height: 1.45;
  }

  .login-card {
    width: 100%;
    max-width: 400px;
    padding: 24px 20px;
  }

  .card-header {
    margin-bottom: 20px;
    text-align: center;
  }

  .card-title {
    font-size: 1.35rem;
    color: var(--text-main);
    margin-bottom: 6px;
  }

  .card-desc {
    font-size: 0.85rem;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: var(--radius-md);
    background: rgba(212, 132, 154, 0.08);
    border: 1px solid rgba(212, 132, 154, 0.25);
    color: var(--rose-primary);
    font-size: 0.85rem;
    margin-bottom: 16px;
  }

  .error-icon {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .input-hint {
    font-size: 0.75rem;
    color: var(--text-dim);
    margin-top: 2px;
  }

  .login-footer {
    text-align: center;
    font-size: 0.9rem;
    color: var(--text-dim);
  }

  .footer-text {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .footer-heart {
    color: var(--rose-primary);
  }
</style>
