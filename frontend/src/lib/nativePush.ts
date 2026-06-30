import { Capacitor } from "@capacitor/core";
import { FirebaseMessaging } from "@capacitor-firebase/messaging";
import { PushNotifications } from "@capacitor/push-notifications";
import { api } from "./api";
import { isAndroid, isIOS, isNativeApp } from "./platform";

export function nativePushSupported(): boolean {
  return isNativeApp() && (isAndroid() || isIOS());
}

function openNotificationUrl(data: { url?: string } | undefined): void {
  const url = data?.url ?? "/";
  if (url.startsWith("/")) {
    window.location.href = url;
  }
}

export async function initNativePushListeners(): Promise<void> {
  if (!nativePushSupported()) return;

  if (isIOS()) {
    await FirebaseMessaging.addListener("notificationActionPerformed", (event) => {
      openNotificationUrl(event.notification.data as { url?: string } | undefined);
    });
    return;
  }

  await PushNotifications.addListener("pushNotificationReceived", (notification) => {
    console.info("FCM push received:", notification.title, notification.body);
  });

  await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    openNotificationUrl(action.notification.data as { url?: string } | undefined);
  });
}

async function requestNativePushPermission(): Promise<boolean> {
  if (isIOS()) {
    const perm = await FirebaseMessaging.requestPermissions();
    return perm.receive === "granted";
  }

  const current = await PushNotifications.checkPermissions();
  const perm =
    current.receive === "prompt"
      ? await PushNotifications.requestPermissions()
      : current;
  return perm.receive === "granted";
}

async function uploadFcmToken(): Promise<boolean> {
  try {
    const { token } = await FirebaseMessaging.getToken();
    await api.fcmSubscribe({
      token,
      platform: Capacitor.getPlatform(),
    });
    return true;
  } catch (err) {
    console.warn("FCM token upload failed:", err);
    return false;
  }
}

export async function subscribeNativePush(): Promise<boolean> {
  if (!nativePushSupported()) return false;
  if (!(await requestNativePushPermission())) return false;
  return uploadFcmToken();
}

/** Request permission and upload FCM token after login or app resume. */
export async function ensureNativePushRegistration(): Promise<void> {
  if (!nativePushSupported()) return;
  await subscribeNativePush();
}

export async function unsubscribeNativePush(): Promise<void> {
  if (!nativePushSupported()) return;
  if (isIOS()) {
    await FirebaseMessaging.deleteToken();
  }
  await api.fcmUnsubscribe();
}
