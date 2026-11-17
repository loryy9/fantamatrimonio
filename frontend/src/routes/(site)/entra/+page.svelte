<script>
  import { tick } from 'svelte';
  import { appState } from '#lib/state.svelte.js';
  import LoginView from '#components/LoginView.svelte';
  import SecureLoginView from '#components/SecureLoginView.svelte';

  // Dopo la registrazione/accesso fatti qui si passa al form del codice: si riparte dall'alto.
  let hadAccount = appState.hasAccount;
  $effect(() => {
    const hasAccount = appState.hasAccount;
    if (hasAccount && !hadAccount) {
      const toTop = () => window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      toTop();
      tick().then(toTop);
    }
    hadAccount = hasAccount;
  });
</script>

<main class="site-main">
  {#if appState.hasAccount}
    <LoginView />
  {:else}
    <!-- Senza account: registrazione con il codice del matrimonio (oppure accesso) -->
    <SecureLoginView embedded joinMode initialMode="register" intro />
  {/if}
</main>
