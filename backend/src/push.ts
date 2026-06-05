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

function configureVapid(): boolean {
  const { publicKey, privateKey, subject } = config.push;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export function pushEnabled(): boolean {
  return config.push.enabled && Boolean(config.push.publicKey && config.push.privateKey);
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

export async function getSubscriptionsForRide(
  destLat: number | null,
  destLon: number | null,
  destinationLabel: string,
  excludeUserId: string,
): Promise<PushSubscriptionRow[]> {
  const { rows: drivers } = await pool.query<DriverNotifyPrefs>(
    `SELECT id, is_driver_notify, notify_all_destinations,
            notify_center_lat, notify_center_lon, notify_radius_km,
            notify_preset_ids, notify_time_start, notify_time_end, notify_days
     FROM users
     WHERE is_driver_notify = TRUE AND id != $1`,
    [excludeUserId],
  );

  const eligible = drivers.filter(
    (d) =>
      withinNotifySchedule(d) &&
      matchesDestinationRegion(d, destLat, destLon, destinationLabel),
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

export async function notifyDriversWebPush(
  title: string,
  body: string,
  url: string,
  destLat: number | null,
  destLon: number | null,
  destinationLabel: string,
  excludeUserId: string,
): Promise<void> {
  if (!pushEnabled() || !configureVapid()) return;

  const subs = await getSubscriptionsForRide(
    destLat,
    destLon,
    destinationLabel,
    excludeUserId,
  );
  if (!subs.length) return;

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
