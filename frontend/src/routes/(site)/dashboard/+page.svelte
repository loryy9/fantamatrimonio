<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { appState } from '$lib/state.svelte.js';
  import DashboardView from '$components/DashboardView.svelte';

  onMount(() => {
    if (!appState.hasAccount) {
      goto('/login', { replaceState: true });
      return;
    }
    appState.loadDashboardEvents();
  });
</script>

<main class="site-main site-dashboard-page">
  <DashboardView />
</main>
