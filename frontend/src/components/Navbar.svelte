<script>
  import { appState } from '../lib/state.svelte.js';
  import { goto } from '$app/navigation';
  import { dashboardUrl } from '../lib/routes.js';
  import { ICONS } from '../lib/icons.js';
  import SideDrawer from './SideDrawer.svelte';
  import DrawerItem from './DrawerItem.svelte';

  let menuOpen = $state(false);

  const s1 = $derived(appState.event?.spouse1_name || '');
  const s2 = $derived(appState.event?.spouse2_name || '');
  const hasCouple = $derived(Boolean(s1 && s2));

  const initials = $derived(
    hasCouple ? [s1.trim()[0], s2.trim()[0]].map(c => c.toUpperCase()) : ['F', 'M']
  );

  const title = $derived(hasCouple ? `${s1} & ${s2}` : 'Fanta Matrimonio');

  const subtitle = $derived(
    appState.isCouple ? 'Gli sposi' : `${appState.user?.nickname || 'Ospite'} · ${appState.user?.total_points || 0} pt`
  );

  async function handleLogout() {
    if (await appState.confirm('Vuoi davvero uscire?', { title: 'Esci', confirmText: 'Esci' })) {
      appState.logout();
    }
  }
</script>

<header class="navbar game-mode">
  <div class="band">
  <div class="bar">
    <span class="monogram font-serif" aria-hidden="true">{initials[0]}<i>&amp;</i>{initials[1]}</span>
    <span class="navbar-title font-serif">{title}</span>

    <div class="user-stats">
      {#if appState.isAuthenticated && !appState.isCouple}
        <div class="chip">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
          <span class="points-val">{appState.user?.total_points || 0} pt</span>
        </div>
      {/if}

      <button class="icon-btn menu-btn" onclick={() => menuOpen = true} aria-label="Apri menu" aria-expanded={menuOpen}>
        <span class="bars" aria-hidden="true"><i></i><i></i><i></i></span>
      </button>
    </div>
  </div>
  <span class="edge" aria-hidden="true"></span>
  </div>
</header>

<!-- Fuori dall'header: il suo filter farebbe da riferimento per il position: fixed del menu -->
<SideDrawer bind:open={menuOpen} {title} {subtitle}>
  <DrawerItem label="Come si gioca" icon={ICONS.book} onclick={() => appState.showInstructionsModal = true} />
  {#if appState.hasAccount}
    <DrawerItem
      label={appState.isCouple ? 'Dettagli matrimonio' : 'I miei matrimoni'}
      icon={ICONS.dashboard}
      onclick={() => goto(dashboardUrl(appState.isCouple ? appState.event?.id : null))}
    />
  {/if}
  <DrawerItem label="Esci" icon={ICONS.logout} variant="danger" onclick={handleLogout} />
</SideDrawer>

<style>
  /* solid wine band with champagne details: the app's signature */
  .navbar {
    position: sticky;
    top: 0;
    z-index: 250;
    color: #fff;
    /* the shadow lives here: clip-path on .band would cut a box-shadow */
    filter: drop-shadow(0 4px 8px rgba(106, 32, 55, 0.28));
  }

  /* straight edges, with the bottom cut on a diagonal */
  .band {
    --cut: 6px;
    position: relative;
    overflow: hidden;
    padding: 0 0 var(--cut);
    /* Tinta unita, identica alla safe-area in alto: iOS 26 Safari tinge la barra di stato
       con questo background-color, gli altri browser col theme-color impostato dal layout. */
    background: var(--wine);
    clip-path: polygon(0 0, 100% 0, 100% calc(100% - var(--cut)), 0 100%);
  }

  /* champagne line that follows the cut */
  .edge {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: var(--cut);
    pointer-events: none;
    background: linear-gradient(to top right, transparent calc(50% - 1px), #f0d8a8 50%, transparent calc(50% + 1px));
  }

  .bar {
    position: relative;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    max-width: 1100px;
    height: 56px;
    margin: 0 auto;
    padding: 0 14px;
  }

  .monogram {
    justify-self: start;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 1px;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    color: var(--wine-deep);
    background: linear-gradient(145deg, #fbefcf, #d9b46f);
    box-shadow: 0 0 0 2px rgba(240, 216, 168, 0.22), 0 3px 8px -2px rgba(0, 0, 0, 0.4);
    font-size: 0.95rem;
    font-weight: 700;
    line-height: 1;
  }

  .monogram i {
    font-size: 0.76rem;
    font-weight: 500;
    opacity: 0.7;
  }

  .navbar-title {
    min-width: 0;
    color: #fff;
    font-size: clamp(1.08rem, 4.5vw, 1.38rem);
    font-weight: 600;
    font-style: italic;
    text-align: left;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.22);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .user-stats {
    justify-self: end;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    border-radius: 999px;
    border: none;
    color: var(--wine-deep);
    background: linear-gradient(145deg, #fbefcf, #e3c07e);
    box-shadow: 0 3px 8px -2px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.7);
    min-height: 36px;
    font-size: 0.8rem;
    font-weight: 800;
    white-space: nowrap;
  }

  .points-val {
    font-variant-numeric: tabular-nums;
  }

  .icon-btn {
    position: relative;
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 50%;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.95);
    transition: background 0.2s, transform 0.2s;
  }

  /* Accessible touch target expansion to 48x48px on mobile */
  .icon-btn::after {
    content: '';
    position: absolute;
    inset: -5px;
    border-radius: 50%;
  }

  .icon-btn:hover {
    background: rgba(255, 255, 255, 0.22);
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
    background: currentColor;
  }

  .bars i:nth-child(1) { top: 0; }
  .bars i:nth-child(2) { top: 6px; }
  .bars i:nth-child(3) { top: 12px; }

  .icon-btn:active {
    transform: scale(0.92);
  }

  .icon-btn:focus-visible {
    outline: 2px solid var(--gold-bright);
    outline-offset: 2px;
  }

  @media (min-width: 900px) {
    .band {
      --cut: 26px;
    }

    .bar {
      height: 76px;
      padding: 0 40px;
    }

    .monogram {
      width: 48px;
      height: 48px;
      font-size: 1.05rem;
    }

    .navbar-title {
      font-size: 1.7rem;
    }
  }

  @media (min-width: 1100px) {
    .bar {
      padding: 0;
    }
  }
</style>
