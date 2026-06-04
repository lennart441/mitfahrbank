<script lang="ts">
  import { onMount } from "svelte";
  import DestinationPicker from "../lib/DestinationPicker.svelte";
  import OsmMap from "../lib/OsmMap.svelte";
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
  let submitting = $state(false);
  let error = $state("");

  async function load() {
    const [cfg, rides] = await Promise.all([api.config(), api.rides()]);
    presets = cfg.destinations;
    mapConfig = cfg.map;
    myRides = rides;
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

<main>
  <h1>Fahrt suchen</h1>
  <p class="subtitle">Kurzwahl oder Karte — dann bestätigen.</p>

  {#if step === "pick"}
    <DestinationPicker
      {mapConfig}
      presets={presets}
      onSelect={onDestPick}
    />
  {:else if step === "confirm" && selected}
    <div class="card-block">
      <p>Ziel:</p>
      <p><strong style="font-size: 1.35rem">{selected.label}</strong></p>
      <OsmMap
        lat={selected.lat}
        lon={selected.lon}
        markerLabel={selected.label}
      />
      <p>
        <a href={mapsLink(selected.lat, selected.lon)} target="_blank" rel="noopener">
          In OpenStreetMap öffnen
        </a>
      </p>
    </div>
    <button class="touch-btn" disabled={submitting} onclick={confirm}>
      {submitting ? "Wird gesendet …" : "Fahrt jetzt anfragen"}
    </button>
    <button class="touch-btn secondary" onclick={reset}>Zurück</button>
    {#if error}<p role="alert">{error}</p>{/if}
  {:else}
    <div class="card-block">
      <p><strong>Ihre Anfrage wurde gesendet.</strong></p>
      <p>Registrierte Fahrer erhalten eine Push-Meldung (ntfy). Status unten.</p>
    </div>
    <button class="touch-btn" onclick={reset}>Weitere Fahrt anfragen</button>
  {/if}

  {#if myRides.length > 0}
    <h2 style="margin-top: 2rem">Meine Fahrten</h2>
    {#each myRides as ride}
      <article class="card-block">
        <p><strong>{ride.destination}</strong></p>
        <p class="status-{ride.status}">{statusLabel(ride.status)}</p>
        {#if hasCoords(ride)}
          <OsmMap
            lat={ride.dest_lat!}
            lon={ride.dest_lon!}
            markerLabel={ride.destination}
          />
        {/if}
        {#if ride.driver_name}
          <p>Fahrer: {ride.driver_name}</p>
        {/if}
        {#if ride.status === "driving"}
          {#if ride.driver_phone_public && ride.driver_phone}
            <a class="touch-btn call-btn" href="tel:{ride.driver_phone}">
              Fahrer anrufen: {ride.driver_phone}
            </a>
          {/if}
          <RideChat rideId={ride.id} {refreshKey} />
        {:else if ride.status === "waiting"}
          <RideChat rideId={ride.id} {refreshKey} />
          <button
            class="touch-btn secondary"
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
  {/if}
</main>
