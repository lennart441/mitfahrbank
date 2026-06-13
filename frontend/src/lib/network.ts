import { Network } from "@capacitor/network";
import { isNativeApp } from "./platform";

export async function isOnline(): Promise<boolean> {
  if (isNativeApp()) {
    const status = await Network.getStatus();
    return status.connected;
  }
  return navigator.onLine;
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
