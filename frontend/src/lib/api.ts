import { ApiError } from "./errors";
import { isAndroid, isIOS } from "./platform";

export type User = {
  id: string;
  name: string;
  phone_number: string | null;
  is_phone_public: boolean;
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

export type DestinationPreset = {
  id: string;
  label: string;
  address: string;
  lat: number;
  lon: number;
};

export type MapConfig = {
  defaultLat: number;
  defaultLon: number;
  defaultZoom: number;
};

export type RideRequest = {
  id: number;
  user_id: string;
  destination: string;
  dest_lat: number | null;
  dest_lon: number | null;
  status: string;
  driver_id: string | null;
  archived_at?: string | null;
  seeker_name?: string;
  seeker_phone?: string | null;
  seeker_phone_public?: boolean;
  driver_name?: string | null;
  driver_phone?: string | null;
  driver_phone_public?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ChatMessage = {
  id: number;
  sender_id: string;
  sender_name: string;
  body: string;
  created_at: string;
};

export type ShoppingRequest = {
  id: number;
  creator_id: string;
  helper_id: string | null;
  store_name: string | null;
  items: string;
  status: string;
  creator_name?: string;
  helper_name?: string | null;
  creator_phone?: string | null;
  creator_phone_public?: boolean;
  helper_phone?: string | null;
  helper_phone_public?: boolean;
  created_at?: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      credentials: "include",
      headers,
    });
  } catch {
    throw new ApiError("Netzwerkfehler", "network");
  }

  if (res.status === 401) {
    unauthorizedHandler?.();
    throw new ApiError("unauthorized", "unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(
      (err as { error?: string }).error ?? res.statusText,
      "server",
    );
  }
  return res.json() as Promise<T>;
}

let unauthorizedHandler: (() => void) | null = null;

export function onUnauthorized(handler: () => void): () => void {
  unauthorizedHandler = handler;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
}

export const api = {
  me: () => request<User>("/api/me"),
  updateMe: (body: Partial<User>) =>
    request<User>("/api/me", { method: "PATCH", body: JSON.stringify(body) }),
  config: () =>
    request<{
      destinations: DestinationPreset[];
      map: MapConfig;
      push: {
        enabled: boolean;
        vapidPublicKey: string | null;
        fcmEnabled: boolean;
      };
    }>("/api/config"),
  pushSubscribe: (subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }) =>
    request<{ ok: boolean }>("/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify(subscription),
    }),
  pushUnsubscribe: (endpoint?: string) =>
    request<{ ok: boolean }>("/api/push/subscribe", {
      method: "DELETE",
      body: JSON.stringify(endpoint ? { endpoint } : {}),
    }),
  fcmSubscribe: (body: { token: string; platform: string }) =>
    request<{ ok: boolean }>("/api/push/fcm-subscribe", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  fcmUnsubscribe: (token?: string) =>
    request<{ ok: boolean }>("/api/push/fcm-subscribe", {
      method: "DELETE",
      body: JSON.stringify(token ? { token } : {}),
    }),
  geocode: (q: string) =>
    request<{ label: string; lat: number; lon: number }[]>(
      `/api/geocode?q=${encodeURIComponent(q)}`,
    ),
  reverseGeocode: (lat: number, lon: number) =>
    request<{ label: string; fromAddress: boolean }>(
      `/api/reverse-geocode?lat=${lat}&lon=${lon}`,
    ),
  createRide: (payload: {
    destination: string;
    dest_lat?: number | null;
    dest_lon?: number | null;
  }) =>
    request<RideRequest>("/api/ride-requests", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  rides: (opts?: { role?: string; mine?: boolean; archive?: boolean }) => {
    const q = new URLSearchParams();
    if (opts?.role) q.set("role", opts.role);
    if (opts?.mine) q.set("mine", "1");
    if (opts?.archive) q.set("archive", "1");
    const qs = q.toString();
    return request<RideRequest[]>(`/api/ride-requests${qs ? `?${qs}` : ""}`);
  },
  claimRide: (id: number) =>
    request<RideRequest>(`/api/ride-requests/${id}/claim`, { method: "POST" }),
  updateRide: (id: number, status: string) =>
    request<RideRequest>(`/api/ride-requests/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  chat: (contextType: string, contextId: number) =>
    request<ChatMessage[]>(`/api/chat/${contextType}/${contextId}`),
  sendChat: (contextType: string, contextId: number, body: string) =>
    request<ChatMessage>(`/api/chat/${contextType}/${contextId}`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
  shopping: () => request<ShoppingRequest[]>("/api/shopping-requests"),
  createShopping: (items: string, store_name?: string) =>
    request<ShoppingRequest>("/api/shopping-requests", {
      method: "POST",
      body: JSON.stringify({ items, store_name }),
    }),
  claimShopping: (id: number) =>
    request<ShoppingRequest>(`/api/shopping-requests/${id}/claim`, {
      method: "POST",
    }),
  doneShopping: (id: number) =>
    request<ShoppingRequest>(`/api/shopping-requests/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "done" }),
    }),
  logout: () => fetch("/auth/logout", { method: "POST", credentials: "include" }),
  mobileExchange: (token: string) =>
    request<{ ok: boolean }>("/auth/mobile-exchange", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
};

export function mapsLink(lat: number, lon: number, label?: string) {
  if (isIOS()) return `maps://?daddr=${lat},${lon}`;
  if (isAndroid()) {
    const q = label ? `${lat},${lon}(${encodeURIComponent(label)})` : `${lat},${lon}`;
    return `geo:${lat},${lon}?q=${q}`;
  }
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`;
}

export function mapsLinkLabel() {
  if (isIOS() || isAndroid()) return "In Karten-App öffnen";
  return "In OpenStreetMap öffnen";
}

export function mapsLinkExternal() {
  return isIOS() || isAndroid();
}
