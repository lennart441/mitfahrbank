<script lang="ts">
  import { onMount } from "svelte";
  import RideSummaryCard from "../lib/RideSummaryCard.svelte";
  import RideDetailPanel from "../lib/RideDetailPanel.svelte";
  import RideArchive from "../lib/RideArchive.svelte";
  import { api, type RideRequest } from "../lib/api";

  let { refreshKey = 0 }: { refreshKey?: number } = $props();

  let rides = $state<RideRequest[]>([]);
  let archivedRides = $state<RideRequest[]>([]);
  let showArchive = $state(false);
  let loading = $state(true);
  let error = $state("");
  let claimingId = $state<number | null>(null);
  let selectedRideId = $state<number | null>(null);

  async function load() {
    loading = true;
    try {
      const [active, archived] = await Promise.all([
        api.rides({ role: "driver" }),
        api.rides({ role: "driver", archive: true }),
      ]);
      rides = active;
      archivedRides = archived;
      if (selectedRideId != null && !active.some((r) => r.id === selectedRideId)) {
        selectedRideId = null;
      }
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
    selectedRideId = null;
    await load();
  }

  const selectedRide = $derived(
    selectedRideId != null ? rides.find((r) => r.id === selectedRideId) : null,
  );
</script>

<header class="page-header">
  <h2>Fahrer-Übersicht</h2>
  <p class="page-lead">Karte, Chat und Anruf — Push-Benachrichtigungen im Profil (App installieren).</p>
</header>

{#if error}
  <div class="alert alert-error" role="alert">{error}</div>
{/if}

{#if selectedRide}
  <RideDetailPanel
    ride={selectedRide}
    variant="driver"
    {refreshKey}
    {claimingId}
    onBack={() => (selectedRideId = null)}
    onClaim={claim}
    onComplete={complete}
  />
{:else if loading}
  <p class="spinner-text">Fahrten werden geladen …</p>
{:else if rides.length === 0}
  <div class="empty-state">
    <p><strong>Keine offenen Anfragen</strong></p>
    <p>Sobald jemand eine Fahrt sucht, erscheint sie hier.</p>
  </div>
{:else}
  <div class="card-grid card-grid--2">
    {#each rides as ride}
      <RideSummaryCard
        {ride}
        variant="driver"
        onShowDetails={(id) => (selectedRideId = id)}
      />
    {/each}
  </div>
{/if}

{#if archivedRides.length > 0 && selectedRideId == null}
  <details class="panel archive-panel" style="margin-top:2rem" bind:open={showArchive}>
    <summary>
      Archiv ({archivedRides.length} abgeschlossene Mitfahrten)
    </summary>
    <RideArchive rides={archivedRides} variant="driver" />
  </details>
{/if}
