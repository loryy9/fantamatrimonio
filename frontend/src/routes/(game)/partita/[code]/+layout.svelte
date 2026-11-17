<script>
  import { appState } from '#lib/state.svelte.js';
  import Navbar from '#components/Navbar.svelte';
  import BottomNav from '#components/BottomNav.svelte';
  import InstructionsModal from '#components/InstructionsModal.svelte';

  let { children } = $props();

  // Punteggio e classifica live finché si è dentro il gioco
  $effect(() => {
    appState.startPolling();
    return () => appState.stopPolling();
  });

  // Barra in alto del browser (Android, Safari fino a iOS 18) dello stesso colore della navbar;
  // uscendo dal gioco torna quello del sito. iOS 26 invece legge il background-color della navbar.
  $effect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    const siteColor = meta.content;
    meta.content = getComputedStyle(document.documentElement).getPropertyValue('--wine').trim();
    return () => {
      meta.content = siteColor;
    };
  });
</script>

<!-- Layout del gioco: navbar bordeaux con monogramma degli sposi e tab in basso -->
<InstructionsModal />
<div class="app-wrapper">
  <Navbar />
  <main class="main-content">
    {@render children()}
  </main>
  <BottomNav />
</div>
