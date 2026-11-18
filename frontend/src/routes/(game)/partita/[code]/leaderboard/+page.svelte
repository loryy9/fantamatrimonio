<script>
  import { useLiveTopics } from '#lib/live.svelte.js';
  import LeaderboardView from '#components/LeaderboardView.svelte';

  useLiveTopics(['leaderboard']);
</script>

<LeaderboardView />
