<script>
  import '../app.css';
  import { onMount } from 'svelte';
  import Toast from '#components/Toast.svelte';
  import PointsBurst from '#components/PointsBurst.svelte';
  import ConfirmDialog from '#components/ConfirmDialog.svelte';

  let { children } = $props();

  // Lo splash statico di app.html resta visibile finché la sessione non è pronta
  onMount(() => document.getElementById('splash')?.remove());
</script>

<Toast />
<PointsBurst />
<ConfirmDialog />
{@render children()}
