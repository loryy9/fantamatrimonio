<script>
  import { appState } from '../lib/state.svelte.js';

  // On Home the bar floats over the dark hero (app: GameAppBar light: true).
  const light = $derived(appState.activeTab === 'home');

  const title = $derived(
    appState.event?.spouse1_name && appState.event?.spouse2_name
      ? `${appState.event.spouse1_name} & ${appState.event.spouse2_name}`
      : 'Fanta Matrimonio'
  );

  function handleLogout() {
    if (confirm('Vuoi davvero uscire?')) {
      appState.logout();
    }
  }
</script>

<header class="navbar" class:light>
  <span class="navbar-title">{title}</span>

  {#if appState.isAuthenticated}
    <div class="user-stats">
      {#if appState.isCouple}
        <button
          class="couple-badge-btn"
          class:glass-dark={light}
          onclick={() => appState.activeTab = 'manage'}
          title="Apri console di gestione sposi"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="crown"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M5 20h14"/></svg>
          <span class="couple-badge-text">Console Sposi</span>
        </button>
      {/if}

      {#if !appState.isCouple}
        <div class="points-pill" class:glass-dark={light}>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="points-icon"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
          <span class="points-val">{appState.user?.total_points || 0} pt</span>
        </div>
      {/if}

      <button class="icon-btn" onclick={handleLogout} title="Esci" aria-label="Esci">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
      </button>
    </div>
  {/if}
</header>

<style>
  .navbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: calc(10px + var(--safe-top)) 12px 8px 20px;
    position: sticky;
    top: 0;
    z-index: 100;
    color: var(--text-main);
    background: rgba(250, 248, 245, 0.85);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }

  .navbar.light {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    color: #fff;
    background: transparent;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }

  .navbar-title {
    flex: 1;
    min-width: 0;
    font-weight: 600;
    font-size: 0.95rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .user-stats {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .couple-badge-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 14px;
    background: rgba(201, 169, 110, 0.16);
    border: 1px solid rgba(201, 169, 110, 0.35);
    color: var(--gold-dark);
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  }

  .couple-badge-btn:hover {
    background: var(--gold-primary);
    color: #fff;
    border-color: var(--gold-primary);
  }

  .couple-badge-btn.glass-dark {
    background: rgba(201, 169, 110, 0.25);
    color: var(--gold-bright);
    border-color: rgba(201, 169, 110, 0.45);
  }

  @media (max-width: 500px) {
    .couple-badge-text {
      display: none;
    }
    .couple-badge-btn {
      padding: 6px 9px;
    }
  }

  .points-pill {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 7px 12px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.6);
    box-shadow: 0 6px 14px rgba(138, 109, 59, 0.1);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .points-pill.glass-dark {
    box-shadow: none;
    backdrop-filter: blur(12px);
  }

  .points-icon {
    color: var(--gold-primary);
  }

  .points-val {
    font-weight: 700;
    font-size: 0.82rem;
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: none;
    background: transparent;
    border-radius: 50%;
    cursor: pointer;
    color: var(--text-muted);
    transition: background 0.2s, transform 0.2s;
  }

  .light .icon-btn {
    color: rgba(255, 255, 255, 0.75);
  }

  .icon-btn:hover {
    background: rgba(201, 169, 110, 0.15);
  }

  .icon-btn:active {
    transform: scale(0.92);
  }

  @media (min-width: 1100px) {
    .navbar {
      padding: 14px 40px 12px;
      /* Frosted glass leggero — dà contesto visivo senza pesare */
      background: rgba(250, 248, 245, 0.85);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-bottom: 1px solid rgba(201, 169, 110, 0.13);
    }

    .navbar.light {
      left: 0;
      /* Sulla home il hero è scuro: teniamo trasparente */
      background: transparent;
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
      border-bottom: none;
    }

    .navbar-title {
      font-size: 1rem;
    }
  }

</style>
