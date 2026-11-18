<script>
  import { useLiveTopics } from '#lib/live.svelte.js';
  import QuizView from '#components/QuizView.svelte';

  useLiveTopics(['challenges']);
</script>

<QuizView />
