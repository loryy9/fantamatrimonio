<script>
  import { appState } from '../lib/state.svelte.js';
  import { eventTimer } from '../lib/timer.svelte.js';
  import { formatName } from '../lib/formatters.js';

  const rawSpouse1 = import.meta.env.VITE_SPOUSE_1 || import.meta.env.VITE_NOME_1 || 'Mattia';
  const rawSpouse2 = import.meta.env.VITE_SPOUSE_2 || import.meta.env.VITE_NOME_2 || 'Giulia';
  const spouse1 = formatName(rawSpouse1);
  const spouse2 = formatName(rawSpouse2);

  // Check on mount or when user changes if this user has already seen the instructions
  $effect(() => {
    const userId = appState.user?.id;
    if (userId) {
      const storageKey = `fm_instructions_seen_${userId}`;
      const hasSeen = localStorage.getItem(storageKey);
      if (!hasSeen) {
        appState.showInstructionsModal = true;
      }
    }
  });

  function handleDismiss() {
    const userId = appState.user?.id;
    if (userId) {
      localStorage.setItem(`fm_instructions_seen_${userId}`, 'true');
    }
    appState.showInstructionsModal = false;
  }
</script>

{#if appState.showInstructionsModal}
  <div class="modal-backdrop" onclick={handleDismiss}>
    <div class="modal-card" onclick={(e) => e.stopPropagation()}>
      <!-- Header -->
      <div class="modal-header">
        <button class="close-x-btn" onclick={handleDismiss} title="Chiudi" aria-label="Chiudi istruzioni">
          ✕
        </button>

        <div class="modal-rings-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="9" cy="12" r="5"></circle>
            <circle cx="15" cy="12" r="5"></circle>
          </svg>
        </div>
        <h2 class="modal-title font-serif">Benvenuti al FantaMatrimonio!</h2>
        <div class="modal-subtitle">
          Festa di <strong class="gold-gradient-text">{spouse1} & {spouse2}</strong>
        </div>
      </div>

      <!-- Scrollable Content Area -->
      <div class="modal-scroll-body">
        <!-- Intro text -->
        <p class="intro-text">
          Durante la festa potrete completare sfide divertenti, rispondere a quiz e guadagnare punti.
          <strong>Al termine, i primi 3 sul podio riceveranno fantastici premi! 🏆</strong>
        </p>

        <!-- Timing Banner -->
        {#if eventTimer.isEnabled && (eventTimer.startTimeFormatted || eventTimer.endTimeFormatted)}
          <div class="timing-box">
            <div class="timing-header">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <strong>Orari delle Sfide</strong>
            </div>
            <div class="timing-desc">
              {#if eventTimer.startTimeFormatted && eventTimer.endTimeFormatted}
                Le sfide aprono alle <strong>{eventTimer.startTimeFormatted}</strong> e terminano alle <strong>{eventTimer.endTimeFormatted}</strong>! Fino all'orario di inizio puoi prepararti ed esplorare il sito.
              {:else if eventTimer.startTimeFormatted}
                I giochi apriranno alle <strong>{eventTimer.startTimeFormatted}</strong>!
              {:else}
                I giochi termineranno alle <strong>{eventTimer.endTimeFormatted}</strong>!
              {/if}
            </div>
          </div>
        {/if}

        <!-- Mini-games quick summary -->
        <div class="rules-section">
          <div class="rules-label">Come si guadagnano punti:</div>
          <div class="rules-list">
            <div class="rule-item">
              <div class="rule-icon photo-icon">📸</div>
              <div class="rule-text">
                <strong>Galleria Condivisa</strong>
                <span>Scatta selfie e foto della festa per condividerle (+10 PT cad.).</span>
              </div>
            </div>

            <div class="rule-item">
              <div class="rule-icon hunt-icon">🗺️</div>
              <div class="rule-text">
                <strong>Caccia al Tesoro</strong>
                <span>Trova gli indizi, cerca gli invitati giusti e scatta la foto richiesta.</span>
              </div>
            </div>

            <div class="rule-item">
              <div class="rule-icon quiz-icon">💡</div>
              <div class="rule-text">
                <strong>Quiz sugli Sposi</strong>
                <span>Dimostra quanto conosci bene gli sposi (+30 PT per risposta esatta).</span>
              </div>
            </div>

            <div class="rule-item">
              <div class="rule-icon vote-icon">✍️</div>
              <div class="rule-text">
                <strong>Momenti Migliori</strong>
                <span>Scrivi e condividi i tuoi ricordi ed emozioni più belli (+3 PT).</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Button Footer (Sticky & always visible) -->
      <div class="modal-footer">
        <button class="btn btn-gold btn-block confirm-btn" onclick={handleDismiss}>
          Ho capito, iniziamo! ✨
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 999999;
    background: rgba(15, 12, 8, 0.78);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: max(12px, env(safe-area-inset-top, 0px)) 16px max(12px, env(safe-area-inset-bottom, 0px)) 16px;
    animation: fadeIn 0.2s ease-out;
  }

  .modal-card {
    position: relative;
    width: 100%;
    max-width: 440px;
    max-height: min(86dvh, calc(100svh - 24px));
    display: flex;
    flex-direction: column;
    background: #ffffff;
    border-radius: var(--radius-lg);
    border: 1px solid rgba(201, 169, 110, 0.45);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35), 0 2px 10px rgba(201, 169, 110, 0.25);
    animation: popUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    overflow: hidden;
  }

  .modal-header {
    position: relative;
    padding: 20px 20px 10px 20px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
  }

  .close-x-btn {
    position: absolute;
    top: 14px;
    right: 14px;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.05);
    border: none;
    font-size: 1.1rem;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    z-index: 2;
  }

  .close-x-btn:active {
    background: rgba(0, 0, 0, 0.15);
    transform: scale(0.92);
  }

  .modal-rings-icon {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgba(201, 169, 110, 0.14);
    border: 1px solid rgba(201, 169, 110, 0.35);
    color: var(--gold-dark);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
  }

  .modal-title {
    font-size: 1.3rem;
    font-weight: 800;
    color: var(--text-main);
    margin: 0;
    line-height: 1.25;
  }

  .modal-subtitle {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-top: 3px;
  }

  .modal-scroll-body {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    padding: 6px 18px 12px 18px;
  }

  .intro-text {
    font-size: 0.84rem;
    color: var(--text-main);
    line-height: 1.45;
    text-align: center;
    margin: 0 0 12px 0;
    background: rgba(201, 169, 110, 0.08);
    border: 1px solid rgba(201, 169, 110, 0.25);
    border-radius: var(--radius-md);
    padding: 8px 12px;
  }

  .timing-box {
    background: var(--bg-surface-elevated);
    border: 1px solid rgba(201, 169, 110, 0.3);
    border-radius: var(--radius-md);
    padding: 8px 12px;
    margin-bottom: 12px;
    font-size: 0.8rem;
  }

  .timing-header {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--gold-dark);
    font-size: 0.76rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 3px;
  }

  .timing-desc {
    color: var(--text-muted);
    line-height: 1.35;
  }

  .rules-section {
    margin-bottom: 4px;
  }

  .rules-label {
    font-size: 0.74rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    font-weight: 700;
    margin-bottom: 6px;
  }

  .rules-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .rule-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    background: var(--bg-surface-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: 7px 10px;
  }

  .rule-icon {
    font-size: 1.15rem;
    line-height: 1;
    margin-top: 2px;
  }

  .rule-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    font-size: 0.78rem;
  }

  .rule-text strong {
    color: var(--text-main);
  }

  .rule-text span {
    color: var(--text-muted);
    line-height: 1.3;
  }

  .modal-footer {
    padding: 12px 18px max(14px, env(safe-area-inset-bottom, 0px)) 18px;
    background: #ffffff;
    border-top: 1px solid var(--border-subtle);
    box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.04);
    flex-shrink: 0;
  }

  .confirm-btn {
    width: 100%;
    padding: 12px;
    font-size: 0.95rem;
    font-weight: 700;
    min-height: 46px;
    box-shadow: 0 4px 14px rgba(201, 169, 110, 0.35);
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes popUp {
    from {
      opacity: 0;
      transform: scale(0.92) translateY(10px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
</style>
