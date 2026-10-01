<script>
  import { onMount } from 'svelte';
  import { appState } from '../lib/state.svelte.js';
  import LandingView from './LandingView.svelte';
  import LoginView from './LoginView.svelte';
  import CreateEventView from './CreateEventView.svelte';

  let siteHeaderHeight = $state(72);

  const isLanding = $derived(!appState.pendingInvite && appState.authView !== 'create' && appState.authView !== 'join');

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
      appState.authView = path === '/crea' ? 'create' : path === '/entra' ? 'join' : 'entry';
    };
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  });
</script>

<div class="site" style="--site-header-height: {siteHeaderHeight ? siteHeaderHeight + 'px' : '72px'};">
  <header class="site-header" bind:clientHeight={siteHeaderHeight}>
    <div class="site-header-inner">
      <button class="brand" onclick={() => appState.setAuthView('entry')} aria-label="Home">
        <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="5"></circle><circle cx="15" cy="12" r="5"></circle></svg>
        <span class="brand-name font-serif gold-gradient-text">Fanta Matrimonio</span>
      </button>

      <nav class="top-nav">
        <button class="nav-link nav-anchor" onclick={() => scrollToId('come-funziona')}>Come funziona</button>
        <button class="nav-link nav-anchor" onclick={() => scrollToId('giochi')}>I giochi</button>
        <button class="nav-link" class:active={appState.authView === 'join'} onclick={() => appState.setAuthView('join')}>Entra con un codice</button>
        <button class="btn btn-primary nav-cta" onclick={() => appState.setAuthView('create')}>Crea il matrimonio</button>
      </nav>
    </div>
  </header>

  {#if isLanding}
    <main class="site-landing">
      <LandingView />
    </main>
  {:else}
    <main class="site-main">
      {#if appState.pendingInvite || appState.authView === 'create'}
        <CreateEventView />
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
  .brand {
    display: flex;
    align-items: center;
    gap: 9px;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--gold-primary);
  }

  .brand-name {
    font-size: 1.35rem;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  .top-nav {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .nav-link {
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-sans);
    font-weight: 600;
    font-size: 0.92rem;
    color: var(--text-muted);
    padding: 10px 14px;
    border-radius: var(--radius-md);
    transition: color 0.2s, background 0.2s;
  }

  .nav-link:hover,
  .nav-link.active {
    color: var(--gold-dark);
    background: rgba(201, 169, 110, 0.12);
  }

  .nav-cta {
    padding: 10px 18px;
    border-radius: 14px;
    font-size: 0.9rem;
  }

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

  @media (max-width: 899px) {
    .nav-anchor { display: none; }
  }

  @media (max-width: 560px) {
    .brand-name { font-size: 1.1rem; }
    .nav-link { display: none; }
  }
</style>
