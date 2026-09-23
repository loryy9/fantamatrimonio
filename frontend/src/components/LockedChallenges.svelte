<script>
  import { eventTimer } from '../lib/timer.svelte.js';
  import { appState } from '../lib/state.svelte.js';

  let { title = 'Sfide Non Ancora Iniziate', subtitle = 'Questa sezione si sbloccherà automaticamente all\'inizio dei giochi.' } = $props();
</script>

<div class="locked-container glass-card glass-card-gold">
  <div class="locked-glow"></div>
  
  <div class="lock-icon-container">
    <div class="lock-pulse"></div>
    <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="lock-svg">
      <rect width="18" height="11" x="3" y="11" rx="2.5" ry="2.5"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      <circle cx="12" cy="16.5" r="1" fill="currentColor"/>
    </svg>
  </div>

  <h2 class="locked-title font-serif">{title}</h2>
  <p class="locked-subtitle">{subtitle}</p>

  {#if eventTimer.startTimeFormatted}
    <div class="start-badge">
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      Apertura prevista alle <strong>{eventTimer.startTimeFormatted}</strong>
    </div>
  {/if}

  <div class="countdown-box">
    <div class="countdown-label-top">Tempo rimanente allo sblocco</div>
    <div class="countdown-timer-grid">
      <div class="countdown-unit">
        <span class="countdown-value font-serif">{eventTimer.toStart.hours}</span>
        <span class="countdown-unit-label">Ore</span>
      </div>
      <span class="countdown-sep">:</span>
      <div class="countdown-unit">
        <span class="countdown-value font-serif">{eventTimer.toStart.minutes}</span>
        <span class="countdown-unit-label">Min</span>
      </div>
      <span class="countdown-sep">:</span>
      <div class="countdown-unit">
        <span class="countdown-value font-serif">{eventTimer.toStart.seconds}</span>
        <span class="countdown-unit-label">Sec</span>
      </div>
    </div>
  </div>

  <p class="locked-hint">
    Niente spoiler! Le attività e la galleria si sbloccheranno appena i giochi avranno inizio. Nel frattempo puoi dare un'occhiata alla classifica o rilassarti!
  </p>

  <div class="locked-actions">
    <button class="btn btn-secondary-subtle" onclick={() => appState.activeTab = 'leaderboard'}>
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
      Classifica
    </button>
    <button class="btn btn-gold" onclick={() => appState.activeTab = 'home'}>
      Torna alla Home →
    </button>
  </div>
</div>

<style>
  .locked-container {
    position: relative;
    padding: 36px 20px 28px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    overflow: hidden;
    margin-top: 10px;
  }

  .locked-glow {
    position: absolute;
    top: -30%;
    left: 50%;
    transform: translateX(-50%);
    width: 260px;
    height: 260px;
    background: radial-gradient(circle, rgba(201, 169, 110, 0.16) 0%, transparent 70%);
    pointer-events: none;
  }

  .lock-icon-container {
    position: relative;
    width: 68px;
    height: 68px;
    border-radius: 50%;
    background: rgba(201, 169, 110, 0.14);
    border: 1px solid rgba(201, 169, 110, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
    color: var(--gold-dark);
  }

  .lock-pulse {
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    border: 1px solid rgba(201, 169, 110, 0.25);
    animation: ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite;
  }

  @keyframes ping {
    75%, 100% {
      transform: scale(1.3);
      opacity: 0;
    }
  }

  .lock-svg {
    position: relative;
    z-index: 1;
  }

  .locked-title {
    font-size: 1.35rem;
    font-weight: 800;
    color: var(--text-main);
    margin: 0 0 6px 0;
  }

  .locked-subtitle {
    font-size: 0.88rem;
    color: var(--text-muted);
    max-width: 320px;
    margin: 0 0 12px 0;
    line-height: 1.4;
  }

  .start-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.76rem;
    color: var(--gold-dark);
    background: rgba(201, 169, 110, 0.12);
    border: 1px solid rgba(201, 169, 110, 0.28);
    padding: 4px 12px;
    border-radius: var(--radius-full);
    margin-bottom: 18px;
  }

  .countdown-box {
    width: 100%;
    max-width: 320px;
    background: rgba(255, 255, 255, 0.65);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(201, 169, 110, 0.28);
    border-radius: var(--radius-lg);
    padding: 16px 14px;
    margin-bottom: 16px;
    box-shadow: 0 4px 14px rgba(184, 150, 92, 0.08);
  }

  .countdown-label-top {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    font-weight: 700;
    color: var(--text-muted);
    margin-bottom: 10px;
  }

  .countdown-timer-grid {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .countdown-unit {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: 58px;
    padding: 8px 10px;
    background: var(--bg-surface-elevated);
    border: 1px solid rgba(201, 169, 110, 0.35);
    border-radius: var(--radius-md);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  }

  .countdown-value {
    font-size: 1.85rem;
    font-weight: 800;
    line-height: 1;
    color: var(--gold-dark);
  }

  .countdown-unit-label {
    font-size: 0.68rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin-top: 3px;
  }

  .countdown-sep {
    font-size: 1.6rem;
    font-weight: 800;
    color: var(--gold-primary);
    line-height: 1;
    margin-bottom: 10px;
    opacity: 0.8;
  }

  .locked-hint {
    font-size: 0.82rem;
    color: var(--text-muted);
    max-width: 310px;
    line-height: 1.45;
    margin: 0 0 20px 0;
  }

  .locked-actions {
    display: flex;
    gap: 10px;
    width: 100%;
    max-width: 320px;
  }

  .locked-actions button {
    flex: 1;
    font-size: 0.85rem;
    padding: 10px 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .btn-secondary-subtle {
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    color: var(--text-main);
    border-radius: var(--radius-full);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-secondary-subtle:hover {
    background: var(--bg-surface-elevated);
    border-color: var(--gold-primary);
  }
</style>
