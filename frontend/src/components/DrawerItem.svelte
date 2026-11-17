<script>
  // Voce del menu laterale: icona dorata, testo e freccia.
  // variant: 'cta' = azione principale (dorata), 'danger' = Logout (in fondo al menu).
  // icon: contenuto SVG (path) di un'icona 24x24 a tratto.
  let { label, icon = '', onclick, active = false, variant = '' } = $props();
</script>

<button class="drawer-item {variant}" class:active {onclick} data-drawer-item>
  {#if icon}
    <svg class="item-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{@html icon}</svg>
  {/if}
  <span class="item-label">{label}</span>
  <svg class="item-chev" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
</button>

<style>
  .drawer-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 52px;
    padding: 0 12px;
    border: 1px solid rgba(240, 216, 168, 0.2);
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    font-family: var(--font-sans);
    font-size: var(--fs-md);
    font-weight: 700;
    text-align: left;
    cursor: pointer;
    transition: background 0.15s ease, transform 0.15s ease;
  }

  .drawer-item:hover {
    background: rgba(255, 255, 255, 0.13);
  }

  .drawer-item:active {
    transform: scale(0.98);
  }

  .drawer-item:focus-visible {
    outline: 2px solid var(--gold-bright);
    outline-offset: 2px;
  }

  .drawer-item.active {
    background: rgba(240, 216, 168, 0.18);
    border-color: rgba(240, 216, 168, 0.5);
  }

  .item-icon {
    flex: 0 0 auto;
    box-sizing: content-box;
    padding: 7px;
    border-radius: 10px;
    color: var(--wine-deep);
    background: linear-gradient(145deg, #fbefcf, #e3c07e);
  }

  .item-label {
    flex: 1;
    min-width: 0;
  }

  .item-chev {
    flex: 0 0 auto;
    color: rgba(240, 216, 168, 0.7);
  }

  /* azione principale: stessa forma delle altre voci, ma dorata */
  .cta {
    border-color: transparent;
    color: var(--wine-deep);
    background: linear-gradient(145deg, #fbefcf, #e3c07e);
  }

  .cta:hover {
    background: linear-gradient(145deg, #fff4d8, #e9c98a);
  }

  .cta .item-icon {
    color: #f0d8a8;
    background: var(--wine);
  }

  .cta .item-chev {
    color: var(--wine);
  }

  /* Logout sta sempre in fondo al menu */
  .danger {
    margin-top: auto;
    color: #ffc9c9;
  }

  .danger .item-icon {
    color: #fff;
    background: rgba(255, 255, 255, 0.14);
  }
</style>
