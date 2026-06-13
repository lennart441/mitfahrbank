import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { api } from "./api";
import { isNativeApp } from "./platform";

export const SERVER_ORIGIN = "https://mitfahren.stocksee.de";
export const NATIVE_ENTRY_PATH = "/index.html";
export const AUTH_SCHEME = "de.stocksee.mitfahrbank";

/** Nach OAuth lokales Bundle laden (verhindert weißen Screen). */
export function normalizeNativeEntryUrl(): boolean {
  if (!isNativeApp()) return false;
  if (window.location.pathname === "/") {
    window.location.replace(NATIVE_ENTRY_PATH);
    return true;
  }
  return false;
}

function isAuthSuccessUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === `${AUTH_SCHEME}:` &&
      parsed.hostname === "auth" &&
      parsed.pathname === "/success" &&
      Boolean(parsed.searchParams.get("token"))
    );
  } catch {
    return false;
  }
}

/** Deep-Link nach Browser-Login: Token tauschen und App neu laden. */
export async function handleAuthDeepLink(url: string): Promise<boolean> {
  if (!isNativeApp() || !isAuthSuccessUrl(url)) return false;

  const token = new URL(url).searchParams.get("token");
  if (!token) return false;

  try {
    await Browser.close();
  } catch {
    /* Browser war bereits geschlossen */
  }

  await api.mobileExchange(token);
  window.location.replace(NATIVE_ENTRY_PATH);
  return true;
}

export async function initNativeAuthListener(): Promise<void> {
  if (!isNativeApp()) return;

  const launch = await App.getLaunchUrl();
  if (launch?.url && (await handleAuthDeepLink(launch.url))) {
    return;
  }

  await App.addListener("appUrlOpen", ({ url }) => {
    void handleAuthDeepLink(url);
  });
}

export async function startLogin(): Promise<void> {
  if (isNativeApp()) {
    await Browser.open({
      url: `${SERVER_ORIGIN}/auth/login?native=1&browser=1`,
    });
    return;
  }
  window.location.href = "/auth/login";
}
