<script>
  import { useLiveTopics } from '#lib/live.svelte.js';
  import HuntView from '#components/HuntView.svelte';

  useLiveTopics(['challenges']);
</script>

<HuntView />
