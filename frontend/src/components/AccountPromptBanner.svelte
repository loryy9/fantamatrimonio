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

    <button class="banner-close" onclick={handleDismiss} title="Chiudi avviso" aria-label="Chiudi">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
      </svg>
    </button>

    <div class="banner-body">
      <div class="banner-icon-wrap" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
          <path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>
        </svg>
      </div>

      <div class="banner-text">
        <h3 class="banner-title font-serif">Non vuoi perderti le cose di questo matrimonio?</h3>
        <p class="banner-subtitle">
          Crea il tuo account per salvare foto, classifica e ritrovare i ricordi di questa festa da qualsiasi dispositivo!
        </p>

        <div class="banner-actions">
          <button type="button" class="btn btn-primary btn-sm banner-cta" onclick={handleCreate}>
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/>
            </svg>
            <span>Crea account</span>
          </button>

          <button type="button" class="btn btn-ghost btn-sm banner-later" onclick={handleDismiss}>
            Magari dopo
          </button>
        </div>

        <div class="navbar-pointer">
          <span class="pointer-arrow" aria-hidden="true">↗</span>
          <span class="pointer-text">
            oppure premi il pulsante <strong>Crea account</strong> in alto a destra quando vuoi!
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
    margin: 12px 14px 18px;
    padding: 16px 18px 14px;
    border-radius: 20px;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(253, 247, 248, 0.96) 100%);
    border: 1.5px solid rgba(201, 169, 110, 0.45);
    box-shadow:
      0 10px 28px -6px rgba(106, 32, 55, 0.12),
      0 4px 12px rgba(201, 169, 110, 0.15);
    animation: bannerSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    z-index: 20;
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

  .banner-close {
    position: absolute;
    top: 10px;
    right: 10px;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: none;
    background: rgba(0, 0, 0, 0.04);
    color: var(--text-muted);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    z-index: 2;
  }

  .banner-close:hover {
    background: rgba(0, 0, 0, 0.08);
    color: var(--text-main);
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
  }

  .banner-title {
    font-size: 1.12rem;
    font-weight: 700;
    color: var(--wine-dark, #4a1226);
    margin: 0 0 4px;
    line-height: 1.25;
  }

  .banner-subtitle {
    font-size: 0.86rem;
    color: #63575c;
    margin: 0 0 12px;
    line-height: 1.45;
  }

  .banner-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  .banner-cta {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    font-weight: 700;
    border-radius: var(--radius-full);
    box-shadow: 0 4px 12px rgba(106, 32, 55, 0.25);
  }

  .banner-later {
    font-size: 0.82rem;
    color: var(--text-muted);
    padding: 6px 10px;
  }

  .banner-later:hover {
    color: var(--text-main);
  }

  .navbar-pointer {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
    padding: 5px 10px;
    border-radius: 8px;
    background: rgba(201, 169, 110, 0.12);
    border: 1px dashed rgba(201, 169, 110, 0.4);
    font-size: 0.78rem;
    color: #5c4308;
  }

  .pointer-arrow {
    display: inline-block;
    font-size: 1.05rem;
    font-weight: 800;
    color: var(--wine);
    animation: floatArrow 1.5s infinite ease-in-out;
  }

  .pointer-text strong {
    color: var(--wine);
  }

  @keyframes bannerSlideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes pulseIcon {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.06); }
  }

  @keyframes floatArrow {
    0%, 100% { transform: translate(0, 0); }
    50% { transform: translate(3px, -3px); }
  }

  @media (max-width: 480px) {
    .account-prompt-banner {
      margin: 8px 10px 14px;
      padding: 14px;
    }
    .banner-icon-wrap {
      width: 38px;
      height: 38px;
    }
    .banner-title {
      font-size: 1.02rem;
    }
  }
</style>
