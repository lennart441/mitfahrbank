import { Capacitor } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { api } from "./api";
import { isAndroid, isIOS, isNativeApp } from "./platform";

export function nativePushSupported(): boolean {
  return isNativeApp() && (isAndroid() || isIOS());
}

export async function initNativePushListeners(): Promise<void> {
  if (!nativePushSupported()) return;

  await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const data = action.notification.data as { url?: string } | undefined;
    const url = data?.url ?? "/";
    if (url.startsWith("/")) {
      window.location.href = url;
    }
  });
}

export async function subscribeNativePush(): Promise<boolean> {
  if (!nativePushSupported()) return false;

  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") return false;

  return new Promise((resolve) => {
    let settled = false;
    let regHandle: PluginListenerHandle | null = null;
    let errHandle: PluginListenerHandle | null = null;

    const finish = async (ok: boolean) => {
      if (settled) return;
      settled = true;
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
        } catch {
          await finish(false);
        }
      });

      errHandle = await PushNotifications.addListener("registrationError", () => {
        void finish(false);
      });

      await PushNotifications.register();
    })();
  });
}

export async function unsubscribeNativePush(): Promise<void> {
  if (!nativePushSupported()) return;
  await api.fcmUnsubscribe();
}
