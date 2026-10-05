<script>
  import { goto } from '$app/navigation';
  import AdminDashboard from '$components/AdminDashboard.svelte';
</script>

<AdminDashboard onExit={() => goto('/')} />
