<script>
  import { onMount, tick } from 'svelte';
  import { appState } from './lib/state.svelte.js';
  import Toast from './components/Toast.svelte';
  import InstructionsModal from './components/InstructionsModal.svelte';
  import UpgradeAccountModal from './components/UpgradeAccountModal.svelte';
  import ClaimAccountModal from './components/ClaimAccountModal.svelte';
  import Navbar from './components/Navbar.svelte';
  import BottomNav from './components/BottomNav.svelte';
  import LandingView from './components/LandingView.svelte';
  import LoginView from './components/LoginView.svelte';
  import CreateEventView from './components/CreateEventView.svelte';
  import SecureLoginView from './components/SecureLoginView.svelte';
  import HomeView from './components/HomeView.svelte';
  import GalleryView from './components/GalleryView.svelte';
  import HuntView from './components/HuntView.svelte';
  import QuizView from './components/QuizView.svelte';
  import LeaderboardView from './components/LeaderboardView.svelte';
  import ManageView from './components/ManageView.svelte';
  import AdminDashboard from './components/AdminDashboard.svelte';
  import DashboardView from './components/DashboardView.svelte';
  import SiteHeader from './components/SiteHeader.svelte';

  let mainContentEl = $state(null);

  function checkIsAdminRoute() {
    if (typeof window === 'undefined') return false;
    const p = window.location.pathname.toLowerCase();
    const h = window.location.hash.toLowerCase();
    const s = window.location.search.toLowerCase();
    return p === '/admin' || p.startsWith('/admin/') || h === '#admin' || s.includes('admin');
  }

  let isAdminRoute = $state(checkIsAdminRoute());

  function exitAdmin() {
    isAdminRoute = false;
    history.pushState(null, '', '/');
  }

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
    function handleLocationChange() {
      isAdminRoute = checkIsAdminRoute();
      appState.syncRouteFromUrl();
    }
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);

    appState.init();
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
      appState.stopPolling();
    };
  });
</script>

<Toast />
{#if !isAdminRoute}
  <InstructionsModal />
  <UpgradeAccountModal />
  <ClaimAccountModal />
{/if}

{#if isAdminRoute}
  <AdminDashboard onExit={exitAdmin} />
{:else if appState.isLoadingAuth}
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
{:else if appState.isInGame}
  <!-- NAVBAR FESTA BORDEAUX CON MONOGRAMMA SPOSI SOLO DENTRO AL GIOCO EFFETTIVO -->
  <div class="app-wrapper">
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
      {:else if appState.activeTab === 'manage'}
        <ManageView />
      {/if}
    </main>

    {#if appState.event}
      <BottomNav />
    {/if}
  </div>
{:else}
  <!-- NAVBAR BIANCA CLASSICA CON LOGO E SCRITTA A SINISTRA, NAVMENU A DESTRA PER TUTTE LE ALTRE VIEW -->
  <div class="site">
    <SiteHeader />

    {#if appState.authView === 'entry' && !appState.pendingInvite}
      <main class="site-landing">
        <LandingView />
      </main>
    {:else}
      <main class="site-main" class:site-dashboard-page={appState.authView === 'dashboard' || appState.activeTab === 'dashboard'}>
        {#if appState.pendingInvite || appState.authView === 'create'}
          <CreateEventView />
        {:else if appState.authView === 'dashboard' || appState.activeTab === 'dashboard'}
          <DashboardView />
        {:else if appState.authView === 'login-secure'}
          <SecureLoginView />
        {:else if appState.authView === 'join'}
          <LoginView />
        {:else}
          <LandingView />
        {/if}
      </main>
    {/if}

    <footer class="site-footer">
      <span>Fanta Matrimonio · Gioca, scatta, rispondi e scala la classifica</span>
      <a
        href="/admin"
        class="admin-link-subtle"
        onclick={(e) => {
          e.preventDefault();
          history.pushState(null, '', '/admin');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }}
      >
        Console Admin
      </a>
    </footer>
  </div>
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

  .site {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: #faf8f5;
  }

  .site-landing {
    flex: 1;
    width: 100%;
  }

  .site-dashboard-page {
    padding-top: 16px;
    padding-bottom: 48px;
    max-width: 1100px;
  }

  .site-footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    font-size: 0.82rem;
    color: var(--text-muted);
    padding: 24px 16px;
    text-align: center;
    border-top: 1px solid rgba(201, 169, 110, 0.18);
    background: #ffffff;
    margin-top: auto;
  }

  .admin-link-subtle {
    font-size: 0.76rem;
    color: var(--text-dim);
    text-decoration: none;
    transition: color 0.15s ease;
  }

  .admin-link-subtle:hover {
    color: var(--gold-dark);
    text-decoration: underline;
  }
</style>
