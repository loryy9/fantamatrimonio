<script>
  import { appState } from '../lib/state.svelte.js';

  function handleCreate() {
    appState.showUpgradeModal = true;
    appState.dismissAccountPrompt();
  }

  function handleDismiss() {
    appState.dismissAccountPrompt();
  }
</script>

{#if appState.showAccountPromptBanner && !appState.hasAccount && !appState.isCouple}
  <aside class="account-prompt-banner" aria-label="Suggerimento creazione account">
    <div class="banner-sparkle-bg" aria-hidden="true"></div>

    <button
      class="banner-close"
      onclick={handleDismiss}
      title="Chiudi avviso"
      aria-label="Chiudi avviso"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
      </svg>
    </button>

    <div class="banner-body">
      <div class="banner-icon-wrap" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
          <path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>
        </svg>
      </div>

      <div class="banner-text">
        <div class="banner-eyebrow">
          <span class="banner-badge">Ricordi della festa</span>
        </div>
        <h3 class="banner-title font-serif">Non vuoi perderti le cose di questo matrimonio?</h3>
        <p class="banner-subtitle">
          Crea il tuo account per salvare foto, classifica e ritrovare i ricordi di questa festa da qualsiasi dispositivo!
        </p>

        <div class="banner-actions">
          <button type="button" class="btn btn-primary banner-cta" onclick={handleCreate}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/>
            </svg>
            <span>Crea account</span>
          </button>

          <button type="button" class="btn btn-secondary banner-later" onclick={handleDismiss}>
            Magari dopo
          </button>
        </div>

        <div class="navbar-pointer">
          <span class="pointer-arrow" aria-hidden="true">↗</span>
          <span class="pointer-text">
            Puoi registrarti in ogni momento premendo l'icona account in alto a destra nella barra.
          </span>
        </div>
      </div>
    </div>
  </aside>
{/if}

<style>
  .account-prompt-banner {
    position: relative;
    overflow: hidden;
    width: calc(100% - 24px);
    max-width: 520px;
    margin: 10px auto 14px;
    padding: 16px 18px 14px;
    border-radius: var(--radius-lg, 20px);
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(253, 247, 248, 0.96) 100%);
    border: 1.5px solid rgba(201, 169, 110, 0.45);
    box-shadow:
      0 10px 28px -6px rgba(106, 32, 55, 0.12),
      0 4px 12px rgba(201, 169, 110, 0.15);
    animation: bannerSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    z-index: 20;
    flex-shrink: 0;
  }

  .banner-sparkle-bg {
    position: absolute;
    top: -24px;
    right: -24px;
    width: 140px;
    height: 140px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(233, 201, 143, 0.35) 0%, transparent 70%);
    pointer-events: none;
  }

  /* Accessible touch target: at least 44x44px hit area */
  .banner-close {
    position: absolute;
    top: 6px;
    right: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    min-height: 44px;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: background 0.18s ease, color 0.18s ease, transform 0.15s ease;
    z-index: 2;
  }

  .banner-close:hover {
    background: rgba(140, 47, 75, 0.08);
    color: var(--wine);
  }

  .banner-close:active {
    transform: scale(0.92);
  }

  .banner-close:focus-visible {
    outline: 2px solid var(--wine);
    outline-offset: 2px;
  }

  .banner-body {
    display: flex;
    align-items: flex-start;
    gap: 14px;
  }

  .banner-icon-wrap {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 14px;
    background: linear-gradient(135deg, rgba(201, 169, 110, 0.25) 0%, rgba(140, 47, 75, 0.15) 100%);
    color: var(--wine);
    border: 1px solid rgba(201, 169, 110, 0.4);
    flex-shrink: 0;
    box-shadow: 0 4px 10px rgba(201, 169, 110, 0.2);
    animation: pulseIcon 3s infinite ease-in-out;
  }

  .banner-text {
    flex: 1;
    min-width: 0;
    padding-right: 28px;
  }

  .banner-eyebrow {
    margin-bottom: 4px;
  }

  .banner-badge {
    display: inline-block;
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--gold-dark);
    background: rgba(201, 169, 110, 0.14);
    padding: 2px 8px;
    border-radius: 999px;
  }

  .banner-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--wine-deep);
    margin: 2px 0 6px;
    line-height: 1.25;
  }

  .banner-subtitle {
    font-size: 0.88rem;
    color: var(--text-muted);
    margin: 0 0 12px;
    line-height: 1.45;
  }

  .banner-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }

  .banner-cta {
    min-height: 42px;
    padding: 9px 18px;
    font-size: 0.88rem;
    box-shadow: 0 4px 12px rgba(106, 32, 55, 0.25);
  }

  .banner-later {
    min-height: 42px;
    padding: 9px 16px;
    font-size: 0.85rem;
    color: var(--text-muted);
    background: rgba(0, 0, 0, 0.03);
    border: 1px solid rgba(0, 0, 0, 0.08);
  }

  .banner-later:hover {
    color: var(--text-main);
    background: rgba(0, 0, 0, 0.06);
    border-color: rgba(0, 0, 0, 0.14);
  }

  .navbar-pointer {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
    padding: 6px 12px;
    border-radius: 10px;
    background: rgba(201, 169, 110, 0.12);
    border: 1px dashed rgba(201, 169, 110, 0.45);
    font-size: 0.8rem;
    color: var(--gold-dark);
    line-height: 1.35;
  }

  .pointer-arrow {
    display: inline-block;
    font-size: 1.05rem;
    font-weight: 800;
    color: var(--wine);
    animation: floatArrow 1.5s infinite ease-in-out;
  }

  @keyframes bannerSlideIn {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes pulseIcon {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }

  @keyframes floatArrow {
    0%, 100% { transform: translate(0, 0); }
    50% { transform: translate(2px, -2px); }
  }

  @media (prefers-reduced-motion: reduce) {
    .account-prompt-banner {
      animation: none;
    }
    .banner-icon-wrap,
    .pointer-arrow {
      animation: none;
    }
  }

  @media (min-width: 900px) {
    .account-prompt-banner {
      max-width: 1100px;
      width: calc(100% - 80px);
      margin: 16px auto 10px;
      padding: 18px 24px;
    }
    .banner-title {
      font-size: 1.25rem;
    }
    .banner-subtitle {
      font-size: 0.94rem;
    }
  }

  @media (max-width: 480px) {
    .account-prompt-banner {
      width: calc(100% - 20px);
      margin: 8px auto 12px;
      padding: 12px 14px;
    }
    .banner-icon-wrap {
      width: 38px;
      height: 38px;
    }
    .banner-title {
      font-size: 1rem;
    }
    .banner-text {
      padding-right: 20px;
    }
    .banner-actions {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
    }
    .banner-actions .btn {
      width: 100%;
      justify-content: center;
    }
  }
</style>
