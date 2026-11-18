<script>
  import { appState } from '#lib/state.svelte.js';
  import { live, bindGameHandlers, useLiveTopics } from '#lib/live.svelte.js';
  import Navbar from '#components/Navbar.svelte';
  import BottomNav from '#components/BottomNav.svelte';
  import InstructionsModal from '#components/InstructionsModal.svelte';

  let { children } = $props();

  // Aggiornamenti live finché si è dentro il gioco (topic "event": inizio partita, timer)
  $effect(() => {
    const eventId = appState.event?.id;
    if (!eventId) return;
    const unbind = bindGameHandlers();
    live.start(eventId);
    return () => {
      unbind();
      live.stop();
    };
  });
  useLiveTopics(['event']);

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
