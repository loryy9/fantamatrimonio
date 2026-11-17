<script>
  import { appState } from '#lib/state.svelte.js';
  import Navbar from '#components/Navbar.svelte';
  import BottomNav from '#components/BottomNav.svelte';
  import InstructionsModal from '#components/InstructionsModal.svelte';

  let { children } = $props();

  // Barra di stato iPhone/Safari e sfondo pagina coordinati con la navbar del gioco
  function applyGameTheme(inGame) {
    const background = inGame ? '#6a2037' : '#faf7f2';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', inGame ? '#ffffff' : '#faf7f2');
    document.documentElement.style.backgroundColor = background;
    document.body.style.backgroundColor = background;
    document.documentElement.classList.toggle('in-game-active', inGame);
  }

  $effect(() => {
    applyGameTheme(true);
    appState.startPolling();
    return () => {
      applyGameTheme(false);
      appState.stopPolling();
    };
  });
</script>

<!-- Layout del gioco: navbar bordeaux con monogramma degli sposi e tab in basso -->
<div class="game-safe-area-overlay" aria-hidden="true"></div>
<InstructionsModal />
<div class="app-wrapper">
  <Navbar />
  <main class="main-content">
    {@render children()}
  </main>
  <BottomNav />
</div>
