<script>
  import { tick } from 'svelte';
  import { appState } from '../lib/state.svelte.js';

  let confirmBtn = $state(null);
  let previousFocus = null;

  const dialog = $derived(appState.dialog);

  // Focus sul tasto principale all'apertura, poi lo restituisce all'elemento di partenza.
  $effect(() => {
    if (dialog) {
      previousFocus = document.activeElement;
      tick().then(() => confirmBtn?.focus());
    } else if (previousFocus) {
      previousFocus.focus?.();
      previousFocus = null;
    }
  });

  function close(result) {
    appState._closeDialog(result);
  }

  // In fase di capture: Esc chiude solo il dialogo e non arriva ad altri
  // handler (es. il lightbox della galleria, che altrimenti si chiuderebbe insieme).
  function handleKeydown(e) {
    if (!dialog || e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    close(false);
  }
</script>

<svelte:window onkeydowncapture={handleKeydown} />

{#if dialog}
  <div class="dialog-backdrop" onclick={() => close(false)} role="presentation">
    <div
      class="dialog"
      role={dialog.alertOnly ? 'alertdialog' : 'dialog'}
      aria-modal="true"
      aria-labelledby="fm-dialog-title"
      aria-describedby="fm-dialog-message"
      onclick={(e) => e.stopPropagation()}
      onkeydown={() => {}}
      tabindex="-1"
    >
      <h2 id="fm-dialog-title" class="dialog-title font-serif">{dialog.title}</h2>
      <p id="fm-dialog-message" class="dialog-message">{dialog.message}</p>
      <div class="dialog-actions" class:single={dialog.alertOnly}>
        {#if !dialog.alertOnly}
          <button type="button" class="dialog-btn dialog-btn-cancel" onclick={() => close(false)}>
            {dialog.cancelText}
          </button>
        {/if}
        <button
          type="button"
          class="dialog-btn dialog-btn-confirm"
          class:danger={dialog.danger}
          bind:this={confirmBtn}
          onclick={() => close(true)}
        >
          {dialog.confirmText}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .dialog-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000000; /* sopra al lightbox della galleria (999999) */
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px 16px calc(20px + var(--safe-bottom));
    background: rgba(26, 12, 20, 0.5);
    backdrop-filter: blur(3px);
    -webkit-backdrop-filter: blur(3px);
    animation: fadeIn 0.18s ease-out;
  }

  .dialog {
    width: 100%;
    max-width: 400px;
    background: var(--paper);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-card);
    box-shadow: 0 24px 60px rgba(26, 12, 20, 0.3);
    padding: 24px 22px 20px;
    animation: popIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    outline: none;
  }

  .dialog-title {
    margin: 0 0 10px;
    font-size: 1.45rem;
    font-weight: 700;
    color: var(--wine-deep);
    line-height: 1.2;
  }

  .dialog-message {
    margin: 0 0 22px;
    font-size: 0.94rem;
    line-height: 1.5;
    color: var(--text-muted);
    white-space: pre-line;
  }

  .dialog-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .dialog-actions.single {
    grid-template-columns: 1fr;
  }

  .dialog-btn {
    min-height: 46px;
    padding: 0 16px;
    border-radius: var(--radius-full);
    font-family: var(--font-sans);
    font-size: 0.92rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s ease, transform 0.1s ease;
  }

  .dialog-btn:active {
    transform: scale(0.97);
  }

  .dialog-btn:focus-visible {
    outline: 2px solid var(--wine);
    outline-offset: 2px;
  }

  .dialog-btn-cancel {
    background: var(--bg-surface-elevated);
    color: var(--text-main);
    border: 1px solid var(--border-card);
  }

  .dialog-btn-confirm {
    background: var(--wine);
    color: #fff;
    border: 1px solid var(--wine);
  }

  .dialog-btn-confirm.danger {
    background: #a63552;
    border-color: #a63552;
  }

  @media (hover: hover) {
    .dialog-btn-cancel:hover { background: #ede4dd; }
    .dialog-btn-confirm:hover { background: var(--wine-deep); }
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes popIn {
    from { opacity: 0; transform: translateY(12px) scale(0.96); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  @media (prefers-reduced-motion: reduce) {
    .dialog-backdrop, .dialog { animation: none; }
  }
</style>
