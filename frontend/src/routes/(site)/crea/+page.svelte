<script>
  import { appState } from '#lib/state.svelte.js';
  import CreateEventView from '#components/CreateEventView.svelte';
</script>

<!-- Il form usa il layout normale; configurazione sfide e condivisione codice sono a tutto schermo -->
<main class={appState.pendingInvite ? 'site-fullscreen-main' : 'site-main'}>
  <CreateEventView />
</main>
