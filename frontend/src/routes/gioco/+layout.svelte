<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { appState } from '$lib/state.svelte.js';
  import Navbar from '$components/Navbar.svelte';
  import BottomNav from '$components/BottomNav.svelte';

  let { children } = $props();
  let mainContentEl = $state(null);

  // Senza una sessione di gioco attiva non si può stare in /gioco/*
  onMount(() => {
    if (!appState.user || !appState.event) {
      goto(appState.hasAccount ? '/dashboard' : '/', { replaceState: true });
    }
  });

  // Il WebSocket riceve solo i topic della pagina aperta
  $effect(() => {
    appState.setRealtimeTab(appState.activeTab);
  });

  // Scroll in cima a ogni cambio tab o sotto-tab
  $effect(() => {
    const _path = page.url.pathname;
    const _subTab = appState.quizSubTab;
    if (mainContentEl) mainContentEl.scrollTop = 0;
  });
</script>

<!-- NAVBAR FESTA BORDEAUX CON MONOGRAMMA SPOSI SOLO DENTRO AL GIOCO EFFETTIVO -->
<div class="app-wrapper">
  <Navbar />

  <main class="main-content" bind:this={mainContentEl}>
    {@render children()}
  </main>

  {#if appState.event}
    <BottomNav />
  {/if}
</div>
