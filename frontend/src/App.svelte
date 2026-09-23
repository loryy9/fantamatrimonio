<script>
  import { onMount, tick } from 'svelte';
  import { appState } from './lib/state.svelte.js';
  import Toast from './components/Toast.svelte';
  import InstructionsModal from './components/InstructionsModal.svelte';
  import Navbar from './components/Navbar.svelte';
  import BottomNav from './components/BottomNav.svelte';
  import LoginView from './components/LoginView.svelte';
  import HomeView from './components/HomeView.svelte';
  import GalleryView from './components/GalleryView.svelte';
  import HuntView from './components/HuntView.svelte';
  import QuizView from './components/QuizView.svelte';
  import LeaderboardView from './components/LeaderboardView.svelte';

  let mainContentEl = $state(null);

  // Automatically reset scroll to top on any tab or subtab change
  $effect(() => {
    const _tab = appState.activeTab;
    const _subTab = appState.quizSubTab;

    if (mainContentEl) {
      mainContentEl.scrollTop = 0;
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    tick().then(() => {
      if (mainContentEl) {
        mainContentEl.scrollTop = 0;
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    });
  });

  onMount(() => {
    appState.init();
    return () => {
      appState.stopPolling();
    };
  });
</script>

<Toast />
<InstructionsModal />

<div class="app-wrapper">
  {#if appState.isLoadingAuth}
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
  {:else if !appState.isAuthenticated}
    <LoginView />
  {:else}
    <Navbar />

    <main class="main-content" bind:this={mainContentEl}>
      {#if appState.activeTab === 'home'}
        <HomeView />
      {:else if appState.activeTab === 'gallery'}
        <GalleryView />
      {:else if appState.activeTab === 'hunt'}
        <HuntView />
      {:else if appState.activeTab === 'quiz'}
        <QuizView />
      {:else if appState.activeTab === 'leaderboard'}
        <LeaderboardView />
      {/if}
    </main>

    <BottomNav />
  {/if}
</div>

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
