<script>
  import { appState } from '../lib/state.svelte.js';
  import { formatName } from '../lib/formatters.js';

  function handleLogout() {
    if (confirm('Vuoi davvero uscire?')) {
      appState.logout();
    }
  }
</script>

<header class="navbar">
  <div class="navbar-brand">
    <span class="brand-icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="9" cy="12" r="5"></circle>
        <circle cx="15" cy="12" r="5"></circle>
      </svg>
    </span>
    <span class="brand-title font-serif gold-gradient-text">Fanta Matrimonio</span>
  </div>

  {#if appState.isAuthenticated}
    <div class="user-stats">
      <div class="points-pill">
        <span class="points-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
        </span>
        <span class="points-val">{appState.user?.total_points || 0}</span>
        <span class="points-unit">pt</span>
      </div>

      <button class="avatar-btn" onclick={handleLogout} title="Disconnetti ({formatName(appState.user?.first_name)})">
        <span class="avatar-text">
          {formatName(appState.user?.first_name)?.charAt(0)?.toUpperCase() || 'U'}{formatName(appState.user?.last_name)?.charAt(0)?.toUpperCase() || 'U'}
        </span>
      </button>
    </div>
  {/if}
</header>

<style>
  .navbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: calc(12px + var(--safe-top)) 18px 12px 18px;
    background: #ffffff;
    border-bottom: 1px solid var(--border-subtle);
    position: sticky;
    top: 0;
    z-index: 100;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
  }

  .navbar-brand {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .brand-icon {
    display: flex;
    align-items: center;
    color: var(--gold-primary);
    filter: drop-shadow(0 1px 3px rgba(201, 169, 110, 0.3));
  }

  .brand-title {
    font-size: 1.15rem;
    font-weight: 700;
    letter-spacing: 0.05em;
  }

  .user-stats {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .points-pill {
    display: flex;
    align-items: center;
    gap: 5px;
    background: linear-gradient(135deg, rgba(201, 169, 110, 0.1) 0%, rgba(201, 169, 110, 0.18) 100%);
    border: 1px solid rgba(201, 169, 110, 0.3);
    padding: 5px 12px;
    border-radius: var(--radius-full);
    box-shadow: 0 1px 4px rgba(201, 169, 110, 0.1);
  }

  .points-icon {
    display: flex;
    align-items: center;
    color: var(--gold-primary);
  }

  .points-val {
    font-weight: 800;
    font-size: 0.95rem;
    color: var(--gold-dark);
  }

  .points-unit {
    font-size: 0.72rem;
    color: var(--text-muted);
    font-weight: 600;
  }

  .avatar-btn {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--rose-primary) 0%, var(--rose-light) 100%);
    border: 1.5px solid rgba(255, 255, 255, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(212, 132, 154, 0.25);
    transition: transform 0.2s ease;
  }

  .avatar-btn:active {
    transform: scale(0.92);
  }

  .avatar-text {
    font-weight: 800;
    font-size: 0.85rem;
    color: #ffffff;
  }
</style>
