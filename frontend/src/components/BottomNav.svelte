<script>
  import { appState } from '../lib/state.svelte.js';

  const navItems = $derived([
    { id: 'home', label: 'Home' },
    { id: 'gallery', label: 'Foto' },
    { id: 'hunt', label: 'Caccia' },
    { id: 'quiz', label: 'Giochi' },
    { id: 'leaderboard', label: 'Classifica' },
    ...(appState.isCouple ? [{ id: 'manage', label: 'Sposi' }] : [])
  ]);
</script>

<nav class="bottom-nav">
  <div class="nav-container">
    {#each navItems as item (item.id)}
      <button
        class="nav-btn {appState.activeTab === item.id ? 'active' : ''}"
        onclick={() => appState.setGameTab(item.id)}
        aria-label={item.label}
      >
        <span class="nav-icon">
          {#if item.id === 'home'}
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          {:else if item.id === 'gallery'}
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
          {:else if item.id === 'hunt'}
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/></svg>
          {:else if item.id === 'quiz'}
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
          {:else if item.id === 'leaderboard'}
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
          {:else if item.id === 'manage'}
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M5 20h14"/></svg>
          {/if}
        </span>
        <span class="nav-label">{item.label}</span>
      </button>
    {/each}
  </div>
</nav>

<style>
  /* Floating frosted-glass dock (app: GlassNavBar) */
  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 100;
    display: flex;
    justify-content: center;
    padding: 0 12px calc(12px + var(--safe-bottom));
    pointer-events: none;
  }

  .nav-container {
    pointer-events: auto;
    width: 100%;
    max-width: 480px;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 7px;
    border-radius: 26px;
    background: rgba(255, 253, 251, 0.98);
    border: 1px solid rgba(106, 32, 55, 0.22);
    box-shadow:
      0 16px 32px rgba(36, 28, 32, 0.22),
      0 3px 10px rgba(106, 32, 55, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(22px);
    -webkit-backdrop-filter: blur(22px);
  }

  .nav-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1 1 0;
    min-height: 48px;
    padding: 9px 4px;
    border: none;
    border-radius: 18px;
    background: transparent;
    color: #594d53;
    cursor: pointer;
    overflow: hidden;
    transition: flex-grow 0.3s cubic-bezier(0.16, 1, 0.3, 1), padding 0.3s cubic-bezier(0.16, 1, 0.3, 1), background 0.25s ease, color 0.25s ease, box-shadow 0.25s ease;
  }

  .nav-btn:focus-visible {
    outline: 2px solid var(--wine);
    outline-offset: -2px;
  }

  .nav-btn:active {
    transform: scale(0.95);
  }

  .nav-icon {
    display: flex;
    flex-shrink: 0;
    color: currentColor;
  }

  .nav-label {
    max-width: 0;
    opacity: 0;
    white-space: nowrap;
    font-size: 0.76rem;
    font-weight: 700;
    transition: max-width 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease, margin 0.3s ease;
  }

  .nav-btn.active {
    flex-grow: 1.8;
    padding: 9px 10px;
    color: #fff;
    background: var(--grad-gold-rose);
    box-shadow: 0 6px 14px -3px rgba(140, 47, 75, 0.4);
  }

  .nav-btn.active .nav-label {
    max-width: 68px;
    opacity: 1;
    margin-left: 5px;
  }

  /* ── 900px: dock leggermente espansa ── */
  @media (min-width: 900px) {
    .bottom-nav {
      bottom: 18px;
    }

    .nav-container {
      max-width: 720px;
      padding: 10px;
    }

    .nav-btn {
      padding: 12px 10px;
    }

    .nav-btn.active {
      padding: 12px 20px;
    }
  }

  /* ── 1100px: dock raffinata ivory-gold, centrata, non nera ── */
  @media (min-width: 1100px) {
    .bottom-nav {
      bottom: 26px;
      padding: 0 40px;
    }

    .nav-container {
      max-width: 680px;
      padding: 10px 12px;
      border-radius: 22px;
      /* Frosted ivory-gold: coerente col tema chiaro della pagina */
      background: rgba(255, 253, 251, 0.92);
      border: 1px solid rgba(201, 169, 110, 0.26);
      box-shadow:
        0 14px 36px rgba(138, 109, 59, 0.13),
        0 3px 8px rgba(0, 0, 0, 0.04),
        inset 0 1px 0 rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(28px);
      -webkit-backdrop-filter: blur(28px);
    }

    .nav-btn {
      padding: 11px 10px;
      border-radius: 16px;
    }

    .nav-btn.active {
      padding: 11px 24px;
    }

    .nav-btn:not(.active):hover {
      background: rgba(201, 169, 110, 0.08);
      color: var(--text-main);
    }
  }
</style>
