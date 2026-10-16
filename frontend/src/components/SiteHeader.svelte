<script>
  import { onMount } from 'svelte';
  import { appState } from '../lib/state.svelte.js';

  let { scrollToId } = $props();
  let showUserMenu = $state(false);
  let menuOpen = $state(false);

  onMount(() => {
    const closeMenu = (event) => {
      if (!event.target.closest('.user-menu')) showUserMenu = false;
      if (!event.target.closest('.site-header')) menuOpen = false;
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

<header class="site-header" class:has-account={appState.hasAccount}>
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
    <button
      class="menu-backdrop"
      class:open={menuOpen}
      onclick={() => menuOpen = false}
      aria-label="Chiudi menu"
      tabindex="-1"
    ></button>

    <button
      class="menu-toggle"
      class:open={menuOpen}
      onclick={() => menuOpen = !menuOpen}
      aria-label={menuOpen ? 'Chiudi menu' : 'Apri menu'}
      aria-expanded={menuOpen}
      aria-controls="top-nav"
    >
      <span class="bars" aria-hidden="true"><i></i><i></i><i></i></span>
    </button>

    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
    <nav id="top-nav" class="top-nav" class:open={menuOpen} onclick={(e) => { if (!e.target.closest('.user-chip')) menuOpen = false; }}>
      <div class="drawer-head" aria-hidden="true">
        <span class="drawer-logo"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="5"></circle><circle cx="15" cy="12" r="5"></circle></svg></span>
        <span class="drawer-title font-serif">Fanta Matrimonio</span>
        <span class="drawer-sub">Menu</span>
      </div>
      {#if appState.hasAccount}
        <!-- Menu per utente autenticato con account -->

        <button
          class="btn btn-secondary nav-action-btn"
          class:active={appState.authView === 'create'}
          onclick={() => appState.setAuthView('create')}
          title="Crea nuovo matrimonio"
          aria-label="Crea nuovo matrimonio"
        >
          <svg class="row-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
          <span class="nav-text">Crea matrimonio</span>
          <svg class="row-chev" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
        </button>

        <button
          class="btn btn-secondary nav-action-btn"
          class:active={appState.authView === 'join'}
          onclick={() => appState.setAuthView('join')}
          title="Partecipa a un matrimonio"
        >
          <svg class="row-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
          <span class="nav-text">Partecipa</span>
          <svg class="row-chev" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
        </button>

        {#if appState.account}
          <div class="user-menu">
            <button class="user-chip" class:open={showUserMenu} onclick={() => showUserMenu = !showUserMenu} aria-expanded={showUserMenu} aria-haspopup="true" title="Apri menu account">
            <svg class="row-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
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
        <button class="nav-link nav-anchor" onclick={() => handleAnchorClick('come-funziona')}><svg class="row-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg><span>Come funziona</span><svg class="row-chev" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>
        <button class="nav-link nav-anchor" onclick={() => handleAnchorClick('giochi')}><svg class="row-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 11h4M8 9v4"/><path d="M15 12h.01M18 10h.01"/><rect width="20" height="12" x="2" y="6" rx="4"/></svg><span>I giochi</span><svg class="row-chev" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>

        <button
          class="nav-link nav-login-link"
          class:active={appState.authView === 'login-secure'}
          onclick={() => appState.setAuthView('login-secure')}
          title="Hai già un account? Accedi con email e password"
          aria-label="Accedi al tuo account"
        >
          <svg class="row-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span>Accedi</span>
          <svg class="row-chev" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
        </button>

        <button
          class="btn btn-secondary nav-action-btn nav-guest-btn"
          class:active={appState.authView === 'join'}
          onclick={() => appState.setAuthView('join')}
          title="Partecipa alla festa con il codice invito"
        >
          <svg class="row-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
          <span>Entra con codice</span>
          <svg class="row-chev" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
        </button>

        <button
          class="btn btn-primary nav-cta"
          class:active={appState.authView === 'create'}
          onclick={() => appState.setAuthView('create')}
          title="Crea il vostro matrimonio"
        >
          <span class="desktop-only">Crea matrimonio</span>
          <span class="mobile-only">Crea il tuo matrimonio</span>
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

  @media (min-width: 641px) and (max-width: 899px) {
    .nav-anchor {
      display: none;
    }
  }

  .menu-backdrop,
  .drawer-head,
  .row-icon,
  .row-chev {
    display: none;
  }

  .menu-toggle {
    display: none;
    flex-shrink: 0;
    width: 42px;
    height: 42px;
    margin-left: auto;
    border: 1px solid rgba(201, 169, 110, 0.35);
    border-radius: 12px;
    background: #fff;
    cursor: pointer;
    place-items: center;
  }

  .bars {
    position: relative;
    width: 18px;
    height: 14px;
  }

  .bars i {
    position: absolute;
    left: 0;
    width: 100%;
    height: 2px;
    border-radius: 2px;
    background: var(--gold-dark);
    transition: transform 0.2s ease, opacity 0.2s ease, top 0.2s ease;
  }

  .bars i:nth-child(1) { top: 0; }
  .bars i:nth-child(2) { top: 6px; }
  .bars i:nth-child(3) { top: 12px; }

  .menu-toggle.open .bars i:nth-child(1) { top: 6px; transform: rotate(45deg); }
  .menu-toggle.open .bars i:nth-child(2) { opacity: 0; }
  .menu-toggle.open .bars i:nth-child(3) { top: 6px; transform: rotate(-45deg); }

  @media (max-width: 640px) {
    .site-header-inner {
      padding: 10px 14px;
      gap: 10px;
    }

    .menu-toggle {
      display: grid;
    }

    /* the actions fold into a drawer sliding in from the right */
    .top-nav {
      position: fixed;
      top: 0;
      right: 0;
      height: 100vh;
      height: 100dvh;
      z-index: 120;
      width: min(88vw, 380px);
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
      margin: 0;
      padding: 0 16px calc(24px + env(safe-area-inset-bottom));
      overflow-y: auto;
      color: #fff;
      background:
        radial-gradient(90% 38% at 100% 0%, rgba(233, 201, 143, 0.28), transparent 70%),
        radial-gradient(80% 40% at 0% 100%, rgba(201, 98, 127, 0.4), transparent 70%),
        linear-gradient(170deg, #4a1226 0%, var(--wine) 60%, #8d2f4b 100%);
      border-radius: 28px 0 0 28px;
      box-shadow: -24px 0 60px rgba(36, 18, 26, 0.28);
      transform: translateX(105%);
      visibility: hidden;
      transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), visibility 0s linear 0.4s;
    }

    .top-nav.open {
      transform: translateX(0);
      visibility: visible;
      transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), visibility 0s;
    }

    /* the toggle stays above the drawer and doubles as its close button */
    .menu-toggle {
      position: relative;
      z-index: 130;
    }

    .menu-backdrop {
      display: block;
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      height: 100dvh;
      z-index: 110;
      border: 0;
      padding: 0;
      background: rgba(20, 6, 12, 0.6);
      backdrop-filter: blur(4px);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.35s ease;
    }

    .menu-backdrop.open {
      opacity: 1;
      pointer-events: auto;
    }

    /* identity block at the top of the drawer */
    .drawer-head {
      display: grid;
      grid-template-columns: auto 1fr;
      column-gap: 14px;
      align-items: center;
      padding: 22px 56px 20px 4px;
      margin-bottom: 8px;
      border-bottom: 1px solid rgba(240, 216, 168, 0.28);
    }

    .drawer-logo {
      grid-row: span 2;
      display: grid;
      place-items: center;
      width: 50px;
      height: 50px;
      border-radius: 16px;
      color: var(--wine-deep);
      background: linear-gradient(145deg, #fbefcf, #d9b46f);
      box-shadow: 0 0 0 4px rgba(240, 216, 168, 0.18), 0 10px 20px -8px rgba(0, 0, 0, 0.5);
    }

    .drawer-title {
      font-size: 1.3rem;
      font-weight: 700;
      line-height: 1.1;
      color: #fff;
    }

    .drawer-sub {
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #f0d8a8;
    }

    /* rows: icon tile, label, chevron */
    .top-nav :global(.btn),
    .nav-link,
    .user-chip {
      width: 100%;
      min-height: 64px;
      justify-content: flex-start;
      gap: 14px;
      padding: 0 14px;
      border: 1px solid rgba(240, 216, 168, 0.2);
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.08);
      color: #fff;
      font-size: 1.05rem;
      font-weight: 700;
      box-shadow: none;
      backdrop-filter: blur(6px);
    }

    .nav-link.active,
    .top-nav :global(.btn.active:not(.nav-cta)),
    .user-chip.open {
      background: rgba(240, 216, 168, 0.18);
      border-color: rgba(240, 216, 168, 0.5);
      color: #fff;
    }

    .nav-link:active,
    .top-nav :global(.btn:active),
    .user-chip:active {
      transform: scale(0.98);
    }

    .row-icon {
      flex: 0 0 auto;
      box-sizing: content-box;
      width: 20px;
      height: 20px;
      padding: 10px;
      border-radius: 13px;
      color: var(--wine-deep);
      background: linear-gradient(145deg, #fbefcf, #e3c07e);
    }

    .row-chev {
      display: block;
      margin-left: auto;
      color: rgba(240, 216, 168, 0.7);
    }

    .nav-anchor {
      display: inline-flex;
    }

    /* primary action pinned to the bottom */
    .nav-cta {
      justify-content: center;
      margin-top: auto;
      min-height: 62px;
      border: 0;
      color: var(--wine-deep);
      background: linear-gradient(145deg, #fbefcf, #e3c07e);
      font-size: 1.1rem;
      box-shadow: 0 14px 28px -10px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.7);
    }

    .nav-cta.active {
      color: var(--wine-deep);
    }

    /* account: the profile row sits at the bottom */
    .user-menu {
      width: 100%;
      margin-top: auto;
    }

    .user-name {
      max-width: none;
      display: inline;
    }

    .user-chip .dropdown-chevron {
      display: block;
      margin-left: auto;
    }

    .user-dropdown {
      position: static;
      margin-top: 8px;
      padding: 6px;
      border-radius: 16px;
      border-color: rgba(240, 216, 168, 0.2);
      background: rgba(0, 0, 0, 0.18);
      box-shadow: none;
    }

    .dropdown-email {
      color: rgba(255, 255, 255, 0.6);
    }

    .dropdown-item {
      color: #fff;
      padding: 15px 14px;
      font-size: 1.02rem;
    }

    .dropdown-item:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .dropdown-logout {
      color: #ffb4b4;
    }

    .dropdown-email {
      font-size: 0.82rem;
    }

    /* items stagger in after the drawer */
    .top-nav > :global(*) {
      opacity: 0;
      transform: translateX(18px);
      transition: opacity 0.3s ease, transform 0.4s ease;
    }

    .top-nav.open > :global(*) {
      opacity: 1;
      transform: none;
    }

    .top-nav.open > :global(:nth-child(2)) { transition-delay: 0.08s; }
    .top-nav.open > :global(:nth-child(3)) { transition-delay: 0.13s; }
    .top-nav.open > :global(:nth-child(4)) { transition-delay: 0.18s; }
    .top-nav.open > :global(:nth-child(5)) { transition-delay: 0.23s; }
    .top-nav.open > :global(:nth-child(6)) { transition-delay: 0.28s; }
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
