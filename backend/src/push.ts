import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import webpush from "web-push";
import { config } from "./config.js";
import { pool } from "./db.js";
import { haversineMeters } from "./geocode.js";
import { destinationPresets } from "./destinations.js";

export type PushSubscriptionRow = {
  id: number;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type FcmTokenRow = {
  id: number;
  user_id: string;
  token: string;
  platform: string;
};

export type DriverNotifyPrefs = {
  id: string;
  is_driver_notify: boolean;
  notify_all_destinations: boolean;
  notify_center_lat: number | null;
  notify_center_lon: number | null;
  notify_radius_km: number | null;
  notify_preset_ids: string[] | null;
  notify_time_start: string | null;
  notify_time_end: string | null;
  notify_days: number[] | null;
};

let firebaseApp: App | null = null;

function configureVapid(): boolean {
  const { publicKey, privateKey, subject } = config.push;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

function getFirebaseApp(): App | null {
  if (!config.fcm.enabled) return null;
  if (firebaseApp) return firebaseApp;

  try {
    if (config.fcm.serviceAccountBase64) {
      const json = JSON.parse(
        Buffer.from(config.fcm.serviceAccountBase64, "base64").toString("utf8"),
      );
      firebaseApp =
        getApps()[0] ??
        initializeApp({
          credential: cert(json),
        });
      console.info(`FCM initialized for project ${json.project_id}`);
    } else if (config.fcm.serviceAccountJson) {
      firebaseApp =
        getApps()[0] ??
        initializeApp({
          credential: cert(config.fcm.serviceAccountJson),
        });
      console.info("FCM initialized from service account file");
    }
  } catch (err) {
    console.warn("Firebase Admin SDK initialization failed:", err);
    return null;
  }

  return firebaseApp;
}

export function pushEnabled(): boolean {
  return config.push.enabled && Boolean(config.push.publicKey && config.push.privateKey);
}

export function fcmEnabled(): boolean {
  return config.fcm.enabled && getFirebaseApp() != null;
}

export async function upsertPushSubscription(
  userId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
): Promise<void> {
  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, endpoint) DO UPDATE
       SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
    [userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth],
  );
}

export async function deletePushSubscription(
  userId: string,
  endpoint?: string,
): Promise<void> {
  if (endpoint) {
    await pool.query(
      `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
      [userId, endpoint],
    );
  } else {
    await pool.query(`DELETE FROM push_subscriptions WHERE user_id = $1`, [userId]);
  }
}

export async function upsertFcmToken(
  userId: string,
  token: string,
  platform: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO fcm_tokens (user_id, token, platform)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, token) DO UPDATE
       SET platform = EXCLUDED.platform`,
    [userId, token, platform],
  );
}

export async function deleteFcmToken(
  userId: string,
  token?: string,
): Promise<void> {
  if (token) {
    await pool.query(
      `DELETE FROM fcm_tokens WHERE user_id = $1 AND token = $2`,
      [userId, token],
    );
  } else {
    await pool.query(`DELETE FROM fcm_tokens WHERE user_id = $1`, [userId]);
  }
}

function berlinNow(): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return { day: dayMap[weekday] ?? 1, minutes: hour * 60 + minute };
}

function parseTimeToMinutes(t: string | null): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function withinNotifySchedule(prefs: DriverNotifyPrefs): boolean {
  const days = prefs.notify_days;
  if (days && days.length > 0) {
    const { day, minutes } = berlinNow();
    if (!days.includes(day)) return false;
    const start = parseTimeToMinutes(prefs.notify_time_start);
    const end = parseTimeToMinutes(prefs.notify_time_end);
    if (start != null && end != null) {
      if (start <= end) {
        return minutes >= start && minutes < end;
      }
      return minutes >= start || minutes < end;
    }
  }
  return true;
}

function matchesDestinationRegion(
  prefs: DriverNotifyPrefs,
  destLat: number | null,
  destLon: number | null,
  destinationLabel: string,
): boolean {
  if (prefs.notify_all_destinations) return true;
  if (destLat == null || destLon == null) {
    const presetIds = prefs.notify_preset_ids ?? [];
    if (!presetIds.length) return false;
    return destinationPresets.some(
      (p) =>
        presetIds.includes(p.id) &&
        destinationLabel.toLowerCase().includes(p.label.toLowerCase()),
    );
  }

  const presetIds = prefs.notify_preset_ids ?? [];
  for (const pid of presetIds) {
    const preset = destinationPresets.find((p) => p.id === pid);
    if (preset && haversineMeters(destLat, destLon, preset.lat, preset.lon) <= 5000) {
      return true;
    }
  }

  if (
    prefs.notify_center_lat != null &&
    prefs.notify_center_lon != null &&
    prefs.notify_radius_km != null &&
    prefs.notify_radius_km > 0
  ) {
    const radiusM = prefs.notify_radius_km * 1000;
    return (
      haversineMeters(
        destLat,
        destLon,
        prefs.notify_center_lat,
        prefs.notify_center_lon,
      ) <= radiusM
    );
  }

  return false;
}

async function getEligibleDrivers(
  destLat: number | null,
  destLon: number | null,
  destinationLabel: string,
  excludeUserId: string,
): Promise<DriverNotifyPrefs[]> {
  const { rows: drivers } = await pool.query<DriverNotifyPrefs>(
    `SELECT id, is_driver_notify, notify_all_destinations,
            notify_center_lat, notify_center_lon, notify_radius_km,
            notify_preset_ids, notify_time_start, notify_time_end, notify_days
     FROM users
     WHERE is_driver_notify = TRUE AND id != $1`,
    [excludeUserId],
  );

  return drivers.filter(
    (d) =>
      withinNotifySchedule(d) &&
      matchesDestinationRegion(d, destLat, destLon, destinationLabel),
  );
}

export async function getSubscriptionsForRide(
  destLat: number | null,
  destLon: number | null,
  destinationLabel: string,
  excludeUserId: string,
): Promise<PushSubscriptionRow[]> {
  const eligible = await getEligibleDrivers(
    destLat,
    destLon,
    destinationLabel,
    excludeUserId,
  );
  if (!eligible.length) return [];

  const ids = eligible.map((d) => d.id);
  const { rows } = await pool.query<PushSubscriptionRow>(
    `SELECT id, user_id, endpoint, p256dh, auth
     FROM push_subscriptions WHERE user_id = ANY($1::text[])`,
    [ids],
  );
  return rows;
}

async function getFcmTokensForRide(
  destLat: number | null,
  destLon: number | null,
  destinationLabel: string,
  excludeUserId: string,
): Promise<FcmTokenRow[]> {
  const eligible = await getEligibleDrivers(
    destLat,
    destLon,
    destinationLabel,
    excludeUserId,
  );
  if (!eligible.length) return [];

  const ids = eligible.map((d) => d.id);
  const { rows } = await pool.query<FcmTokenRow>(
    `SELECT id, user_id, token, platform
     FROM fcm_tokens WHERE user_id = ANY($1::text[])`,
    [ids],
  );
  return rows;
}

async function sendWebPushNotifications(
  subs: PushSubscriptionRow[],
  title: string,
  body: string,
  url: string,
): Promise<void> {
  if (!subs.length || !pushEnabled() || !configureVapid()) return;

  const payload = JSON.stringify({ title, body, url });

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await pool.query(`DELETE FROM push_subscriptions WHERE id = $1`, [sub.id]);
        } else {
          console.warn(`Web push failed for user ${sub.user_id}:`, err);
        }
      }
    }),
  );
}

async function sendFcmNotifications(
  tokens: FcmTokenRow[],
  title: string,
  body: string,
  url: string,
): Promise<void> {
  const app = getFirebaseApp();
  if (!tokens.length || !app) return;

  await Promise.allSettled(
    tokens.map(async (row) => {
      try {
        await getMessaging(app).send({
          token: row.token,
          notification: { title, body },
          data: { url },
          android: {
            priority: "high",
            notification: { tag: "ride-request" },
          },
        });
      } catch (err: unknown) {
        const code = (err as { code?: string }).code;
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        ) {
          await pool.query(`DELETE FROM fcm_tokens WHERE id = $1`, [row.id]);
        } else {
          console.warn(`FCM failed for user ${row.user_id}:`, err);
        }
      }
    }),
  );
}

export async function notifyDrivers(
  title: string,
  body: string,
  url: string,
  destLat: number | null,
  destLon: number | null,
  destinationLabel: string,
  excludeUserId: string,
): Promise<void> {
  const [subs, fcmTokens] = await Promise.all([
    getSubscriptionsForRide(destLat, destLon, destinationLabel, excludeUserId),
    getFcmTokensForRide(destLat, destLon, destinationLabel, excludeUserId),
  ]);

  if (!subs.length && !fcmTokens.length) {
    console.info(
      `Push: no eligible drivers/tokens for "${destinationLabel}" (excluded seeker ${excludeUserId})`,
    );
    return;
  }

  console.info(
    `Push: notifying ${fcmTokens.length} FCM token(s), ${subs.length} web sub(s) for "${destinationLabel}"`,
  );

  await Promise.all([
    sendWebPushNotifications(subs, title, body, url),
    sendFcmNotifications(fcmTokens, title, body, url),
  ]);
}

/** @deprecated Use notifyDrivers */
export async function notifyDriversWebPush(
  title: string,
  body: string,
  url: string,
  destLat: number | null,
  destLon: number | null,
  destinationLabel: string,
  excludeUserId: string,
): Promise<void> {
  return notifyDrivers(
    title,
    body,
    url,
    destLat,
    destLon,
    destinationLabel,
    excludeUserId,
  );
}
