import { api } from "./api";
import { isNativeApp } from "./platform";
import {
  ensureNativePushRegistration,
  nativePushSupported,
  subscribeNativePush,
  unsubscribeNativePush,
} from "./nativePush";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export async function subscribeToPush(vapidPublicKey: string): Promise<boolean> {
  if (isNativeApp()) return subscribeNativePush();

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();

  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

  await api.pushSubscribe({
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  });
  return true;
}

export async function unsubscribeFromPush(): Promise<void> {
  if (isNativeApp()) {
    await unsubscribeNativePush();
    return;
  }
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await api.pushUnsubscribe(sub.endpoint);
    await sub.unsubscribe();
  }
}

export function pushSupported(): boolean {
  if (isNativeApp()) return nativePushSupported();
  return "serviceWorker" in navigator && "PushManager" in window;
}

const NATIVE_PUSH_PROMPT_KEY = "native_push_permission_attempted";

export async function ensurePushRegistrationOnLogin(
  fcmEnabled: boolean,
  isDriverNotify: boolean,
): Promise<void> {
  if (!isNativeApp() || !fcmEnabled) return;

  const prompted = localStorage.getItem(NATIVE_PUSH_PROMPT_KEY) === "1";
  if (!prompted) {
    localStorage.setItem(NATIVE_PUSH_PROMPT_KEY, "1");
    await ensureNativePushRegistration();
    return;
  }

  if (isDriverNotify) {
    await ensureNativePushRegistration();
  }
}
