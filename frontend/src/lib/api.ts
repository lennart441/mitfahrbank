export type User = {
  id: string;
  name: string;
  phone_number: string | null;
  is_phone_public: boolean;
  is_driver_notify: boolean;
  ntfy_topic: string | null;
};

export type DestinationPreset = {
  label: string;
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
  seeker_name?: string;
  seeker_phone?: string | null;
  seeker_phone_public?: boolean;
  driver_name?: string | null;
  driver_phone?: string | null;
  driver_phone_public?: boolean;
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
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers,
  });
  if (res.status === 401) {
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  me: () => request<User>("/api/me"),
  updateMe: (body: Partial<User>) =>
    request<User>("/api/me", { method: "PATCH", body: JSON.stringify(body) }),
  config: () =>
    request<{
      destinations: DestinationPreset[];
      map: MapConfig;
      ntfy: { enabled: boolean };
    }>("/api/config"),
  geocode: (q: string) =>
    request<{ label: string; lat: number; lon: number }[]>(
      `/api/geocode?q=${encodeURIComponent(q)}`,
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
  rides: (opts?: { role?: string; mine?: boolean }) => {
    const q = new URLSearchParams();
    if (opts?.role) q.set("role", opts.role);
    if (opts?.mine) q.set("mine", "1");
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
};

export function connectWs(onMessage: (data: unknown) => void) {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.onmessage = (ev) => {
    try {
      onMessage(JSON.parse(ev.data));
    } catch {
      /* ignore */
    }
  };
  return ws;
}

export function mapsLink(lat: number, lon: number) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`;
}
