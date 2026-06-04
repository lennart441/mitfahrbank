import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["wappen.png", "apple-touch-icon.png"],
      manifest: {
        name: "Mitfahrbank Stocksee",
        short_name: "Mitfahrbank",
        description: "Mitfahrbank und Einkaufshilfe der Gemeinde Stocksee",
        theme_color: "#1f5c2e",
        background_color: "#f6faf7",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        lang: "de",
        categories: ["social", "navigation"],
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      "/auth": "http://localhost:3000",
      "/ws": { target: "ws://localhost:3000", ws: true },
    },
  },
});
