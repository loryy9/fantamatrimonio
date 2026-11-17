<script>
  import { onMount, tick } from 'svelte';
  import { appState } from './lib/state.svelte.js';
  import Toast from './components/Toast.svelte';
  import ConfirmDialog from './components/ConfirmDialog.svelte';
  import InstructionsModal from './components/InstructionsModal.svelte';
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
  import OnboardingSetup from './components/OnboardingSetup.svelte';
  import AdminDashboard from './components/AdminDashboard.svelte';
  import DashboardView from './components/DashboardView.svelte';
  import SiteHeader from './components/SiteHeader.svelte';

  const GAME_VIEWS = {
    home: HomeView,
    gallery: GalleryView,
    hunt: HuntView,
    quiz: QuizView,
    leaderboard: LeaderboardView,
  };

  // Gli sposi modificano le sfide dentro il layout del sito, non in quello del gioco.
  const isCoupleSetup = $derived(appState.view === 'setup' && appState.isCouple);
  const GameView = $derived(GAME_VIEWS[appState.view]);

  function checkIsAdminRoute() {
    const p = location.pathname.toLowerCase();
    return p === '/admin' || p.startsWith('/admin/') || location.hash.toLowerCase() === '#admin' || location.search.toLowerCase().includes('admin');
  }

  let isAdminRoute = $state(checkIsAdminRoute());

  function exitAdmin() {
    isAdminRoute = false;
    history.pushState(null, '', '/');
  }

  function openAdmin(e) {
    e.preventDefault();
    history.pushState(null, '', '/admin');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  // Nell'accesso con codice, dopo il login dell'account si resta su "entra" e si passa
  // alla fase successiva: riporta in cima la pagina solo in questo passaggio.
  let previousHasAccount = appState.hasAccount;
  $effect(() => {
    const hasAccount = appState.hasAccount;
    if (appState.view === 'join' && hasAccount && !previousHasAccount) {
      const toTop = () => window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      toTop();
      tick().then(toTop);
    }
    previousHasAccount = hasAccount;
  });

  // Barra di stato iPhone/Safari e sfondo pagina coordinati con la topbar
  $effect(() => {
    const inGame = appState.isInGame;
    const background = inGame ? '#6a2037' : '#faf7f2';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', inGame ? '#ffffff' : '#faf7f2');
    document.documentElement.style.backgroundColor = background;
    document.body.style.backgroundColor = background;
    document.documentElement.classList.toggle('in-game-active', inGame);
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
<ConfirmDialog />
{#if appState.isInGame}
  <div class="game-safe-area-overlay" aria-hidden="true"></div>
{/if}
{#if !isAdminRoute}
  <InstructionsModal />
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
{:else if appState.isInGame && !isCoupleSetup}
  <!-- Layout del gioco: navbar bordeaux con monogramma degli sposi e tab in basso -->
  <div class="app-wrapper">
    <Navbar />
    <main class="main-content">
      <GameView />
    </main>
    <BottomNav />
  </div>
{:else}
  <!-- Layout del sito: topbar bianca con logo a sinistra e menu a destra -->
  <div class="site">
    <SiteHeader />

    {#if isCoupleSetup}
      <main class="site-fullscreen-main">
        <OnboardingSetup
          editMode={true}
          initialChallenges={appState.setupChallenges}
          onComplete={() => appState.openDashboard(appState.event?.id)}
          onCancel={() => appState.openDashboard(appState.event?.id)}
        />
      </main>
    {:else if appState.view === 'create'}
      <!-- Il form usa il layout normale; configurazione sfide e condivisione codice sono a tutto schermo -->
      <main class={appState.pendingInvite ? 'site-fullscreen-main' : 'site-main'}>
        <CreateEventView />
      </main>
    {:else if appState.view === 'join'}
      <main class="site-main">
        {#if appState.hasAccount}
          <LoginView />
        {:else}
          <!-- Senza account: Registrati (chiede il codice) oppure Accedi -->
          <SecureLoginView embedded joinMode initialMode="register" intro />
        {/if}
      </main>
    {:else if appState.view === 'dashboard'}
      <main class="site-main site-dashboard-page">
        <DashboardView />
      </main>
    {:else if appState.view === 'login-secure'}
      <main class="site-main">
        <SecureLoginView />
      </main>
    {:else}
      <main class="site-landing">
        <LandingView />
      </main>
    {/if}

    {#if !appState.pendingInvite && !isCoupleSetup}
      <footer class="site-footer">
        <span>Fanta Matrimonio · Gioca, scatta, rispondi e scala la classifica</span>
        <a href="/admin" class="admin-link-subtle" onclick={openAdmin}>Console Admin</a>
      </footer>
    {/if}
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

  .site-fullscreen-main {
    flex: 1;
    width: 100%;
    padding: 0;
    margin: 0;
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
