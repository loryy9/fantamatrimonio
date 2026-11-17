<script>
  import { page } from '$app/state';
  import { ROUTES } from '#lib/routes.js';
</script>

<main class="site-main error-page">
  <h1 class="font-serif">{page.status === 404 ? 'Pagina non trovata' : 'Qualcosa è andato storto'}</h1>
  <p>{page.status === 404 ? 'Il link che hai seguito non esiste più o è sbagliato.' : page.error?.message}</p>
  <a class="btn btn-primary" href={ROUTES.home}>Torna alla home</a>
</main>

<style>
  .error-page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    text-align: center;
  }

  h1 {
    color: var(--wine-deep);
    font-size: 2rem;
  }

  p {
    color: var(--text-muted);
  }
</style>
