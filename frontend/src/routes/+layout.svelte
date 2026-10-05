<script>
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { appState } from '$lib/state.svelte.js';
  import Toast from '$components/Toast.svelte';
  import InstructionsModal from '$components/InstructionsModal.svelte';
  import UpgradeAccountModal from '$components/UpgradeAccountModal.svelte';
  import ClaimAccountModal from '$components/ClaimAccountModal.svelte';

  let { children } = $props();

  const isAdminRoute = $derived(page.url.pathname.toLowerCase().startsWith('/admin'));

  // Scroll in cima a ogni cambio pagina o sotto-tab
  $effect(() => {
    const _path = page.url.pathname;
    const _subTab = appState.quizSubTab;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  });

  onMount(() => {
    appState.init();
    return () => appState.stopPolling();
  });
</script>

<Toast />
{#if !isAdminRoute}
  <InstructionsModal />
  <UpgradeAccountModal />
  <ClaimAccountModal />
{/if}

{#if appState.isLoadingAuth && !isAdminRoute}
  <div class="splash-screen">
    <div class="splash-logo">
      <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="9" cy="12" r="5"></circle>
        <circle cx="15" cy="12" r="5"></circle>
      </svg>
    </div>
    <div class="splash-title font-serif gold-gradient-text">Fanta Matrimonio</div>
    <div class="spinner"></div>
  </div>
{:else}
  {@render children()}
{/if}

<style>
  .splash-screen {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    background: var(--bg-primary);
  }

  .splash-logo {
    color: var(--gold-primary);
    animation: pulse 1.5s infinite;
  }

  .splash-title {
    font-size: 1.8rem;
    font-weight: 800;
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.08); opacity: 0.85; }
  }
</style>
