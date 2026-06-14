<script lang="ts">
  import { formatDateTime, rideStatusBadge, rideStatusLabel } from "./format";
  import type { RideRequest } from "./api";

  let {
    ride,
    variant = "driver",
    onShowDetails,
  }: {
    ride: RideRequest;
    variant?: "driver" | "seeker";
    onShowDetails: (id: number) => void;
  } = $props();
</script>

<article class="card summary-card">
  <p class="card-title">{ride.destination}</p>
  {#if variant === "driver" && ride.seeker_name}
    <p class="card-meta">Suchende/r: <strong>{ride.seeker_name}</strong></p>
  {:else if variant === "seeker" && ride.driver_name}
    <p class="card-meta">Fahrer: <strong>{ride.driver_name}</strong></p>
  {/if}
  {#if ride.created_at}
    <p class="card-meta">Anfrage: {formatDateTime(ride.created_at)}</p>
  {/if}
  <span class="badge {rideStatusBadge(ride.status)}">
    {rideStatusLabel(ride.status, variant)}
  </span>
  <button
    type="button"
    class="btn btn-secondary"
    style="margin-top:0.5rem"
    onclick={() => onShowDetails(ride.id)}
  >
    Details anzeigen
  </button>
</article>
