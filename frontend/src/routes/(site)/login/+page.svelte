<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { appState } from '$lib/state.svelte.js';
  import SecureLoginView from '$components/SecureLoginView.svelte';

  // Già autenticato con un account: niente form di login
  onMount(() => {
    if (appState.hasAccount) goto('/dashboard', { replaceState: true });
  });
</script>

<main class="site-main">
  <SecureLoginView />
</main>
