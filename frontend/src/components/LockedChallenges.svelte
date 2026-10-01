<script>
  import { eventTimer } from '../lib/timer.svelte.js';
  import { appState } from '../lib/state.svelte.js';

  let { title = 'Sfide Non Ancora Iniziate', subtitle = 'Questa sezione si sbloccherà automaticamente all\'inizio dei giochi.' } = $props();
</script>

<div class="locked-container glass-card">
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
    <button class="btn btn-primary" onclick={() => appState.activeTab = 'home'}>
      Torna alla Home →
    </button>
  </div>
</div>

<style>
  .locked-container { position: relative; padding: 40px 22px 30px; display: flex; flex-direction: column; align-items: center; text-align: center; overflow: hidden; margin-top: 10px; border-radius: 28px; background: #fff; border: 1px solid rgba(36,28,32,.07); box-shadow: 0 18px 34px -24px rgba(106,32,55,.4); }
  .locked-glow { position: absolute; top: -30%; left: 50%; transform: translateX(-50%); width: 300px; height: 260px; background: radial-gradient(circle, rgba(140,47,75,.1) 0%, transparent 70%); pointer-events: none; }
  .lock-icon-container { position: relative; width: 72px; height: 72px; border-radius: 50%; background: var(--wine-tint); border: 1px solid rgba(140,47,75,.18); display: flex; align-items: center; justify-content: center; margin-bottom: 16px; color: var(--wine); }
  .lock-pulse { position: absolute; inset: -6px; border-radius: 50%; border: 1px solid rgba(140,47,75,.2); animation: ping 2.5s cubic-bezier(0,0,.2,1) infinite; }
  @keyframes ping { 75%, 100% { transform: scale(1.3); opacity: 0; } }
  .lock-svg { position: relative; z-index: 1; }
  .locked-title { font-size: 1.8rem; font-weight: 600; line-height: 1.1; color: var(--text-main); margin: 0 0 8px; }
  .locked-subtitle { font-size: .9rem; font-style: italic; color: #6b5f64; max-width: 340px; margin: 0 0 14px; line-height: 1.5; }
  .start-badge { display: inline-flex; align-items: center; gap: 6px; font-size: .78rem; color: #7a5a1c; background: rgba(233,201,143,.28); border: 1px solid rgba(201,169,110,.5); padding: 5px 14px; border-radius: 999px; margin-bottom: 18px; }
  .countdown-box { width: 100%; max-width: 340px; background: var(--paper); border: 1px solid rgba(36,28,32,.07); border-radius: 24px; padding: 18px 14px; margin-bottom: 16px; }
  .countdown-label-top { font-size: .8rem; font-weight: 600; color: #6b5f64; margin-bottom: 12px; }
  .countdown-timer-grid { display: flex; align-items: center; justify-content: center; gap: 8px; }
  .countdown-unit { display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 62px; padding: 10px 10px; background: var(--wine-tint); border-radius: 18px; }
  .countdown-value { font-size: 2.1rem; font-weight: 600; line-height: 1; color: var(--wine-deep); font-variant-numeric: tabular-nums; }
  .countdown-unit-label { font-size: .72rem; font-weight: 600; color: #6b5f64; margin-top: 4px; }
  .countdown-sep { font-family: var(--font-display); font-size: 1.8rem; font-weight: 600; color: var(--wine); line-height: 1; margin-bottom: 14px; opacity: .6; }
  .locked-hint { font-size: .84rem; color: #6b5f64; max-width: 320px; line-height: 1.5; margin: 0 0 20px; }
  .locked-actions { display: flex; gap: 10px; width: 100%; max-width: 340px; }
  .locked-actions button { flex: 1; font-size: .85rem; padding: 11px 14px; display: flex; align-items: center; justify-content: center; gap: 6px; border-radius: 999px; }
  .btn-secondary-subtle { background: #fff; border: 1px solid rgba(140,47,75,.25); color: var(--wine); font-weight: 600; cursor: pointer; transition: background .2s, border-color .2s; }
  @media (hover: hover) { .btn-secondary-subtle:hover { background: var(--wine-tint); border-color: var(--wine); } }
  .locked-actions button:focus-visible { outline: 2px solid var(--wine); outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) { .lock-pulse { animation: none; } }
</style>
