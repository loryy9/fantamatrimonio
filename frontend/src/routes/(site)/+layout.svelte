<script>
  import { page } from '$app/state';
  import { appState } from '#lib/state.svelte.js';
  import { ROUTES } from '#lib/routes.js';
  import SiteHeader from '#components/SiteHeader.svelte';

  let { children } = $props();

  // Configurazione sfide e condivisione del codice sono a tutto schermo, senza footer
  const fullscreen = $derived(!!appState.pendingInvite || page.route.id?.endsWith('/setup'));
</script>

<!-- Layout del sito: topbar bianca con logo a sinistra e menu a destra -->
<div class="site">
  <SiteHeader />

  {@render children()}

  {#if !fullscreen}
    <footer class="site-footer">
      <span>Fanta Matrimonio · Gioca, scatta, rispondi e scala la classifica</span>
      <a href={ROUTES.admin} class="admin-link-subtle">Console Admin</a>
    </footer>
  {/if}
</div>

<style>
  .site {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: #faf8f5;
  }

  /* Contenitori <main> usati dalle pagine del sito */
  :global(.site-landing) {
    flex: 1;
    width: 100%;
  }

  :global(.site-fullscreen-main) {
    flex: 1;
    width: 100%;
    padding: 0;
    margin: 0;
  }

  :global(.site-dashboard-page) {
    padding-top: 16px;
    padding-bottom: 48px;
    max-width: 1100px;
  }

  .site-footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    font-size: 0.82rem;
    color: var(--text-muted);
    padding: 24px 16px;
    text-align: center;
    border-top: 1px solid rgba(201, 169, 110, 0.18);
    background: #ffffff;
    margin-top: auto;
  }

  .admin-link-subtle {
    font-size: 0.76rem;
    color: var(--text-dim);
    text-decoration: none;
    transition: color 0.15s ease;
  }

  .admin-link-subtle:hover {
    color: var(--gold-dark);
    text-decoration: underline;
  }
</style>
