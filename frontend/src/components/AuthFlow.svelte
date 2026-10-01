<script>
  import { onMount } from 'svelte';
  import { appState } from '../lib/state.svelte.js';
  import LandingView from './LandingView.svelte';
  import LoginView from './LoginView.svelte';
  import CreateEventView from './CreateEventView.svelte';
  import SecureLoginView from './SecureLoginView.svelte';
  import SiteHeader from './SiteHeader.svelte';

  const isLanding = $derived(!appState.pendingInvite && appState.authView !== 'create' && appState.authView !== 'join' && appState.authView !== 'login-secure');

  function scrollToId(id) {
    if (!isLanding) {
      appState.setAuthView('entry');
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return;
    }

    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  onMount(() => {
    const sync = () => {
      if (appState.pendingInvite) return;
      const path = window.location.pathname;
      appState.authView = path === '/crea' ? 'create' : path === '/entra' ? 'join' : (path === '/dashboard_utente' || path === '/login' || path === '/dashboard') ? 'login-secure' : 'entry';
    };
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  });
</script>

<div class="site">
  <SiteHeader {scrollToId} />

  {#if isLanding}
    <main class="site-landing">
      <LandingView />
    </main>
  {:else}
    <main class="site-main">
      {#if appState.pendingInvite || appState.authView === 'create'}
        <CreateEventView />
      {:else if appState.authView === 'login-secure'}
        <SecureLoginView />
      {:else}
        <LoginView />
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

<style>
  .site-footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
    color: var(--text-muted);
    padding: 24px 16px;
    text-align: center;
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

  .site-landing {
    flex: 1;
    width: 100%;
  }
</style>
