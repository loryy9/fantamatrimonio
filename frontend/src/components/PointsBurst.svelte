<script>
  import { appState } from '../lib/state.svelte.js';
  import { untrack } from 'svelte';

  // Al termine dell'animazione si smonta l'elemento (solo se è ancora lo stesso burst)
  function fine(id) {
    if (appState.pointsBurst?.id === id) appState.pointsBurst = null;
  }
</script>

{#if appState.pointsBurst}
  <!-- La chiave su id riavvia l'animazione a ogni nuova chiamata -->
  {#key appState.pointsBurst.id}
    <div
      class="points-burst"
      role="status"
      aria-live="polite"
      onanimationend={() => fine(untrack(() => appState.pointsBurst?.id))}
    >
      <div class="points-value font-serif">+{appState.pointsBurst.points}</div>
      <div class="points-label">punti</div>
    </div>
  {/key}
{/if}

<style>
  .points-burst {
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    color: var(--wine);
    text-shadow: 0 2px 18px rgba(255, 255, 255, 0.85), 0 4px 24px rgba(74, 31, 51, 0.25);
    animation: burstRise 1.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }

  .points-value {
    font-size: clamp(4rem, 22vw, 8rem);
    font-weight: 800;
    line-height: 1;
  }

  .points-label {
    margin-top: 4px;
    font-size: 1.1rem;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  @keyframes burstRise {
    0% { opacity: 0; transform: translateY(24px) scale(0.8); }
    20% { opacity: 1; transform: translateY(0) scale(1.05); }
    70% { opacity: 1; }
    100% { opacity: 0; transform: translateY(-70px) scale(1); }
  }

  /* Senza movimento: solo dissolvenza */
  @media (prefers-reduced-motion: reduce) {
    .points-burst {
      animation-name: burstFade;
      animation-duration: 1.5s;
      animation-timing-function: linear;
    }
    @keyframes burstFade {
      0% { opacity: 0; }
      15% { opacity: 1; }
      85% { opacity: 1; }
      100% { opacity: 0; }
    }
  }
</style>
