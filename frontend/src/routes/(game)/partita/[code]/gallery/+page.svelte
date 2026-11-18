<script>
  import { useLiveTopics } from '#lib/live.svelte.js';
  import GalleryView from '#components/GalleryView.svelte';

  useLiveTopics(['gallery']);
</script>

<GalleryView />
