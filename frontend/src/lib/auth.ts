import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { api } from "./api";
import { isNativeApp } from "./platform";

export const SERVER_ORIGIN = "https://mitfahren.stocksee.de";
export const NATIVE_ENTRY_PATH = "/index.html";
export const AUTH_SCHEME = "de.stocksee.mitfahrbank";

const OAUTH_PENDING_KEY = "mitfahrbank_oauth_pending";
const AUTH_TOKEN_HANDLED_KEY = "mitfahrbank_auth_token_handled";

type AuthCompleteListener = () => void;
const authCompleteListeners = new Set<AuthCompleteListener>();

export function onNativeAuthComplete(listener: AuthCompleteListener): () => void {
  authCompleteListeners.add(listener);
  return () => authCompleteListeners.delete(listener);
}

function notifyAuthComplete(): void {
  for (const listener of authCompleteListeners) {
    listener();
  }
}

export function markOAuthPending(): void {
  sessionStorage.setItem(OAUTH_PENDING_KEY, String(Date.now()));
}

export function clearOAuthPending(): void {
  sessionStorage.removeItem(OAUTH_PENDING_KEY);
}

export function isOAuthPending(): boolean {
  const started = sessionStorage.getItem(OAUTH_PENDING_KEY);
  if (!started) return false;
  if (Date.now() - Number(started) > 10 * 60 * 1000) {
    clearOAuthPending();
    return false;
  }
  return true;
}

export function clearNativeAuthStorage(): void {
  clearOAuthPending();
  sessionStorage.removeItem(AUTH_TOKEN_HANDLED_KEY);
}

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

async function exchangeMobileToken(token: string): Promise<boolean> {
  if (sessionStorage.getItem(AUTH_TOKEN_HANDLED_KEY) === token) {
    try {
      await api.me();
      return true;
    } catch {
      return false;
    }
  }

  sessionStorage.setItem(AUTH_TOKEN_HANDLED_KEY, token);

  try {
    await api.mobileExchange(token);
    return true;
  } catch {
    try {
      await api.me();
      return true;
    } catch {
      sessionStorage.removeItem(AUTH_TOKEN_HANDLED_KEY);
      return false;
    }
  }
}

/** Deep-Link nach Browser-Login: Token tauschen, Session behalten (kein Reload). */
export async function handleAuthDeepLink(url: string): Promise<boolean> {
  if (!isNativeApp() || !isAuthSuccessUrl(url)) return false;

  const token = new URL(url).searchParams.get("token");
  if (!token) return false;

  try {
    await Browser.close();
  } catch {
    /* Browser war bereits geschlossen */
  }

  const ok = await exchangeMobileToken(token);
  clearOAuthPending();

  if (!ok) return false;

  notifyAuthComplete();
  return true;
}

export async function initNativeAuthListener(): Promise<void> {
  if (!isNativeApp()) return;

  await App.addListener("appUrlOpen", ({ url }) => {
    void handleAuthDeepLink(url);
  });

  const launch = await App.getLaunchUrl();
  if (launch?.url) {
    await handleAuthDeepLink(launch.url);
  }
}

export async function startLogin(): Promise<void> {
  if (isNativeApp()) {
    markOAuthPending();
    await Browser.open({
      url: `${SERVER_ORIGIN}/auth/login?native=1&browser=1`,
    });
    return;
  }
  window.location.href = "/auth/login";
}
