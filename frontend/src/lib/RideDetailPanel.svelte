<script lang="ts">
  import OsmMap from "./OsmMap.svelte";
  import DetailBackHeader from "./DetailBackHeader.svelte";
  import ContextChat from "./ContextChat.svelte";
  import { formatDateTime, rideStatusBadge, rideStatusLabel } from "./format";
  import { mapsLink, mapsLinkExternal, mapsLinkLabel, type RideRequest } from "./api";

  let {
    ride,
    variant = "driver",
    refreshKey = 0,
    claimingId = null,
    onBack,
    onClaim,
    onComplete,
    onCancel,
  }: {
    ride: RideRequest;
    variant?: "driver" | "seeker";
    refreshKey?: number;
    claimingId?: number | null;
    onBack: () => void;
    onClaim?: (id: number) => void;
    onComplete?: (id: number) => void;
    onCancel?: (id: number) => void;
  } = $props();

  function hasCoords(r: RideRequest) {
    return r.dest_lat != null && r.dest_lon != null;
  }
</script>

<section class="detail-panel">
  <DetailBackHeader title={ride.destination} {onBack} />

  <article class="card">
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

    {#if hasCoords(ride)}
      <div class="map-wrap">
        <OsmMap
          lat={ride.dest_lat!}
          lon={ride.dest_lon!}
          markerLabel={ride.destination}
          height="220px"
          interactive={ride.status === "driving"}
        />
      </div>
      <a
        class="btn btn-secondary"
        style="margin-top:0.5rem"
        href={mapsLink(ride.dest_lat!, ride.dest_lon!, ride.destination)}
        target={mapsLinkExternal() ? undefined : "_blank"}
        rel={mapsLinkExternal() ? undefined : "noopener"}
      >
        {mapsLinkLabel()}
      </a>
    {/if}

    {#if variant === "driver"}
      {#if ride.status === "waiting"}
        <button
          type="button"
          class="btn btn-primary"
          style="margin-top:1rem"
          disabled={claimingId === ride.id}
          onclick={() => onClaim?.(ride.id)}
        >
          {claimingId === ride.id ? "Wird übernommen …" : "Fahrt übernehmen"}
        </button>
      {:else if ride.status === "driving"}
        {#if ride.seeker_phone_public && ride.seeker_phone}
          <a class="btn btn-call" style="margin-top:1rem" href="tel:{ride.seeker_phone}">
            Suchende anrufen · {ride.seeker_phone}
          </a>
        {:else}
          <p style="margin-top:1rem;font-size:0.9375rem;color:var(--text-muted)">
            Telefon nicht freigegeben — bitte im Chat abstimmen.
          </p>
        {/if}
        <button
          type="button"
          class="btn btn-secondary"
          style="margin-top:0.65rem"
          onclick={() => onComplete?.(ride.id)}
        >
          Fahrt abschließen
        </button>
      {/if}
    {:else if variant === "seeker"}
      {#if ride.status === "driving"}
        {#if ride.driver_phone_public && ride.driver_phone}
          <a class="btn btn-call" style="margin-top:1rem" href="tel:{ride.driver_phone}">
            Fahrer anrufen · {ride.driver_phone}
          </a>
        {/if}
      {:else if ride.status === "waiting"}
        <button
          type="button"
          class="btn btn-secondary"
          style="margin-top:1rem"
          onclick={() => onCancel?.(ride.id)}
        >
          Anfrage abbrechen
        </button>
      {/if}
    {/if}

    <ContextChat contextType="ride" contextId={ride.id} {refreshKey} />
  </article>
</section>
