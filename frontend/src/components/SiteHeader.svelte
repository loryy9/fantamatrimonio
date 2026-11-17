<script>
  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { appState } from '../lib/state.svelte.js';
  import { ROUTES, loginUrl } from '../lib/routes.js';
  import { ICONS } from '../lib/icons.js';
  import SideDrawer from './SideDrawer.svelte';
  import DrawerItem from './DrawerItem.svelte';

  let showUserMenu = $state(false);
  let menuOpen = $state(false);
  const path = $derived(page.url.pathname);

  onMount(() => {
    const closeUserMenu = (event) => {
      if (!event.target.closest('.user-menu')) showUserMenu = false;
    };
    document.addEventListener('click', closeUserMenu);
    return () => document.removeEventListener('click', closeUserMenu);
  });

  async function scrollToSection(id) {
    if (path !== ROUTES.home) await goto(ROUTES.home);
    // aspetta che il menu sia chiuso: finché è aperto la pagina sotto è bloccata e non scorre
    await tick();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }


  // Voci di navigazione, le stesse nella barra (desktop) e nel menu laterale (mobile).
  // "Partecipa" c'è per tutti; chi non ha un account vede anche le sezioni della home e "Accedi".
  const links = $derived([
    ...(appState.hasAccount ? [] : [
      { label: 'Come funziona', icon: ICONS.help, onclick: () => scrollToSection('come-funziona'), anchor: true },
      { label: 'I giochi', icon: ICONS.gamepad, onclick: () => scrollToSection('giochi'), anchor: true }
    ]),
    { label: 'Partecipa', icon: ICONS.ticket, onclick: () => goto(ROUTES.join), active: path === ROUTES.join },
    ...(appState.hasAccount ? [] : [
      { label: 'Accedi', icon: ICONS.login, onclick: () => goto(loginUrl(page.url.searchParams.get('code'))), active: path === ROUTES.login }
    ])
  ]);

  // Azione principale, uguale per tutti; nascosta mentre si sta già creando un matrimonio
  const showCreate = $derived(path !== ROUTES.create);
</script>

<header class="site-header">
  <div class="site-header-inner">
    <button class="brand" onclick={() => goto(appState.hasAccount ? ROUTES.dashboard : ROUTES.home)} aria-label="Fanta Matrimonio Home">
      <div class="brand-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="9" cy="12" r="5"></circle>
          <circle cx="15" cy="12" r="5"></circle>
        </svg>
      </div>
      <span class="brand-name font-serif gold-gradient-text">Fanta Matrimonio</span>
    </button>

    <!-- Desktop: voci in fila -->
    <nav class="top-nav">
      {#each links as link (link.label)}
        <button
          class={link.anchor ? 'nav-link nav-anchor' : 'btn btn-secondary nav-action-btn'}
          class:nav-guest-btn={!appState.hasAccount && !link.anchor}
          class:active={link.active}
          onclick={link.onclick}
        >{link.label}</button>
      {/each}

      {#if showCreate}
        <button class="btn btn-primary nav-cta" onclick={() => goto(ROUTES.create)}>Crea matrimonio</button>
      {/if}

      {#if appState.account}
        <div class="user-menu">
          <button class="btn btn-secondary nav-action-btn user-chip" class:open={showUserMenu} onclick={() => showUserMenu = !showUserMenu} aria-expanded={showUserMenu} aria-haspopup="true" title="Apri menu account">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{@html ICONS.user}</svg>
            <span class="user-name">{appState.account.display_name}</span>
            <svg class="dropdown-chevron" class:rotated={showUserMenu} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>
          </button>
          {#if showUserMenu}
            <div class="user-dropdown">
              <span class="dropdown-email">{appState.account.email}</span>
              <button class="dropdown-item" onclick={() => { showUserMenu = false; goto(ROUTES.dashboard); }}>I miei matrimoni</button>
              <button class="dropdown-item dropdown-logout" onclick={() => { showUserMenu = false; appState.confirmLogout(); }}>Logout</button>
            </div>
          {/if}
        </div>
      {/if}
    </nav>

    <!-- Mobile: tutto nel menu laterale -->
    <button class="menu-toggle" onclick={() => menuOpen = true} aria-label="Apri menu" aria-expanded={menuOpen}>
      <span class="bars" aria-hidden="true"><i></i><i></i><i></i></span>
    </button>
  </div>
</header>

<SideDrawer bind:open={menuOpen} title="Fanta Matrimonio" subtitle={appState.account?.display_name || 'Menu'}>
  {#each links as link (link.label)}
    <DrawerItem label={link.label} icon={link.icon} active={link.active} onclick={link.onclick} />
  {/each}
  {#if appState.account}
    <DrawerItem label="I miei matrimoni" icon={ICONS.dashboard} active={path === ROUTES.dashboard} onclick={() => goto(ROUTES.dashboard)} />
  {/if}
  {#if showCreate}
    <DrawerItem label="Crea matrimonio" icon={ICONS.plus} variant="cta" onclick={() => goto(ROUTES.create)} />
  {/if}
  {#if appState.account}
    <DrawerItem label="Logout" icon={ICONS.logout} variant="danger" onclick={() => appState.confirmLogout()} />
  {/if}
</SideDrawer>

<style>
  .site-header {
    position: sticky;
    top: 0;
    z-index: 90;
    background: #faf7f2;
    border-bottom: 1px solid rgba(201, 169, 110, 0.22);
    box-shadow: 0 2px 14px rgba(0, 0, 0, 0.04);
  }

  .site-header-inner {
    max-width: 1100px;
    margin: 0 auto;
    padding: 5px 16px;
    min-height: 46px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  /* ── Brand a sinistra ─────────────────────────────────────────────────── */
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    padding: 2px 0;
    text-decoration: none;
  }

  .brand-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
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
    font-size: 1.18rem;
    font-weight: 700;
    letter-spacing: 0.01em;
    line-height: 1;
    white-space: nowrap;
  }

  /* ── Navmenu a destra (desktop) ───────────────────────────────────────── */
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

  .nav-link:hover {
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

  /* menu account: stesso pulsante delle voci accanto, con la freccia della tendina */
  .user-chip {
    gap: 6px;
  }

  .user-chip.open {
    background: var(--bg-surface-elevated);
    border-color: rgba(140, 47, 75, 0.45);
  }

  .dropdown-chevron {
    display: block;
    flex: 0 0 14px;
    transition: transform 0.18s ease;
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

  @media (min-width: 641px) and (max-width: 899px) {
    .nav-anchor {
      display: none;
    }
  }

  /* ── Pulsante menu (mobile) ───────────────────────────────────────────── */
  .menu-toggle {
    display: none;
    flex-shrink: 0;
    width: var(--control-md);
    height: var(--control-md);
    margin-left: auto;
    border: 1px solid rgba(201, 169, 110, 0.35);
    border-radius: 12px;
    background: #fff;
    cursor: pointer;
    place-items: center;
  }

  .menu-toggle:focus-visible {
    outline: 2px solid var(--wine);
    outline-offset: 2px;
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
  }

  .bars i:nth-child(1) { top: 0; }
  .bars i:nth-child(2) { top: 6px; }
  .bars i:nth-child(3) { top: 12px; }

  @media (max-width: 640px) {
    .site-header-inner {
      padding: 5px 12px;
      min-height: 42px;
      gap: 8px;
    }

    .brand-name {
      font-size: 1.05rem;
    }

    .top-nav {
      display: none;
    }

    .menu-toggle {
      display: grid;
    }
  }

  @media (max-width: 400px) {
    .brand-name {
      font-size: 1.02rem;
    }
  }
</style>
