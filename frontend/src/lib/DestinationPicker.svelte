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
  let labelSearchResults = $state<{ label: string; lat: number; lon: number }[]>(
    [],
  );
  let searching = $state(false);
  let labelSearching = $state(false);
  let customLabel = $state("");
  let labelTouched = $state(false);
  let resolving = $state(false);
  let lastResolvedFromAddress = $state(false);
  let pickLat = $state(54.05);
  let pickLon = $state(10.3);
  let mapEl: HTMLDivElement;
  let map: L.Map | undefined;
  let marker: L.Marker | undefined;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let resolveTimer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    pickLat = mapConfig.defaultLat;
    pickLon = mapConfig.defaultLon;
  });

  function selectPreset(p: DestinationPreset) {
    onSelect({ label: p.label, lat: p.lat, lon: p.lon });
  }

  async function runSearch(q: string, target: "map" | "label") {
    if (q.length < 3) {
      if (target === "map") searchResults = [];
      else labelSearchResults = [];
      return;
    }
    if (target === "map") searching = true;
    else labelSearching = true;
    try {
      const results = await api.geocode(q);
      if (target === "map") searchResults = results;
      else labelSearchResults = results;
    } catch {
      if (target === "map") searchResults = [];
      else labelSearchResults = [];
    } finally {
      if (target === "map") searching = false;
      else labelSearching = false;
    }
  }

  function onSearchInput() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => runSearch(searchQuery, "map"), 400);
  }

  async function searchFromLabel() {
    const q = customLabel.trim();
    if (q.length < 3) return;
    await runSearch(q, "label");
  }

  function applySearchResult(
    r: { label: string; lat: number; lon: number },
    source: "map" | "label",
  ) {
    customLabel = r.label;
    labelTouched = true;
    lastResolvedFromAddress = true;
    pickLat = r.lat;
    pickLon = r.lon;
    if (source === "map") {
      searchResults = [];
      searchQuery = "";
    } else {
      labelSearchResults = [];
    }
    marker?.setLatLng([r.lat, r.lon]);
    map?.setView([r.lat, r.lon], 15);
  }

  function onLabelInput() {
    labelTouched = true;
    labelSearchResults = [];
  }

  async function resolveLabelForPick(lat: number, lon: number) {
    resolving = true;
    try {
      const result = await api.reverseGeocode(lat, lon);
      lastResolvedFromAddress = result.fromAddress;
      if (!labelTouched) {
        customLabel = result.label;
      }
    } catch {
      lastResolvedFromAddress = false;
      if (!labelTouched) {
        customLabel = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      }
    } finally {
      resolving = false;
    }
  }

  function scheduleResolve(lat: number, lon: number) {
    pickLat = lat;
    pickLon = lon;
    clearTimeout(resolveTimer);
    resolveTimer = setTimeout(() => resolveLabelForPick(lat, lon), 350);
  }

  function setPickPosition(lat: number, lon: number) {
    marker?.setLatLng([lat, lon]);
    scheduleResolve(lat, lon);
  }

  async function confirmCustom() {
    let label = customLabel.trim();
    if (!label) {
      const result = await api.reverseGeocode(pickLat, pickLon);
      label = result.label;
    }
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
      labelTouched = false;
      setPickPosition(pos.lat, pos.lng);
    });
    map.on("click", (e) => {
      labelTouched = false;
      setPickPosition(e.latlng.lat, e.latlng.lng);
    });

    scheduleResolve(pickLat, pickLon);
  }

  function openMapMode() {
    mode = "map";
    labelTouched = false;
    customLabel = "";
    labelSearchResults = [];
  }

  $effect(() => {
    if (mode === "map") {
      setTimeout(initPickerMap, 80);
    }
  });

  onDestroy(() => {
    clearTimeout(searchTimer);
    clearTimeout(resolveTimer);
    map?.remove();
    map = undefined;
  });
</script>

{#if mode === "preset"}
  <p class="card-title" style="margin-top:0">Wohin möchten Sie?</p>
  <div class="preset-list">
    {#each presets as p}
      <button type="button" class="btn btn-secondary preset-btn" onclick={() => selectPreset(p)}>
        <span class="preset-btn__title">{p.label}</span>
        <span class="preset-btn__addr">{p.address}</span>
      </button>
    {/each}
  </div>
  <button type="button" class="btn btn-primary" style="margin-top:0.5rem" onclick={openMapMode}>
    Anderes Ziel auf der Karte
  </button>
{:else}
  <p class="card-title" style="margin-top:0">Ziel auf der Karte</p>
  <div class="field">
    <label for="geo-search">Ort suchen (OpenStreetMap)</label>
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
          <button type="button" onclick={() => applySearchResult(r, "map")}>
            {r.label}
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  <div bind:this={mapEl} class="picker-map"></div>

  <div class="field">
    <label for="custom-label">Zielbezeichnung</label>
    <div class="btn-row" style="margin:0;align-items:stretch">
      <input
        id="custom-label"
        bind:value={customLabel}
        oninput={onLabelInput}
        placeholder={resolving ? "Adresse wird ermittelt …" : "Adresse eingeben …"}
      />
      <button
        type="button"
        class="btn btn-secondary"
        disabled={labelSearching || customLabel.trim().length < 3}
        onclick={searchFromLabel}
      >
        {labelSearching ? "…" : "OSM suchen"}
      </button>
    </div>
  </div>
  {#if labelSearchResults.length > 0}
    <p style="font-size:0.875rem;color:var(--text-secondary);margin:0 0 0.35rem">
      Treffer — bitte das richtige Ziel auswählen:
    </p>
    <ul class="search-results">
      {#each labelSearchResults as r}
        <li>
          <button type="button" onclick={() => applySearchResult(r, "label")}>
            {r.label}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  <p style="font-size:0.875rem;color:var(--text-muted);margin:0 0 1rem">
    {#if resolving}
      Adresse wird ermittelt …
    {:else if lastResolvedFromAddress}
      Adresse in der Nähe erkannt (max. 30&nbsp;m). Oder Adresse eingeben und „OSM suchen“.
    {:else if customLabel}
      Keine nahe Adresse am Kartenpunkt — Adresse eingeben und über OpenStreetMap suchen.
    {:else}
      Tippen Sie auf die Karte, ziehen Sie die Markierung, oder suchen Sie eine Adresse.
    {/if}
  </p>

  <div class="btn-row">
    <button type="button" class="btn btn-primary" disabled={resolving} onclick={confirmCustom}>
      {resolving ? "Bitte warten …" : "Dieses Ziel verwenden"}
    </button>
    <button type="button" class="btn btn-secondary" onclick={() => (mode = "preset")}>
      Zurück zur Kurzwahl
    </button>
  </div>
{/if}
