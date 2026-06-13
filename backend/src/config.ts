import "dotenv/config";
import { destinationPresets } from "./destinations.js";

export const config = {
  port: Number(process.env.PORT ?? 3000),
  publicUrl: process.env.PUBLIC_URL ?? "http://localhost:3000",
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  sessionSecret:
    process.env.SESSION_SECRET ??
    "dev-only-change-me-use-32-chars-minimum!!",
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgres://mitfahrbank:change-me@localhost:5432/mitfahrbank",
  oidc: {
    issuer: process.env.OIDC_ISSUER ?? "",
    clientId: process.env.OIDC_CLIENT_ID ?? "",
    clientSecret: process.env.OIDC_CLIENT_SECRET ?? "",
    redirectUri:
      process.env.OIDC_REDIRECT_URI ?? "http://localhost:3000/auth/callback",
  },
  destinations: destinationPresets,
  map: {
    defaultLat: Number(process.env.MAP_DEFAULT_LAT ?? 54.05),
    defaultLon: Number(process.env.MAP_DEFAULT_LON ?? 10.3),
    defaultZoom: Number(process.env.MAP_DEFAULT_ZOOM ?? 11),
  },
  push: {
    enabled: process.env.WEB_PUSH_ENABLED !== "false",
    publicKey: process.env.VAPID_PUBLIC_KEY ?? "",
    privateKey: process.env.VAPID_PRIVATE_KEY ?? "",
    subject:
      process.env.VAPID_SUBJECT ??
      "mailto:mitfahrbank@example.local",
  },
  fcm: {
    enabled: process.env.FCM_ENABLED !== "false",
    serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? "",
    serviceAccountBase64: process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ?? "",
  },
};

export function oidcConfigured(): boolean {
  return Boolean(
    config.oidc.issuer &&
      config.oidc.clientId &&
      config.oidc.clientSecret,
  );
}
