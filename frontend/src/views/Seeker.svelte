<script lang="ts">
  import { onMount } from "svelte";
  import DestinationPicker from "../lib/DestinationPicker.svelte";
  import OsmMap from "../lib/OsmMap.svelte";
  import RideArchive from "../lib/RideArchive.svelte";
  import RideSummaryCard from "../lib/RideSummaryCard.svelte";
  import RideDetailPanel from "../lib/RideDetailPanel.svelte";
  import DetailOverlay from "../lib/DetailOverlay.svelte";
  import {
    api,
    mapsLink,
    mapsLinkExternal,
    mapsLinkLabel,
    type DestinationPreset,
    type MapConfig,
    type RideRequest,
  } from "../lib/api";

  let {
    refreshKey = 0,
    onCreated,
  }: {
    refreshKey?: number;
    onCreated?: () => void;
  } = $props();

  let presets = $state<DestinationPreset[]>([]);
  let mapConfig = $state<MapConfig>({
    defaultLat: 54.05,
    defaultLon: 10.3,
    defaultZoom: 11,
  });
  let step = $state<"pick" | "confirm" | "done">("pick");
  let selected = $state<{
    label: string;
    lat: number;
    lon: number;
  } | null>(null);
  let myRides = $state<RideRequest[]>([]);
  let archivedRides = $state<RideRequest[]>([]);
  let showArchive = $state(false);
  let submitting = $state(false);
  let error = $state("");
  let detailError = $state("");
  let selectedRideId = $state<number | null>(null);

  async function load() {
    const [cfg, rides, archived] = await Promise.all([
      api.config(),
      api.rides(),
      api.rides({ archive: true }),
    ]);
    presets = cfg.destinations;
    mapConfig = cfg.map;
    myRides = rides;
    archivedRides = archived;
    if (selectedRideId != null && !rides.some((r) => r.id === selectedRideId)) {
      selectedRideId = null;
    }
  }

  onMount(load);
  $effect(() => {
    refreshKey;
    load();
  });

  function onDestPick(dest: { label: string; lat: number; lon: number }) {
    selected = dest;
    step = "confirm";
  }

  async function confirm() {
    if (!selected) return;
    submitting = true;
    error = "";
    try {
      await api.createRide({
        destination: selected.label,
        dest_lat: selected.lat,
        dest_lon: selected.lon,
      });
      step = "done";
      onCreated?.();
      await load();
    } catch (e) {
      error = e instanceof Error ? e.message : "Fehler";
    } finally {
      submitting = false;
    }
  }

  function reset() {
    step = "pick";
    selected = null;
    error = "";
  }

  async function cancelRide(id: number) {
    detailError = "";
    try {
      await api.updateRide(id, "cancelled");
      selectedRideId = null;
      await load();
    } catch (e) {
      detailError =
        e instanceof Error ? e.message : "Anfrage konnte nicht abgebrochen werden.";
    }
  }

  function closeDetail() {
    selectedRideId = null;
    detailError = "";
  }

  const selectedRide = $derived(
    selectedRideId != null ? myRides.find((r) => r.id === selectedRideId) : null,
  );
</script>

<header class="page-header">
  <h2>Fahrt suchen</h2>
  <p class="page-lead">Kurzwahl oder Karte — in zwei Schritten zur Anfrage.</p>
</header>

{#if step === "pick"}
  <section class="card">
    <DestinationPicker {mapConfig} {presets} onSelect={onDestPick} />
  </section>
{:else if step === "confirm" && selected}
  <section class="card">
    <p class="card-title">Ihr Ziel</p>
    <p style="font-size:1.35rem;font-weight:700;margin:0 0 1rem">{selected.label}</p>
    <div class="map-wrap">
      <OsmMap lat={selected.lat} lon={selected.lon} markerLabel={selected.label} height="min(38vh, 280px)" />
    </div>
    <p>
      <a
        href={mapsLink(selected.lat, selected.lon, selected.label)}
        target={mapsLinkExternal() ? undefined : "_blank"}
        rel={mapsLinkExternal() ? undefined : "noopener"}
      >
        {mapsLinkLabel()}
      </a>
    </p>
    {#if error}<div class="alert alert-error" role="alert">{error}</div>{/if}
    <div class="btn-row">
      <button type="button" class="btn btn-primary" disabled={submitting} onclick={confirm}>
        {submitting ? "Wird gesendet …" : "Fahrt jetzt anfragen"}
      </button>
      <button type="button" class="btn btn-secondary" onclick={reset}>Zurück</button>
    </div>
  </section>
{:else}
  <section class="card">
    <div class="alert alert-success" role="status">
      <strong>Anfrage gesendet.</strong> Registrierte Fahrer werden per Push informiert.
    </div>
    <button type="button" class="btn btn-primary" onclick={reset}>Weitere Fahrt anfragen</button>
  </section>
{/if}

{#if myRides.length > 0}
  <header class="page-header" style="margin-top:2.5rem">
    <h2>Aktuelle Fahrten</h2>
  </header>
  <div class="card-grid card-grid--2">
    {#each myRides as ride}
      <RideSummaryCard
        {ride}
        variant="seeker"
        onShowDetails={(id) => {
          detailError = "";
          selectedRideId = id;
        }}
      />
    {/each}
  </div>
{/if}

{#if selectedRide}
  <DetailOverlay title={selectedRide.destination} subtitle="Meine Fahrt" onClose={closeDetail}>
    <RideDetailPanel
      ride={selectedRide}
      variant="seeker"
      {refreshKey}
      actionError={detailError}
      onCancel={cancelRide}
    />
  </DetailOverlay>
{/if}

{#if archivedRides.length > 0 && selectedRideId == null}
  <details class="panel archive-panel" style="margin-top:2rem" bind:open={showArchive}>
    <summary>
      Archiv ({archivedRides.length} abgeschlossene oder abgebrochene Fahrten)
    </summary>
    <RideArchive rides={archivedRides} variant="seeker" />
  </details>
{/if}
