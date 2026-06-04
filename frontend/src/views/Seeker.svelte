<script lang="ts">
  import { onMount } from "svelte";
  import DestinationPicker from "../lib/DestinationPicker.svelte";
  import OsmMap from "../lib/OsmMap.svelte";
  import RideArchive from "../lib/RideArchive.svelte";
  import RideChat from "../lib/RideChat.svelte";
  import {
    api,
    mapsLink,
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

  function statusBadge(s: string) {
    const map: Record<string, string> = {
      waiting: "badge-waiting",
      driving: "badge-driving",
      completed: "badge-done",
      cancelled: "badge-waiting",
    };
    return map[s] ?? "badge-waiting";
  }

  function statusLabel(s: string) {
    const map: Record<string, string> = {
      waiting: "Warte auf Fahrer",
      driving: "Fahrer unterwegs",
      completed: "Abgeschlossen",
      cancelled: "Abgebrochen",
    };
    return map[s] ?? s;
  }

  function hasCoords(ride: RideRequest) {
    return ride.dest_lat != null && ride.dest_lon != null;
  }
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
      <a href={mapsLink(selected.lat, selected.lon)} target="_blank" rel="noopener">In OpenStreetMap öffnen</a>
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
      <strong>Anfrage gesendet.</strong> Registrierte Fahrer werden per Push (ntfy) informiert.
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
      <article class="card">
        <p class="card-title">{ride.destination}</p>
        <span class="badge {statusBadge(ride.status)}">{statusLabel(ride.status)}</span>
        {#if hasCoords(ride)}
          <div class="map-wrap">
            <OsmMap lat={ride.dest_lat!} lon={ride.dest_lon!} markerLabel={ride.destination} height="200px" />
          </div>
        {/if}
        {#if ride.driver_name}
          <p style="margin-top:0.75rem;color:var(--text-secondary)">Fahrer: <strong>{ride.driver_name}</strong></p>
        {/if}
        {#if ride.status === "driving"}
          {#if ride.driver_phone_public && ride.driver_phone}
            <a class="btn btn-call" href="tel:{ride.driver_phone}" style="margin-top:1rem">
              Fahrer anrufen · {ride.driver_phone}
            </a>
          {/if}
          <RideChat rideId={ride.id} {refreshKey} />
        {:else if ride.status === "waiting"}
          <RideChat rideId={ride.id} {refreshKey} />
          <button
            type="button"
            class="btn btn-secondary"
            style="margin-top:0.75rem"
            onclick={async () => {
              await api.updateRide(ride.id, "cancelled");
              await load();
            }}
          >
            Anfrage abbrechen
          </button>
        {/if}
      </article>
    {/each}
  </div>
{/if}

{#if archivedRides.length > 0}
  <details class="panel archive-panel" style="margin-top:2rem" bind:open={showArchive}>
    <summary>
      Archiv ({archivedRides.length} abgeschlossene oder abgebrochene Fahrten)
    </summary>
    <RideArchive rides={archivedRides} variant="seeker" />
  </details>
{/if}
