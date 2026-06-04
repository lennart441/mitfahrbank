export type DestinationPreset = {
  id: string;
  label: string;
  address: string;
  lat: number;
  lon: number;
};

/** Kurzwahl-Ziele (Holstein) – Koordinaten via OpenStreetMap/Nominatim */
export const destinationPresets: DestinationPreset[] = [
  {
    id: "bornhoved-lidl",
    label: "Lidl Bornhöved",
    address: "Kieler Tor 25, 24619 Bornhöved",
    lat: 54.0726052,
    lon: 10.2283025,
  },
  {
    id: "ascheberg-edeka",
    label: "Ascheberg Edeka / Aldi",
    address: "Langenrade 2, 24326 Ascheberg (Holstein)",
    lat: 54.1499766,
    lon: 10.3435306,
  },
  {
    id: "ploen-innenstadt",
    label: "Plön Innenstadt",
    address: "Lange Str. 9-23, 24306 Plön",
    lat: 54.1577725,
    lon: 10.4137888,
  },
];
