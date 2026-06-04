<script lang="ts">
  import { onMount } from "svelte";
  import OsmMap from "../lib/OsmMap.svelte";
  import RideArchive from "../lib/RideArchive.svelte";
  import RideChat from "../lib/RideChat.svelte";
  import { api, mapsLink, type RideRequest } from "../lib/api";

  let { refreshKey = 0 }: { refreshKey?: number } = $props();

  let rides = $state<RideRequest[]>([]);
  let archivedRides = $state<RideRequest[]>([]);
  let showArchive = $state(false);
  let loading = $state(true);
  let error = $state("");
  let claimingId = $state<number | null>(null);

  async function load() {
    loading = true;
    try {
      const [active, archived] = await Promise.all([
        api.rides({ role: "driver" }),
        api.rides({ role: "driver", archive: true }),
      ]);
      rides = active;
      archivedRides = archived;
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

<header class="page-header">
  <h2>Fahrer-Übersicht</h2>
  <p class="page-lead">Karte, Chat und Anruf — Push-Benachrichtigungen im Profil einrichten.</p>
</header>

{#if error}
  <div class="alert alert-error" role="alert">{error}</div>
{/if}

{#if loading}
  <p class="spinner-text">Fahrten werden geladen …</p>
{:else if rides.length === 0}
  <div class="empty-state">
    <p><strong>Keine offenen Anfragen</strong></p>
    <p>Sobald jemand eine Fahrt sucht, erscheint sie hier.</p>
  </div>
{:else}
  <div class="card-grid card-grid--2">
    {#each rides as ride}
      <article class="card">
        <p class="card-title">{ride.destination}</p>
        <p style="margin:0.25rem 0 0.75rem;color:var(--text-secondary)">
          Suchende/r: <strong>{ride.seeker_name}</strong>
        </p>
        <span class="badge {ride.status === 'waiting' ? 'badge-waiting' : 'badge-driving'}">
          {ride.status === "waiting" ? "Wartet" : "Unterwegs"}
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
            href={mapsLink(ride.dest_lat!, ride.dest_lon!)}
            target="_blank"
            rel="noopener"
          >
            Route in Karte öffnen
          </a>
        {/if}

        {#if ride.status === "waiting"}
          <button
            type="button"
            class="btn btn-primary"
            style="margin-top:1rem"
            disabled={claimingId === ride.id}
            onclick={() => claim(ride.id)}
          >
            {claimingId === ride.id ? "Wird übernommen …" : "Fahrt übernehmen"}
          </button>
          <RideChat rideId={ride.id} {refreshKey} />
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
          <RideChat rideId={ride.id} {refreshKey} />
          <button
            type="button"
            class="btn btn-secondary"
            style="margin-top:0.65rem"
            onclick={() => complete(ride.id)}
          >
            Fahrt abschließen
          </button>
        {/if}
      </article>
    {/each}
  </div>
{/if}

{#if archivedRides.length > 0}
  <details class="panel archive-panel" style="margin-top:2rem" bind:open={showArchive}>
    <summary>
      Archiv ({archivedRides.length} abgeschlossene Mitfahrten)
    </summary>
    <RideArchive rides={archivedRides} variant="driver" />
  </details>
{/if}
