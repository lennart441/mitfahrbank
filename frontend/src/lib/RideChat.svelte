<script lang="ts">
  import ContextChat from "./ContextChat.svelte";

  let {
    rideId,
    refreshKey = 0,
  }: {
    rideId: number;
    refreshKey?: number;
  } = $props();
</script>

<ContextChat contextType="ride" contextId={rideId} {refreshKey} />
