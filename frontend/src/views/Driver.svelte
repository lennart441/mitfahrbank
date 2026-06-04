<script lang="ts">
  import { onMount } from "svelte";
  import OsmMap from "../lib/OsmMap.svelte";
  import RideChat from "../lib/RideChat.svelte";
  import { api, mapsLink, type RideRequest } from "../lib/api";

  let { refreshKey = 0 }: { refreshKey?: number } = $props();

  let rides = $state<RideRequest[]>([]);
  let loading = $state(true);
  let error = $state("");
  let claimingId = $state<number | null>(null);

  async function load() {
    loading = true;
    try {
      rides = await api.rides({ role: "driver" });
    } finally {
      loading = false;
    }
  }

  onMount(load);
  $effect(() => {
    refreshKey;
    load();
  });

  async function claim(id: number) {
    error = "";
    claimingId = id;
    try {
      await api.claimRide(id);
      await load();
    } catch (e) {
      error =
        e instanceof Error ? e.message : "Fahrt konnte nicht übernommen werden.";
    } finally {
      claimingId = null;
    }
  }

  async function complete(id: number) {
    await api.updateRide(id, "completed");
    await load();
  }

  function hasCoords(ride: RideRequest) {
    return ride.dest_lat != null && ride.dest_lon != null;
  }
</script>

<main>
  <h1>Fahrer-Übersicht</h1>
  <p class="subtitle">Karte, Chat und Anruf — Push über ntfy im Profil</p>

  {#if error}
    <p role="alert">{error}</p>
  {/if}

  {#if loading}
    <p>Laden …</p>
  {:else if rides.length === 0}
    <p>Aktuell keine offenen Anfragen.</p>
  {:else}
    {#each rides as ride}
      <article class="card-block">
        <p><strong>{ride.destination}</strong></p>
        <p>Suchende/r: {ride.seeker_name}</p>
        <p class="status-{ride.status}">
          {ride.status === "waiting" ? "Wartet" : "Unterwegs"}
        </p>

        {#if hasCoords(ride)}
          <OsmMap
            lat={ride.dest_lat!}
            lon={ride.dest_lon!}
            markerLabel={ride.destination}
            interactive={ride.status === "driving"}
          />
          <p>
            <a
              href={mapsLink(ride.dest_lat!, ride.dest_lon!)}
              target="_blank"
              rel="noopener"
              class="touch-btn secondary"
              style="display:inline-block;text-align:center;margin-top:0.5rem"
            >
              Navigation in Karte öffnen
            </a>
          </p>
        {/if}

        {#if ride.status === "waiting"}
          <button
            class="touch-btn"
            disabled={claimingId === ride.id}
            onclick={() => claim(ride.id)}
          >
            {claimingId === ride.id ? "Wird übernommen …" : "Fahrt übernehmen"}
          </button>
          <RideChat rideId={ride.id} {refreshKey} />
        {:else if ride.status === "driving"}
          {#if ride.seeker_phone_public && ride.seeker_phone}
            <a class="touch-btn call-btn" href="tel:{ride.seeker_phone}">
              Suchende anrufen: {ride.seeker_phone}
            </a>
          {:else}
            <p><small>Telefonnummer nicht freigegeben — bitte im Chat abstimmen.</small></p>
          {/if}
          <RideChat rideId={ride.id} {refreshKey} />
          <button class="touch-btn secondary" onclick={() => complete(ride.id)}>
            Fahrt abschließen
          </button>
        {/if}
      </article>
    {/each}
  {/if}
</main>
