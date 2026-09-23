<script>
  import { appState } from '../lib/state.svelte.js';

  const navItems = [
    { id: 'home', label: 'Home' },
    { id: 'gallery', label: 'Foto' },
    { id: 'hunt', label: 'Caccia' },
    { id: 'quiz', label: 'Giochi' },
    { id: 'leaderboard', label: 'Classifica' },
  ];
</script>

<nav class="bottom-nav">
  <div class="nav-container">
    {#each navItems as item (item.id)}
      <button
        class="nav-btn {appState.activeTab === item.id ? 'active' : ''}"
        onclick={() => appState.activeTab = item.id}
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
          {/if}
        </span>
        <span class="nav-label">{item.label}</span>
        {#if appState.activeTab === item.id}
          <div class="active-indicator"></div>
        {/if}
      </button>
    {/each}
  </div>
</nav>

<style>
  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 100;
    display: flex;
    justify-content: center;
    background: #ffffff;
    border-top: 1px solid var(--border-subtle);
    box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.04);
  }

  .nav-container {
    width: 100%;
    max-width: 540px;
    background: #ffffff;
    padding: 8px 12px calc(8px + var(--safe-bottom)) 12px;
    display: flex;
    justify-content: space-around;
    align-items: center;
  }

  .nav-btn {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    background: transparent;
    border: none;
    color: var(--text-dim);
    padding: 6px 12px;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    flex: 1;
    max-width: 80px;
  }

  .nav-btn:active {
    transform: scale(0.92);
  }

  .nav-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s ease;
  }

  .nav-label {
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    transition: color 0.2s ease;
  }

  .nav-btn.active {
    color: var(--gold-dark);
  }

  .nav-btn.active .nav-icon {
    transform: translateY(-2px) scale(1.15);
    color: var(--gold-primary);
  }

  .nav-btn.active .nav-label {
    color: var(--gold-dark);
    font-weight: 700;
  }

  .active-indicator {
    position: absolute;
    bottom: -4px;
    width: 20px;
    height: 3px;
    background: linear-gradient(90deg, var(--gold-primary), var(--gold-light));
    border-radius: var(--radius-full);
    box-shadow: 0 0 8px rgba(201, 169, 110, 0.4);
  }
</style>
