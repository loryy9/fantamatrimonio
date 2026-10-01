<script>
  import { appState } from '../lib/state.svelte.js';

  const s1 = $derived(appState.event?.spouse1_name || '');
  const s2 = $derived(appState.event?.spouse2_name || '');
  const hasCouple = $derived(Boolean(s1 && s2));

  const initials = $derived(
    hasCouple ? [s1.trim()[0], s2.trim()[0]].map(c => c.toUpperCase()) : ['F', 'M']
  );

  // Home already greets with the couple's names, so the bar carries the app name there.
  const title = $derived(
    appState.activeTab === 'home' || !hasCouple ? 'Fanta Matrimonio' : `${s1} & ${s2}`
  );

  function handleLogout() {
    if (confirm('Vuoi davvero uscire?')) {
      appState.logout();
    }
  }
</script>

<header class="navbar">
  <div class="band">
  <div class="bar">
    <span class="monogram font-serif" aria-hidden="true">{initials[0]}<i>&amp;</i>{initials[1]}</span>
    <span class="navbar-title font-serif">{title}</span>

    {#if appState.isAuthenticated}
      <div class="user-stats">
        {#if appState.activeTab !== 'dashboard'}
          {#if appState.isCouple}
            <button class="chip" onclick={() => appState.activeTab = 'manage'} title="Apri console di gestione sposi">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M5 20h14"/></svg>
              <span class="chip-text">Console Sposi</span>
            </button>
          {:else if appState.user}
            <div class="chip static">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
              <span class="points-val">{appState.user?.total_points || 0} pt</span>
            </div>
          {/if}
        {/if}

        {#if appState.hasAccount}
          <button class="icon-btn" onclick={() => appState.openDashboard()} title="I miei matrimoni (Dashboard)" aria-label="Dashboard">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
          </button>
        {:else if !appState.isCouple}
          <button class="icon-btn icon-btn-gold" onclick={() => appState.showUpgradeModal = true} title="Registra il tuo account" aria-label="Registra account">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
          </button>
        {/if}

        <button class="icon-btn" onclick={handleLogout} title="Esci" aria-label="Esci">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
        </button>
      </div>
    {/if}
  </div>
  <span class="edge" aria-hidden="true"></span>
  </div>
</header>

<style>
  /* solid wine band with champagne details: the app's signature */
  .navbar {
    position: sticky;
    top: 0;
    z-index: 100;
    color: #fff;
    /* the shadow lives here: clip-path on .band would cut a box-shadow */
    filter: drop-shadow(0 10px 12px rgba(106, 32, 55, 0.4));
  }

  /* straight edges, with the bottom cut on a diagonal */
  .band {
    --cut: 16px;
    position: relative;
    overflow: hidden;
    padding: var(--safe-top) 0 var(--cut);
    background:
      radial-gradient(60% 140% at 100% 0%, rgba(233, 201, 143, 0.28), transparent 60%),
      radial-gradient(40% 120% at 0% 100%, rgba(201, 98, 127, 0.4), transparent 70%),
      linear-gradient(115deg, #4a1226 0%, var(--wine) 55%, #a33a58 100%);
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

  /* concentric-ring ornament */
  .band::before {
    content: '';
    position: absolute;
    right: -50px;
    top: -70px;
    width: 180px;
    height: 180px;
    border-radius: 50%;
    pointer-events: none;
    border: 1px solid rgba(240, 216, 168, 0.28);
    box-shadow:
      0 0 0 18px rgba(240, 216, 168, 0.05),
      0 0 0 19px rgba(240, 216, 168, 0.18),
      0 0 0 40px rgba(240, 216, 168, 0.04);
  }

  .bar {
    position: relative;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 10px;
    max-width: 1100px;
    height: 68px;
    margin: 0 auto;
    padding: 0 14px 0 14px;
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
    box-shadow: 0 0 0 3px rgba(240, 216, 168, 0.22), 0 6px 14px -4px rgba(0, 0, 0, 0.5);
    font-size: 0.95rem;
    font-weight: 700;
    line-height: 1;
  }

  .monogram i {
    font-size: 0.66rem;
    font-weight: 500;
    opacity: 0.7;
  }

  .navbar-title {
    min-width: 0;
    max-width: 44vw;
    color: #fff;
    font-size: 1.4rem;
    font-weight: 600;
    font-style: italic;
    text-align: center;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .user-stats {
    justify-self: end;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 13px;
    border-radius: 999px;
    border: none;
    color: var(--wine-deep);
    background: linear-gradient(145deg, #fbefcf, #e3c07e);
    box-shadow: 0 6px 14px -4px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.7);
    font-size: 0.82rem;
    font-weight: 800;
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.2s ease;
  }

  .chip.static {
    cursor: default;
  }

  .chip:not(.static):active {
    transform: scale(0.95);
  }

  .points-val {
    font-variant-numeric: tabular-nums;
  }

  .icon-btn {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 50%;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.85);
    transition: background 0.2s, transform 0.2s;
  }

  .icon-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .icon-btn:active {
    transform: scale(0.92);
  }

  .icon-btn:focus-visible,
  .chip:focus-visible {
    outline: 2px solid var(--gold-bright);
    outline-offset: 2px;
  }

  .icon-btn-gold {
    background: rgba(240, 216, 168, 0.2);
    color: var(--gold-bright);
    animation: pulse-glow 2s ease-in-out infinite;
  }

  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(240, 216, 168, 0); }
    50% { box-shadow: 0 0 0 4px rgba(240, 216, 168, 0.3); }
  }

  @media (max-width: 500px) {
    .chip-text {
      display: none;
    }
    .chip:not(.static) {
      padding: 10px;
    }
  }

  @media (min-width: 900px) {
    .band {
      --cut: 26px;
    }

    .band::before {
      right: 6%;
      width: 220px;
      height: 220px;
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
