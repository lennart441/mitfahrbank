<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import L from "leaflet";
  import "leaflet/dist/leaflet.css";

  let {
    lat,
    lon,
    zoom = 14,
    height = "220px",
    interactive = false,
    markerLabel = "",
  }: {
    lat: number;
    lon: number;
    zoom?: number;
    height?: string;
    interactive?: boolean;
    markerLabel?: string;
  } = $props();

  let container: HTMLDivElement;
  let map: L.Map | undefined;

  const icon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });

  function initMap() {
    if (!container || map) return;
    map = L.map(container, {
      zoomControl: interactive,
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      touchZoom: interactive,
    }).setView([lat, lon], zoom);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([lat, lon], { icon }).addTo(map);
    if (markerLabel) marker.bindPopup(markerLabel);
  }

  function refresh() {
    if (!map) return;
    map.setView([lat, lon], zoom);
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) map?.removeLayer(layer);
    });
    L.marker([lat, lon], { icon }).addTo(map);
  }

  onMount(() => {
    initMap();
    refresh();
  });

  $effect(() => {
    lat;
    lon;
    zoom;
    refresh();
  });

  onDestroy(() => {
    map?.remove();
    map = undefined;
  });
</script>

<div
  bind:this={container}
  class="osm-map"
  style="height: {height}; width: 100%; border-radius: 8px;"
  role="img"
  aria-label="Karte: {markerLabel || 'Ziel'}"
></div>

<style>
  :global(.osm-map .leaflet-container) {
    font: inherit;
  }
</style>
