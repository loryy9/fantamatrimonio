<script>
  import { appState } from '../lib/state.svelte.js';
</script>

<div class="toast-container">
  {#each appState.toasts as toast (toast.id)}
    <div class="toast toast-{toast.type}" role="alert">
      <div class="toast-icon">
        {#if toast.type === 'success'}
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        {:else if toast.type === 'error'}
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        {/if}
      </div>
      <div class="toast-content">
        <div class="toast-text">{toast.text}</div>
        {#if toast.points}
          <div class="toast-points">+{toast.points} PT</div>
        {/if}
      </div>
      <button class="toast-close" onclick={() => appState.removeToast(toast.id)} aria-label="Chiudi">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    top: calc(14px + var(--safe-top));
    left: 50%;
    transform: translateX(-50%);
    width: calc(100% - 32px);
    max-width: 420px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    pointer-events: none;
  }

  .toast {
    pointer-events: auto;
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 10px 10px 16px;
    border-radius: 9999px;
    background: var(--wine);
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.14);
    box-shadow: 0 12px 28px rgba(74, 31, 51, 0.28), 0 2px 6px rgba(36, 28, 32, 0.12);
    animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .toast-success {
    background: #3f7a5f;
    box-shadow: 0 12px 28px rgba(63, 122, 95, 0.3), 0 2px 6px rgba(36, 28, 32, 0.12);
  }

  .toast-error {
    background: #a63552;
    box-shadow: 0 12px 28px rgba(166, 53, 82, 0.32), 0 2px 6px rgba(36, 28, 32, 0.12);
  }

  .toast-icon {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    color: #fff;
  }

  .toast-content {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px 10px;
  }

  .toast-text {
    font-size: 0.88rem;
    font-weight: 600;
    line-height: 1.3;
    color: #fff;
  }

  .toast-points {
    font-size: 0.74rem;
    font-weight: 800;
    padding: 2px 8px;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.2);
    color: #fff;
  }

  .toast-close {
    flex-shrink: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.14);
    border: none;
    border-radius: 50%;
    color: #fff;
    cursor: pointer;
    padding: 0;
  }

  @media (hover: hover) {
    .toast-close:hover {
      background: rgba(255, 255, 255, 0.28);
    }
  }

  .toast-close:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .toast {
      animation: none;
    }
  }
</style>
