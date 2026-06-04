export type DestinationPreset = {
  label: string;
  lat: number;
  lon: number;
};

/** Kurzwahl-Ziele (Holstein) – Koordinaten für Karte/Routing */
export const destinationPresets: DestinationPreset[] = [
  { label: "Bornhöved Lidl", lat: 53.8053, lon: 10.1869 },
  { label: "Plön Innenstadt", lat: 54.1624, lon: 10.4233 },
  { label: "Ascheberg Edeka / Aldi", lat: 54.1495, lon: 10.2396 },
];
