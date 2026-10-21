<script>
  import { appState } from '../lib/state.svelte.js';

  function handleCreate() {
    appState.showUpgradeModal = true;
    appState.dismissAccountPrompt();
  }

  function handleDismiss() {
    appState.dismissAccountPrompt();
  }

  function handleKeydown(e) {
    if (e.key === 'Escape' && appState.showAccountPromptBanner) {
      handleDismiss();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if appState.showAccountPromptBanner && !appState.hasAccount && !appState.isCouple}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="prompt-backdrop" onclick={handleDismiss} role="presentation"></div>

  <aside class="bottom-sheet-wrapper" aria-label="Suggerimento creazione account">
    <div class="account-prompt-sheet">
      <button
        type="button"
        class="sheet-close-btn"
        onclick={handleDismiss}
        title="Chiudi avviso"
        aria-label="Chiudi avviso"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <div class="sheet-layout">
        <div class="sheet-icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <line x1="19" y1="8" x2="19" y2="14"/>
            <line x1="22" y1="11" x2="16" y2="11"/>
          </svg>
        </div>

        <div class="sheet-content">
          <h3 class="sheet-title font-serif">Ti piace il FantaMatrimonio?</h3>
          <p class="sheet-desc">
            Crea il tuo account per non perdere i punti conquistati, le foto caricate e tutti i contenuti di questa festa.
          </p>

          <div class="sheet-actions">
            <button type="button" class="btn btn-primary btn-cta" onclick={handleCreate}>
              <span>Crea account</span>
            </button>
            <button type="button" class="btn-dismiss" onclick={handleDismiss}>
              Magari dopo
            </button>
          </div>

          <div class="sheet-hint">
            <span>Se non vuoi farlo ora, puoi farlo più tardi premendo sul pulsante</span>
            <span class="inline-navbar-btn" aria-hidden="true" title="Pulsante account in alto">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <line x1="19" y1="8" x2="19" y2="14"/>
                <line x1="22" y1="11" x2="16" y2="11"/>
              </svg>
            </span>
            <span>nella barra in alto.</span>
          </div>
        </div>
      </div>
    </div>
  </aside>
{/if}

<style>
  .prompt-backdrop {
    position: fixed;
    inset: 0;
    z-index: 180;
    background: rgba(30, 14, 24, 0.4);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    animation: fadeInBackdrop 0.25s ease-out;
    cursor: pointer;
  }

  .bottom-sheet-wrapper {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 260;
    display: flex;
    justify-content: center;
    pointer-events: none;
    animation: slideUpSheet 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .account-prompt-sheet {
    pointer-events: auto;
    position: relative;
    width: 100%;
    max-width: 520px;
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border-top: 1.5px solid rgba(201, 169, 110, 0.5);
    border-left: 1px solid rgba(201, 169, 110, 0.3);
    border-right: 1px solid rgba(201, 169, 110, 0.3);
    border-bottom: none;
    border-radius: 26px 26px 0 0;
    box-shadow:
      0 -14px 38px -6px rgba(74, 31, 51, 0.28),
      0 -4px 14px rgba(201, 169, 110, 0.18),
      inset 0 1px 0 rgba(255, 255, 255, 0.95);
    padding: 16px 18px calc(14px + var(--safe-bottom)) 16px;
    overflow: hidden;
  }

  .sheet-close-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: rgba(36, 28, 32, 0.05);
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.18s ease, color 0.18s ease, transform 0.15s ease;
    z-index: 2;
  }

  .sheet-close-btn:hover {
    background: rgba(140, 47, 75, 0.1);
    color: var(--wine);
  }

  .sheet-close-btn:active {
    transform: scale(0.92);
  }

  .sheet-close-btn:focus-visible {
    outline: 2px solid var(--wine);
    outline-offset: 2px;
  }

  .sheet-layout {
    display: flex;
    align-items: flex-start;
    gap: 13px;
  }

  .sheet-icon {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 14px;
    background: linear-gradient(145deg, #fbefcf, #e3c07e);
    color: var(--wine-deep);
    border: 1.5px solid rgba(240, 216, 168, 0.75);
    box-shadow: 0 4px 12px rgba(201, 169, 110, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.8);
    flex-shrink: 0;
    margin-top: 2px;
  }

  .sheet-content {
    flex: 1;
    min-width: 0;
    padding-right: 22px;
  }

  .sheet-title {
    font-size: 1.08rem;
    font-weight: 700;
    color: var(--wine-deep);
    margin: 0 0 4px;
    line-height: 1.25;
  }

  .sheet-desc {
    font-size: 0.83rem;
    color: var(--text-muted);
    line-height: 1.42;
    margin: 0 0 10px;
  }

  .sheet-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .btn-cta {
    min-height: 36px;
    padding: 7px 18px;
    font-size: 0.84rem;
    font-weight: 700;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(106, 32, 55, 0.25);
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .btn-cta:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(106, 32, 55, 0.35);
  }

  .btn-dismiss {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 0.82rem;
    font-weight: 600;
    padding: 6px 10px;
    cursor: pointer;
    border-radius: 8px;
    transition: color 0.15s ease;
  }

  .btn-dismiss:hover {
    color: var(--wine);
  }

  .sheet-hint {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px dashed rgba(201, 169, 110, 0.35);
    font-size: 0.77rem;
    color: var(--text-muted);
    line-height: 1.45;
  }

  .inline-navbar-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: linear-gradient(145deg, #fbefcf, #e3c07e);
    color: var(--wine-deep);
    border: 1px solid rgba(240, 216, 168, 0.75);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.8);
    vertical-align: middle;
    margin: 0 3px;
  }

  @keyframes fadeInBackdrop {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideUpSheet {
    from {
      opacity: 0;
      transform: translateY(100%);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .prompt-backdrop,
    .bottom-sheet-wrapper {
      animation: none;
    }
  }

  @media (min-width: 900px) {
    .account-prompt-sheet {
      border-radius: 28px 28px 0 0;
      padding: 18px 22px calc(16px + var(--safe-bottom)) 20px;
    }
    .sheet-title {
      font-size: 1.15rem;
    }
    .sheet-desc {
      font-size: 0.86rem;
    }
  }

  @media (max-width: 380px) {
    .account-prompt-sheet {
      padding: 14px 14px calc(12px + var(--safe-bottom)) 12px;
    }
    .sheet-icon {
      width: 38px;
      height: 38px;
      border-radius: 12px;
    }
    .sheet-title {
      font-size: 1rem;
    }
    .sheet-desc {
      font-size: 0.8rem;
    }
    .sheet-actions {
      flex-direction: column;
      align-items: stretch;
      gap: 6px;
    }
    .btn-cta {
      width: 100%;
      justify-content: center;
    }
    .btn-dismiss {
      text-align: center;
    }
  }
</style>
