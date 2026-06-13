import type { CapacitorConfig } from "@capacitor/core";

const config: CapacitorConfig = {
  appId: "de.stocksee.mitfahrbank",
  appName: "Mitfahrbank",
  webDir: "dist",
  server: {
    hostname: "mitfahren.stocksee.de",
    androidScheme: "https",
    // SPA-Fallback würde /auth/login lokal als index.html laden — OAuth bricht dann ab.
    html5mode: false,
    allowNavigation: ["mitfahren.stocksee.de", "auth.stocksee.de"],
  },
};

export default config;
