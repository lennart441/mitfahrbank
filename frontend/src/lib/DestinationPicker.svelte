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
  let pickLat = $state(54.05);
  let pickLon = $state(10.3);
  let mapEl: HTMLDivElement;
  let map: L.Map | undefined;
  let marker: L.Marker | undefined;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    pickLat = mapConfig.defaultLat;
    pickLon = mapConfig.defaultLon;
  });

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
    const label =
      customLabel.trim() || `${pickLat.toFixed(4)}, ${pickLon.toFixed(4)}`;
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

  $effect(() => {
    if (mode === "map") {
      setTimeout(initPickerMap, 80);
    }
  });

  onDestroy(() => {
    clearTimeout(searchTimer);
    map?.remove();
    map = undefined;
  });
</script>

{#if mode === "preset"}
  <p class="card-title" style="margin-top:0">Wohin möchten Sie?</p>
  <div class="preset-list">
    {#each presets as p}
      <button type="button" class="btn btn-secondary" onclick={() => selectPreset(p)}>
        {p.label}
      </button>
    {/each}
  </div>
  <button type="button" class="btn btn-primary" style="margin-top:0.5rem" onclick={() => (mode = "map")}>
    Anderes Ziel auf der Karte
  </button>
{:else}
  <p class="card-title" style="margin-top:0">Ziel auf der Karte</p>
  <div class="field">
    <label for="geo-search">Ort suchen</label>
    <input
      id="geo-search"
      type="search"
      bind:value={searchQuery}
      oninput={onSearchInput}
      placeholder="Straße, Ort …"
      autocomplete="off"
    />
  </div>
  {#if searching}
    <p style="color:var(--text-muted);font-size:0.875rem">Suche …</p>
  {/if}
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

  <div class="field">
    <label for="custom-label">Bezeichnung (frei)</label>
    <input
      id="custom-label"
      bind:value={customLabel}
      placeholder="z. B. Meine Adresse, Arzt …"
    />
  </div>
  <p style="font-size:0.875rem;color:var(--text-muted);margin:0 0 1rem">
    Tippen Sie auf die Karte oder ziehen Sie die Markierung.
  </p>

  <div class="btn-row">
    <button type="button" class="btn btn-primary" onclick={confirmCustom}>
      Dieses Ziel verwenden
    </button>
    <button type="button" class="btn btn-secondary" onclick={() => (mode = "preset")}>
      Zurück zur Kurzwahl
    </button>
  </div>
{/if}
