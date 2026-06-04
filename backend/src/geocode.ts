const NOMINATIM = "https://nominatim.openstreetmap.org";
const USER_AGENT = "Mitfahrbank/1.0 (community ride-sharing)";
const MAX_ADDRESS_DISTANCE_M = 30;

type NominatimResult = {
  display_name: string;
  lat: string;
  lon: string;
};

type NominatimAddress = Record<string, string>;

type NominatimReverseResult = {
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddress;
};

export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function formatCoordinates(lat: number, lon: number): string {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

function formatShortAddress(address: NominatimAddress): string | null {
  const street =
    address.road ??
    address.pedestrian ??
    address.footway ??
    address.residential;
  const house = address.house_number;
  const place =
    address.village ??
    address.town ??
    address.city ??
    address.municipality ??
    address.hamlet ??
    address.suburb;
  const postcode = address.postcode;

  if (!street && !place) return null;

  const streetLine = street
    ? house
      ? `${street} ${house}`
      : street
    : null;

  if (streetLine && place) {
    return postcode
      ? `${streetLine}, ${postcode} ${place}`
      : `${streetLine}, ${place}`;
  }

  if (streetLine) return streetLine;
  if (place) return postcode ? `${postcode} ${place}` : place;
  return null;
}

async function nominatimFetch(url: URL): Promise<Response> {
  return fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
}

export async function searchPlaces(
  query: string,
  limit = 6,
): Promise<{ label: string; lat: number; lon: number }[]> {
  const url = new URL(`${NOMINATIM}/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("countrycodes", "de");
  url.searchParams.set("addressdetails", "1");

  const res = await nominatimFetch(url);
  if (!res.ok) throw new Error("Geocoding failed");

  const data = (await res.json()) as NominatimReverseResult[];
  return data.map((r) => ({
    label: formatShortAddress(r.address ?? {}) ?? shortenDisplayName(r.display_name),
    lat: Number(r.lat),
    lon: Number(r.lon),
  }));
}

function shortenDisplayName(displayName: string): string {
  const parts = displayName.split(",").map((p) => p.trim());
  return parts.slice(0, 2).join(", ");
}

export async function reverseGeocode(
  lat: number,
  lon: number,
  maxDistanceM = MAX_ADDRESS_DISTANCE_M,
): Promise<{ label: string; fromAddress: boolean }> {
  const url = new URL(`${NOMINATIM}/reverse`);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", "18");

  const res = await nominatimFetch(url);
  if (!res.ok) throw new Error("Reverse geocoding failed");

  const data = (await res.json()) as NominatimReverseResult;
  const resultLat = Number(data.lat);
  const resultLon = Number(data.lon);

  if (!Number.isFinite(resultLat) || !Number.isFinite(resultLon)) {
    return { label: formatCoordinates(lat, lon), fromAddress: false };
  }

  const distance = haversineMeters(lat, lon, resultLat, resultLon);
  if (distance > maxDistanceM) {
    return { label: formatCoordinates(lat, lon), fromAddress: false };
  }

  const short =
    formatShortAddress(data.address ?? {}) ??
    shortenDisplayName(data.display_name);

  if (!short) {
    return { label: formatCoordinates(lat, lon), fromAddress: false };
  }

  return { label: short, fromAddress: true };
}
