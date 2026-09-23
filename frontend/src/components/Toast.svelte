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
        ✕
      </button>
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    top: calc(16px + var(--safe-top));
    left: 50%;
    transform: translateX(-50%);
    width: 90%;
    max-width: 440px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
  }

  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: var(--radius-md);
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--border-subtle);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04);
    animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .toast-success {
    border-color: rgba(123, 184, 158, 0.4);
    box-shadow: 0 4px 20px rgba(123, 184, 158, 0.12);
  }

  .toast-success .toast-icon {
    color: var(--accent-emerald);
  }

  .toast-error {
    border-color: rgba(212, 132, 154, 0.4);
    box-shadow: 0 4px 20px rgba(212, 132, 154, 0.12);
  }

  .toast-error .toast-icon {
    color: var(--rose-primary);
  }

  .toast-icon {
    display: flex;
    align-items: center;
    color: var(--accent-blue);
  }

  .toast-content {
    flex: 1;
  }

  .toast-text {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-main);
  }

  .toast-points {
    font-size: 0.78rem;
    font-weight: 800;
    color: var(--gold-dark);
  }

  .toast-close {
    background: transparent;
    border: none;
    color: var(--text-dim);
    font-size: 0.9rem;
    cursor: pointer;
    padding: 4px;
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
</style>
