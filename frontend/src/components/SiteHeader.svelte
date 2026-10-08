<script>
  import { onMount } from 'svelte';
  import { appState } from '../lib/state.svelte.js';

  let { scrollToId } = $props();
  let showUserMenu = $state(false);

  onMount(() => {
    const closeMenu = (event) => {
      if (!event.target.closest('.user-menu')) showUserMenu = false;
    };
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  });

  function handleBrandClick() {
    if (appState.hasAccount) {
      appState.openDashboard();
    } else {
      appState.setAuthView('entry');
    }
  }

  function handleAnchorClick(id) {
    if (appState.authView !== 'entry' || appState.activeTab === 'dashboard' || appState.activeTab === 'create' || appState.activeTab === 'join') {
      appState.setAuthView('entry');
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 70);
      return;
    }

    if (scrollToId) {
      scrollToId(id);
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function handleLogout() {
    if (confirm('Vuoi uscire dal tuo account?')) {
      appState.logout();
    }
  }
</script>

<header class="site-header">
  <div class="site-header-inner">
    <!-- Brand a sinistra: Logo anelli + Scritta Fanta Matrimonio -->
    <button class="brand" onclick={handleBrandClick} aria-label="Fanta Matrimonio Home">
      <div class="brand-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="9" cy="12" r="5"></circle>
          <circle cx="15" cy="12" r="5"></circle>
        </svg>
      </div>
      <span class="brand-name font-serif gold-gradient-text">Fanta Matrimonio</span>
    </button>

    <!-- Navmenu a destra -->
    <nav class="top-nav">
      {#if appState.hasAccount}
        <!-- Menu per utente autenticato con account -->

        <button
          class="btn btn-secondary nav-action-btn"
          class:active={appState.authView === 'create'}
          onclick={() => appState.setAuthView('create')}
          title="Crea nuovo matrimonio"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          <span class="nav-text">Crea matrimonio</span>
        </button>

        <button
          class="btn btn-secondary nav-action-btn"
          class:active={appState.authView === 'join'}
          onclick={() => appState.setAuthView('join')}
          title="Partecipa a un matrimonio"
        >
          <span class="nav-text">Partecipa</span>
        </button>

        {#if appState.account}
          <div class="user-menu">
            <button class="user-chip" class:open={showUserMenu} onclick={() => showUserMenu = !showUserMenu} aria-expanded={showUserMenu} aria-haspopup="true" title="Apri menu account">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span class="user-name">{appState.account.display_name}</span>
              <svg
                class="dropdown-chevron"
                class:rotated={showUserMenu}
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6"></path>
              </svg>
            </button>
            {#if showUserMenu}
              <div class="user-dropdown">
                <span class="dropdown-email">{appState.account.email}</span>
                <button class="dropdown-item" onclick={() => { showUserMenu = false; appState.openDashboard(); }}>I miei matrimoni</button>
                <button class="dropdown-item dropdown-logout" onclick={() => { showUserMenu = false; handleLogout(); }}>Esci</button>
              </div>
            {/if}
          </div>
        {/if}

        <!-- <button class="btn-logout" onclick={handleLogout} title="Esci dall'account" aria-label="Esci">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
          <span class="logout-label">Esci</span>
        </button> -->
      {:else}
        <!-- Menu pubblico per visitatori non autenticati -->
        <button class="nav-link nav-anchor" onclick={() => handleAnchorClick('come-funziona')}>Come funziona</button>
        <button class="nav-link nav-anchor" onclick={() => handleAnchorClick('giochi')}>I giochi</button>

        <button
          class="nav-link nav-login-link"
          class:active={appState.authView === 'login-secure'}
          onclick={() => appState.setAuthView('login-secure')}
          title="Hai già un account? Accedi con email e password"
          aria-label="Accedi al tuo account"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span class="desktop-only">Accedi</span>
        </button>

        <button
          class="btn btn-secondary nav-action-btn nav-guest-btn"
          class:active={appState.authView === 'join'}
          onclick={() => appState.setAuthView('join')}
          title="Partecipa alla festa con il codice invito"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
          <span class="desktop-only">Entra con codice</span>
          <span class="mobile-only">Codice</span>
        </button>

        <button
          class="btn btn-primary nav-cta"
          class:active={appState.authView === 'create'}
          onclick={() => appState.setAuthView('create')}
          title="Crea il vostro matrimonio"
        >
          <span class="desktop-only">Crea matrimonio</span>
          <span class="mobile-only">Crea</span>
        </button>
      {/if}
    </nav>
  </div>
</header>

<style>
  .site-header {
    position: sticky;
    top: 0;
    z-index: 90;
    background: #ffffff;
    border-bottom: 1px solid rgba(201, 169, 110, 0.22);
    box-shadow: 0 2px 14px rgba(0, 0, 0, 0.04);
  }

  .site-header-inner {
    max-width: 1100px;
    margin: 0 auto;
    padding: 12px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  /* ── Brand a sinistra ─────────────────────────────────────────────────── */
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    padding: 4px 0;
    text-decoration: none;
  }

  .brand-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: rgba(201, 169, 110, 0.12);
    border: 1px solid rgba(201, 169, 110, 0.28);
    color: var(--gold-dark);
    flex-shrink: 0;
    transition: transform 0.2s ease, background 0.2s ease;
  }

  .brand:hover .brand-icon {
    transform: rotate(-10deg) scale(1.05);
    background: rgba(201, 169, 110, 0.2);
  }

  .brand-name {
    font-size: 1.35rem;
    font-weight: 700;
    letter-spacing: 0.01em;
    line-height: 1;
    white-space: nowrap;
  }

  /* ── Navmenu a destra ─────────────────────────────────────────────────── */
  .top-nav {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }

  .nav-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-sans);
    font-weight: 600;
    font-size: 0.92rem;
    color: var(--text-muted);
    padding: 8px 13px;
    border-radius: var(--radius-md);
    transition: color 0.15s, background 0.15s;
    white-space: nowrap;
  }

  .nav-link:hover,
  .nav-link.active {
    color: var(--gold-dark);
    background: rgba(201, 169, 110, 0.12);
  }

  .nav-cta {
    padding: 8px 16px;
    border-radius: 10px;
    font-size: 0.88rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .nav-action-btn {
    padding: 7px 13px;
    border-radius: 10px;
    font-size: 0.85rem;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }

  .nav-guest-btn {
    border-color: rgba(201, 169, 110, 0.4);
    background: #ffffff;
    color: var(--text-main);
    transition: all 0.18s ease;
  }

  .nav-guest-btn:hover,
  .nav-guest-btn.active {
    background: rgba(201, 169, 110, 0.14);
    border-color: var(--gold-primary);
    color: var(--gold-dark);
  }

  .nav-login-link {
    font-size: 0.86rem;
    color: var(--text-muted);
    padding: 7px 10px;
    border-radius: var(--radius-md);
  }

  .nav-login-link:hover,
  .nav-login-link.active {
    color: var(--gold-dark);
    background: rgba(201, 169, 110, 0.1);
  }

  .user-chip {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #f8f6f2;
    border: 1px solid rgba(201, 169, 110, 0.25);
    padding: 6px 12px;
    border-radius: var(--radius-full);
    font-size: 0.84rem;
    font-weight: 600;
    color: var(--text-main);
    cursor: pointer;
    font-family: inherit;
  }

  .user-chip.open,
  .user-chip:hover {
    background: rgba(201, 169, 110, 0.18);
    border-color: rgba(201, 169, 110, 0.5);
  }

  .dropdown-chevron {
    display: block;
    flex: 0 0 14px;
    align-self: center;
    transition: transform 0.18s ease;
    margin-top: auto;
  }

  .dropdown-chevron.rotated {
    transform: rotate(180deg);
  }

  .user-menu {
    position: relative;
  }

  .user-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 100;
    min-width: 190px;
    padding: 8px;
    border: 1px solid rgba(201, 169, 110, 0.25);
    border-radius: 14px;
    background: #fff;
    box-shadow: 0 12px 28px rgba(36, 28, 32, 0.14);
  }

  .dropdown-email {
    display: block;
    padding: 7px 10px 9px;
    color: var(--text-dim);
    font-size: 0.72rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dropdown-item {
    display: block;
    width: 100%;
    padding: 9px 10px;
    border: 0;
    border-radius: 9px;
    background: transparent;
    color: var(--text-main);
    font: inherit;
    font-size: 0.84rem;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
  }

  .dropdown-item:hover {
    background: rgba(201, 169, 110, 0.12);
  }

  .dropdown-logout {
    color: #a83232;
  }

  .user-name {
    max-width: 130px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .btn-logout {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: 1px solid rgba(200, 50, 50, 0.2);
    color: #a83232;
    padding: 7px 11px;
    border-radius: 10px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    white-space: nowrap;
  }

  .btn-logout:hover {
    background: rgba(200, 50, 50, 0.08);
    border-color: rgba(200, 50, 50, 0.4);
  }

  .mobile-only {
    display: none;
  }

  @media (max-width: 899px) {
    .nav-anchor {
      display: none;
    }
  }

  @media (max-width: 640px) {
    .site-header-inner {
      padding: 10px 12px;
      gap: 10px;
    }

    .brand-name {
      font-size: 1.15rem;
    }

    .user-chip {
      display: none;
    }

    .logout-label {
      display: none;
    }

    .nav-text {
      display: none;
    }

    .desktop-only {
      display: none;
    }

    .mobile-only {
      display: inline;
    }

    .nav-link {
      padding: 6px 10px;
      font-size: 0.85rem;
    }

    .nav-cta {
      padding: 6px 12px;
      font-size: 0.82rem;
    }
  }

  @media (max-width: 400px) {
    .brand-name {
      font-size: 1.02rem;
    }

    .brand-icon {
      width: 32px;
      height: 32px;
    }

    .brand-icon svg {
      width: 18px;
      height: 18px;
    }
  }
</style>
