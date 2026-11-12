<script>
  import { onMount } from 'svelte';
  import { api } from '../lib/api.js';
  import { appState } from '../lib/state.svelte.js';
  import { renderGoogleButton, facebookLogin } from '../lib/social.js';

  // `onToken(provider, token)`: chiamato dopo il consenso del provider. Il genitore decide cosa fare
  // (login, registrazione + iscrizione al matrimonio, creazione matrimonio...).
  let { onToken, busy = false, label = 'Continua con' } = $props();

  let providers = $state({ google_client_id: null, facebook_app_id: null });
  let loaded = $state(false);
  let googleBtnEl = $state(null);
  let working = $state(false);

  onMount(async () => {
    try {
      providers = await api.getAuthProviders();
    } catch (_) {
      // resta la versione "non attiva"
    }
    loaded = true;
  });

  $effect(() => {
    if (!providers.google_client_id || !googleBtnEl) return;
    renderGoogleButton(googleBtnEl, providers.google_client_id, async (idToken) => {
      working = true;
      try {
        await onToken('google', idToken);
      } finally {
        working = false;
      }
    }).catch((err) => appState.showToast(err.message, 'error'));
  });

  async function handleFacebook() {
    if (!providers.facebook_app_id) {
      appState.showToast('Accesso con Facebook non ancora attivo: usa email e password.', 'info');
      return;
    }
    working = true;
    try {
      const token = await facebookLogin(providers.facebook_app_id);
      await onToken('facebook', token);
    } catch (err) {
      appState.showToast(err.message || 'Accesso con Facebook non riuscito.', 'error');
    } finally {
      working = false;
    }
  }

  function googleNotReady() {
    appState.showToast('Accesso con Google non ancora attivo: usa email e password.', 'info');
  }
</script>

<div class="social-stack" class:busy={busy || working}>
  {#if providers.google_client_id}
    <div class="google-slot" bind:this={googleBtnEl}></div>
  {:else}
    <button type="button" class="social-btn google" onclick={googleNotReady} disabled={!loaded}>
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6l-7.9-6.2A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.2C6.5 42.6 14.6 48 24 48z"/></svg>
      <span>{label} Google</span>
    </button>
  {/if}
  <button type="button" class="social-btn facebook" onclick={handleFacebook} disabled={!loaded}>
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.69.24 2.69.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"/></svg>
    <span>{label} Facebook</span>
  </button>
</div>
<div class="divider"><span>oppure con la tua email</span></div>

<style>
  .social-stack {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: stretch;
  }
  .social-stack.busy {
    opacity: 0.6;
    pointer-events: none;
  }
  .google-slot {
    display: flex;
    justify-content: center;
    min-height: 44px;
  }
  .social-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    height: 44px;
    border-radius: 999px;
    font-weight: 600;
    font-size: 0.95rem;
    cursor: pointer;
    font-family: inherit;
  }
  .social-btn.google {
    background: #fff;
    color: #3c4043;
    border: 1px solid #dadce0;
  }
  .social-btn.google:hover:not(:disabled) {
    background: #f7f8f8;
  }
  .social-btn.facebook {
    background: #1877f2;
    color: #fff;
    border: 0;
  }
  .social-btn.facebook:hover:not(:disabled) {
    background: #166fe0;
  }
  .divider {
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--text-muted);
    font-size: 0.8rem;
    margin: 14px 0 2px;
  }
  .divider::before,
  .divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: rgba(201, 169, 110, 0.3);
  }
</style>
