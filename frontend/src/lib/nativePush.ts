import { Capacitor } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
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

async function subscribeIosPush(): Promise<boolean> {
  const perm = await FirebaseMessaging.requestPermissions();
  if (perm.receive !== "granted") return false;

  try {
    const { token } = await FirebaseMessaging.getToken();
    await api.fcmSubscribe({
      token,
      platform: Capacitor.getPlatform(),
    });
    return true;
  } catch {
    return false;
  }
}

async function subscribeAndroidPush(): Promise<boolean> {
  const current = await PushNotifications.checkPermissions();
  const perm =
    current.receive === "prompt"
      ? await PushNotifications.requestPermissions()
      : current;
  if (perm.receive !== "granted") return false;

  return new Promise((resolve) => {
    let settled = false;
    let regHandle: PluginListenerHandle | null = null;
    let errHandle: PluginListenerHandle | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const finish = async (ok: boolean) => {
      if (settled) return;
      settled = true;
      if (timeoutId != null) clearTimeout(timeoutId);
      await regHandle?.remove();
      await errHandle?.remove();
      resolve(ok);
    };

    void (async () => {
      regHandle = await PushNotifications.addListener("registration", async (token) => {
        try {
          await api.fcmSubscribe({
            token: token.value,
            platform: Capacitor.getPlatform(),
          });
          await finish(true);
        } catch (err) {
          console.warn("FCM token upload failed:", err);
          await finish(false);
        }
      });

      errHandle = await PushNotifications.addListener("registrationError", (err) => {
        console.warn("FCM registration error:", err);
        void finish(false);
      });

      timeoutId = setTimeout(() => {
        console.warn("FCM registration timed out");
        void finish(false);
      }, 15000);

      await PushNotifications.register();
    })();
  });
}

export async function subscribeNativePush(): Promise<boolean> {
  if (!nativePushSupported()) return false;
  if (isIOS()) return subscribeIosPush();
  return subscribeAndroidPush();
}

/** Re-register FCM token after login or when driver push was enabled earlier. */
export async function syncNativePushRegistration(): Promise<void> {
  if (!nativePushSupported()) return;
  if (isAndroid()) {
    const perm = await PushNotifications.checkPermissions();
    if (perm.receive !== "granted") return;
  }
  await subscribeNativePush();
}

export async function unsubscribeNativePush(): Promise<void> {
  if (!nativePushSupported()) return;
  if (isIOS()) {
    await FirebaseMessaging.deleteToken();
  }
  await api.fcmUnsubscribe();
}
