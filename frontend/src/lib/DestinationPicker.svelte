<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import L from "leaflet";
  import "leaflet/dist/leaflet.css";
  import { api, type DestinationPreset, type MapConfig } from "./api";

  let {
    mapConfig,
    presets,
    onSelect,
  }: {
    mapConfig: MapConfig;
    presets: DestinationPreset[];
    onSelect: (dest: {
      label: string;
      lat: number;
      lon: number;
    }) => void;
  } = $props();

  let mode = $state<"preset" | "map">("preset");
  let searchQuery = $state("");
  let searchResults = $state<{ label: string; lat: number; lon: number }[]>(
    [],
  );
  let searching = $state(false);
  let customLabel = $state("");
  let pickLat = $state(mapConfig.defaultLat);
  let pickLon = $state(mapConfig.defaultLon);
  let mapEl: HTMLDivElement;
  let map: L.Map | undefined;
  let marker: L.Marker | undefined;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  function selectPreset(p: DestinationPreset) {
    onSelect({ label: p.label, lat: p.lat, lon: p.lon });
  }

  async function runSearch(q: string) {
    if (q.length < 3) {
      searchResults = [];
      return;
    }
    searching = true;
    try {
      searchResults = await api.geocode(q);
    } catch {
      searchResults = [];
    } finally {
      searching = false;
    }
  }

  function onSearchInput() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => runSearch(searchQuery), 400);
  }

  function applySearchResult(r: { label: string; lat: number; lon: number }) {
    customLabel = r.label.split(",").slice(0, 2).join(", ");
    pickLat = r.lat;
    pickLon = r.lon;
    searchResults = [];
    searchQuery = "";
    marker?.setLatLng([r.lat, r.lon]);
    map?.setView([r.lat, r.lon], 15);
  }

  function confirmCustom() {
    const label = customLabel.trim() || `${pickLat.toFixed(4)}, ${pickLon.toFixed(4)}`;
    onSelect({ label, lat: pickLat, lon: pickLon });
  }

  function initPickerMap() {
    if (!mapEl || map) return;
    map = L.map(mapEl, { zoomControl: true }).setView(
      [pickLat, pickLon],
      mapConfig.defaultZoom,
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    marker = L.marker([pickLat, pickLon], { draggable: true }).addTo(map);
    marker.on("dragend", () => {
      const pos = marker!.getLatLng();
      pickLat = pos.lat;
      pickLon = pos.lng;
    });
    map.on("click", (e) => {
      pickLat = e.latlng.lat;
      pickLon = e.latlng.lng;
      marker?.setLatLng(e.latlng);
    });
  }

  onMount(() => {
    if (mode === "map") initPickerMap();
  });

  $effect(() => {
    if (mode === "map") {
      setTimeout(initPickerMap, 50);
    }
  });

  onDestroy(() => {
    clearTimeout(searchTimer);
    map?.remove();
  });
</script>

{#if mode === "preset"}
  <p><strong>Kurzwahl</strong></p>
  {#each presets as p}
    <button class="touch-btn" onclick={() => selectPreset(p)}>{p.label}</button>
  {/each}
  <button class="touch-btn secondary" onclick={() => (mode = "map")}>
    Anderes Ziel auf der Karte
  </button>
{:else}
  <p><strong>Ziel auf der Karte wählen</strong></p>
  <label>
    Ort suchen (OpenStreetMap)
    <input
      type="search"
      bind:value={searchQuery}
      oninput={onSearchInput}
      placeholder="Straße, Ort …"
      autocomplete="off"
    />
  </label>
  {#if searching}<p><small>Suche …</small></p>{/if}
  {#if searchResults.length > 0}
    <ul class="search-results">
      {#each searchResults as r}
        <li>
          <button type="button" onclick={() => applySearchResult(r)}>
            {r.label}
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  <div bind:this={mapEl} class="picker-map"></div>

  <label>
    Bezeichnung (frei)
    <input
      bind:value={customLabel}
      placeholder="z. B. Meine Adresse, Arzt …"
    />
  </label>
  <p><small>Tippen Sie auf die Karte oder ziehen Sie die Markierung.</small></p>

  <button class="touch-btn" onclick={confirmCustom}>Dieses Ziel verwenden</button>
  <button class="touch-btn secondary" onclick={() => (mode = "preset")}>
    Zurück zur Kurzwahl
  </button>
{/if}

<style>
  .picker-map {
    height: 280px;
    width: 100%;
    margin: 0.75rem 0;
    border-radius: 8px;
  }
  .search-results {
    list-style: none;
    padding: 0;
    margin: 0 0 1rem;
  }
  .search-results button {
    width: 100%;
    text-align: left;
    min-height: 2.75rem;
    margin-bottom: 0.35rem;
  }
</style>
