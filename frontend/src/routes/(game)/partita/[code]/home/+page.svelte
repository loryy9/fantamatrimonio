<script>
  import { useLiveTopics } from '#lib/live.svelte.js';
  import HomeView from '#components/HomeView.svelte';

  useLiveTopics(['challenges', 'leaderboard']);
</script>

<HomeView />
