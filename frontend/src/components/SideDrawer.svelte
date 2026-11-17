<script>
  // Menu laterale da destra, uguale in tutte le pagine (sito e gioco).
  // Le voci si scrivono con DrawerItem; toccarne una chiude il menu.
  let { open = $bindable(false), title, subtitle = '', children } = $props();

  let panel = $state();
  let returnFocus = null;

  const close = () => (open = false);

  // Blocca lo scroll della pagina sotto e sposta il focus nel menu; alla chiusura lo restituisce
  $effect(() => {
    if (!open) return;
    returnFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    panel?.querySelector('button')?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = '';
      returnFocus?.focus?.({ preventScroll: true });
    };
  });

  // Si chiude anche cambiando pagina (es. tasto indietro)
  $effect(() => {
    const onPop = () => close();
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  });
</script>

<svelte:window onkeydown={(e) => { if (open && e.key === 'Escape') close(); }} />

<button class="drawer-backdrop" class:open onclick={close} aria-label="Chiudi menu" tabindex="-1"></button>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<aside
  bind:this={panel}
  class="side-drawer"
  class:open
  role="dialog"
  aria-modal="true"
  aria-label={title}
  inert={!open}
  onclick={(e) => { if (e.target.closest('[data-drawer-item]')) close(); }}
>
  <div class="drawer-head">
    <span class="drawer-logo" aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="5"></circle><circle cx="15" cy="12" r="5"></circle></svg>
    </span>
    <span class="drawer-title font-serif">{title}</span>
    {#if subtitle}<span class="drawer-sub">{subtitle}</span>{/if}
    <button class="drawer-close" onclick={close} aria-label="Chiudi menu">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </button>
  </div>

  <nav class="drawer-items">
    {@render children()}
  </nav>
</aside>

<style>
  .drawer-backdrop {
    position: fixed;
    inset: 0;
    z-index: 900;
    border: 0;
    padding: 0;
    background: rgba(20, 6, 12, 0.6);
    backdrop-filter: blur(4px);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.35s ease;
  }

  .drawer-backdrop.open {
    opacity: 1;
    pointer-events: auto;
  }

  .side-drawer {
    position: fixed;
    top: 0;
    right: 0;
    z-index: 901;
    display: flex;
    flex-direction: column;
    width: min(88vw, 360px);
    height: 100vh;
    height: 100dvh;
    padding: env(safe-area-inset-top) 16px calc(24px + env(safe-area-inset-bottom));
    overflow-y: auto;
    color: #fff;
    /* tinta unita come la navbar del gioco */
    background: var(--wine);
    border-radius: 28px 0 0 28px;
    box-shadow: -24px 0 60px rgba(36, 18, 26, 0.28);
    transform: translateX(105%);
    visibility: hidden;
    transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), visibility 0s linear 0.4s;
  }

  .side-drawer.open {
    transform: none;
    visibility: visible;
    transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), visibility 0s;
  }

  .drawer-head {
    display: grid;
    grid-template-columns: auto 1fr auto;
    column-gap: 14px;
    align-items: center;
    padding: 20px 0 18px 4px;
    margin-bottom: 10px;
    border-bottom: 1px solid rgba(240, 216, 168, 0.28);
  }

  .drawer-logo {
    grid-row: span 2;
    display: grid;
    place-items: center;
    width: 46px;
    height: 46px;
    border-radius: 14px;
    color: var(--wine-deep);
    background: linear-gradient(145deg, #fbefcf, #d9b46f);
  }

  .drawer-title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--fs-lg);
    font-weight: 700;
    line-height: 1.15;
  }

  .drawer-sub {
    grid-column: 2;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--fs-xs);
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #f0d8a8;
  }

  .drawer-close {
    grid-column: 3;
    grid-row: 1 / span 2;
    display: grid;
    place-items: center;
    width: var(--control-md);
    height: var(--control-md);
    border: 1px solid rgba(240, 216, 168, 0.3);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    cursor: pointer;
  }

  .drawer-close:focus-visible {
    outline: 2px solid var(--gold-bright);
    outline-offset: 2px;
  }

  .drawer-items {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* le voci entrano in sequenza dopo il pannello */
  .drawer-items > :global(*) {
    opacity: 0;
    transform: translateX(18px);
    transition: opacity 0.3s ease, transform 0.4s ease;
  }

  .open .drawer-items > :global(*) {
    opacity: 1;
    transform: none;
  }

  .open .drawer-items > :global(:nth-child(2)) { transition-delay: 0.05s; }
  .open .drawer-items > :global(:nth-child(3)) { transition-delay: 0.1s; }
  .open .drawer-items > :global(:nth-child(4)) { transition-delay: 0.15s; }
  .open .drawer-items > :global(:nth-child(n + 5)) { transition-delay: 0.2s; }

  @media (prefers-reduced-motion: reduce) {
    .side-drawer,
    .drawer-items > :global(*) {
      transition: none;
    }
  }
</style>
