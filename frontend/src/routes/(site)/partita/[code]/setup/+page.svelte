<script>
  import { goto } from '$app/navigation';
  import { appState } from '#lib/state.svelte.js';
  import { dashboardUrl } from '#lib/routes.js';
  import OnboardingSetup from '#components/OnboardingSetup.svelte';

  const backToDashboard = () => goto(dashboardUrl(appState.event?.id));
</script>

<main class="site-fullscreen-main">
  <OnboardingSetup
    editMode={true}
    initialChallenges={appState.setupChallenges}
    onComplete={backToDashboard}
    onCancel={backToDashboard}
  />
</main>
