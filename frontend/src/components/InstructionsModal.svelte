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
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
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
          <strong>Al termine, i primi 3 sul podio riceveranno fantastici premi!</strong>
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
              <div class="rule-icon photo-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
              </div>
              <div class="rule-text">
                <strong>Galleria Condivisa</strong>
                <span>Scatta selfie e foto della festa per condividerle (+10 PT cad.).</span>
              </div>
            </div>

            <div class="rule-item">
              <div class="rule-icon hunt-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/></svg>
              </div>
              <div class="rule-text">
                <strong>Caccia al Tesoro</strong>
                <span>Trova gli indizi, cerca gli invitati giusti e scatta la foto richiesta.</span>
              </div>
            </div>

            <div class="rule-item">
              <div class="rule-icon quiz-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div class="rule-text">
                <strong>Quiz sugli Sposi</strong>
                <span>Dimostra quanto conosci bene gli sposi (+30 PT per risposta esatta).</span>
              </div>
            </div>

            <div class="rule-item">
              <div class="rule-icon vote-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
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
        <button class="confirm-btn" onclick={handleDismiss}>
          Ho capito, iniziamo!
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
    background: rgba(26, 12, 20, 0.62);
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
    max-width: 460px;
    max-height: min(88dvh, calc(100svh - 24px));
    display: flex;
    flex-direction: column;
    background: #fff;
    border-radius: 28px;
    border: 1px solid rgba(36, 28, 32, 0.07);
    box-shadow: 0 30px 70px rgba(74, 31, 51, 0.32), 0 4px 14px rgba(140, 47, 75, 0.12);
    animation: popUp 0.28s cubic-bezier(0.16, 1, 0.3, 1);
    overflow: hidden;
  }

  .modal-header {
    position: relative;
    padding: 26px 22px 14px;
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
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--bg-primary);
    border: 1px solid rgba(36, 28, 32, 0.07);
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s, color 0.2s, transform 0.15s;
    z-index: 2;
  }

  .close-x-btn:active {
    transform: scale(0.92);
  }

  @media (hover: hover) {
    .close-x-btn:hover {
      background: var(--wine-tint);
      color: var(--wine);
    }
  }

  .close-x-btn:focus-visible,
  .confirm-btn:focus-visible {
    outline: 2px solid var(--wine);
    outline-offset: 2px;
  }

  .modal-rings-icon {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--grad-dusk);
    border: 1px solid rgba(233, 201, 143, 0.4);
    color: var(--gold-bright);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 12px;
    box-shadow: 0 8px 20px rgba(74, 31, 51, 0.25);
  }

  .modal-title {
    font-size: 1.85rem;
    font-weight: 600;
    color: var(--text-main);
    margin: 0;
    line-height: 1.1;
    letter-spacing: -0.01em;
  }

  .modal-title::after {
    content: '';
    display: block;
    width: 36px;
    height: 2px;
    border-radius: 2px;
    background: var(--wine);
    margin: 12px auto 0;
  }

  .modal-subtitle {
    font-family: var(--font-display);
    font-style: italic;
    font-size: 1.1rem;
    color: #6b5f64;
    margin-top: 10px;
  }

  .modal-subtitle strong {
    color: var(--wine);
    font-weight: 600;
  }

  .modal-scroll-body {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    padding: 6px 20px 14px;
  }

  .intro-text {
    font-size: 0.88rem;
    color: var(--text-main);
    line-height: 1.5;
    text-align: center;
    margin: 0 0 14px 0;
    background: var(--wine-tint);
    border: 1px solid rgba(140, 47, 75, 0.12);
    border-radius: 18px;
    padding: 10px 14px;
  }

  .intro-text strong {
    color: var(--wine-deep);
  }

  .timing-box {
    background: #fbf5e9;
    border: 1px solid rgba(201, 169, 110, 0.35);
    border-radius: 18px;
    padding: 10px 14px;
    margin-bottom: 14px;
    font-size: 0.82rem;
  }

  .timing-header {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--wine);
    font-size: 0.85rem;
    margin-bottom: 3px;
  }

  .timing-desc {
    color: #6b5f64;
    line-height: 1.4;
  }

  .rules-section {
    margin-bottom: 4px;
  }

  .rules-label {
    font-family: var(--font-display);
    font-size: 1.2rem;
    color: var(--text-main);
    font-weight: 600;
    margin-bottom: 8px;
  }

  .rules-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .rule-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    background: #fff;
    border: 1px solid rgba(36, 28, 32, 0.07);
    border-radius: 18px;
    padding: 10px 12px;
  }

  .rule-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .rule-icon.photo-icon {
    background: var(--wine-tint);
    color: var(--wine);
  }

  .rule-icon.hunt-icon {
    background: #f6ecd6;
    color: #8a6a2c;
  }

  .rule-icon.quiz-icon {
    background: #e3f0e9;
    color: #3f7a5f;
  }

  .rule-icon.vote-icon {
    background: #fbe6ec;
    color: #b94b68;
  }

  .rule-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.8rem;
  }

  .rule-text strong {
    color: var(--text-main);
    font-size: 0.88rem;
  }

  .rule-text span {
    color: #6b5f64;
    line-height: 1.35;
  }

  .modal-footer {
    padding: 14px 20px max(16px, env(safe-area-inset-bottom, 0px));
    background: #fff;
    border-top: 1px solid rgba(36, 28, 32, 0.07);
    flex-shrink: 0;
  }

  .confirm-btn {
    width: 100%;
    padding: 12px;
    font-size: 0.95rem;
    font-weight: 700;
    min-height: 48px;
    border-radius: 9999px;
    border: none;
    color: #fff;
    background: var(--grad-gold-rose);
    cursor: pointer;
    box-shadow: 0 8px 20px rgba(140, 47, 75, 0.28);
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes popUp {
    from {
      opacity: 0;
      transform: scale(0.94) translateY(10px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .modal-backdrop,
    .modal-card {
      animation: none;
    }
  }
</style>
