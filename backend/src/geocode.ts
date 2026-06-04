const NOMINATIM = "https://nominatim.openstreetmap.org";
const USER_AGENT = "Mitfahrbank/1.0 (community ride-sharing)";

type NominatimResult = {
  display_name: string;
  lat: string;
  lon: string;
};

export async function searchPlaces(
  query: string,
  limit = 6,
): Promise<{ label: string; lat: number; lon: number }[]> {
  const url = new URL(`${NOMINATIM}/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("countrycodes", "de");
  url.searchParams.set("addressdetails", "0");

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Geocoding failed");

  const data = (await res.json()) as NominatimResult[];
  return data.map((r) => ({
    label: r.display_name,
    lat: Number(r.lat),
    lon: Number(r.lon),
  }));
}
