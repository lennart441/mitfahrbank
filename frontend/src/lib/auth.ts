import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { api } from "./api";
import { wait } from "./network";
import { isNativeApp } from "./platform";

export const SERVER_ORIGIN = "https://mitfahren.stocksee.de";
export const NATIVE_ENTRY_PATH = "/index.html";
export const AUTH_SCHEME = "de.stocksee.mitfahrbank";

const OAUTH_PENDING_KEY = "mitfahrbank_oauth_pending";
const AUTH_TOKEN_HANDLED_KEY = "mitfahrbank_auth_token_handled";
/** Ignore browserFinished briefly after open (stale event from prior Browser.close). */
const BROWSER_OPEN_GRACE_MS = 1200;
const BROWSER_OPEN_TIMEOUT_MS = 15_000;

let oauthFlowCompleting = false;
/** -1 = opening in progress; only treat browserFinished after open resolved. */
let browserOpenedAt = -1;

type AuthCompleteListener = () => void;
const authCompleteListeners = new Set<AuthCompleteListener>();
const authCancelledListeners = new Set<AuthCompleteListener>();

export function onNativeAuthComplete(listener: AuthCompleteListener): () => void {
  authCompleteListeners.add(listener);
  return () => authCompleteListeners.delete(listener);
}

export function onNativeAuthCancelled(listener: AuthCompleteListener): () => void {
  authCancelledListeners.add(listener);
  return () => authCancelledListeners.delete(listener);
}

function notifyAuthComplete(): void {
  for (const listener of authCompleteListeners) {
    listener();
  }
}

function notifyAuthCancelled(): void {
  for (const listener of authCancelledListeners) {
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

/** Schließt einen offenen OAuth-Browser (z. B. nach Logout). */
export async function dismissNativeAuthBrowser(): Promise<void> {
  if (!isNativeApp()) return;
  browserOpenedAt = -1;
  try {
    await Browser.close();
  } catch {
    /* nothing open */
  }
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

  oauthFlowCompleting = true;
  try {
    await Browser.close();
  } catch {
    /* Browser war bereits geschlossen */
  } finally {
    oauthFlowCompleting = false;
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

  await Browser.addListener("browserFinished", () => {
    if (oauthFlowCompleting) return;
    if (!isOAuthPending()) return;
    if (browserOpenedAt < 0) return;
    if (Date.now() - browserOpenedAt < BROWSER_OPEN_GRACE_MS) return;
    clearOAuthPending();
    browserOpenedAt = -1;
    notifyAuthCancelled();
  });

  const launch = await App.getLaunchUrl();
  if (launch?.url) {
    await handleAuthDeepLink(launch.url);
  }
}

function abortOAuthFlow(): void {
  clearOAuthPending();
  browserOpenedAt = -1;
  notifyAuthCancelled();
}

async function resetBrowserBeforeOpen(): Promise<void> {
  try {
    await Browser.close();
  } catch {
    /* nothing open */
  }
  // Let Android tear down BrowserControllerActivity before re-opening.
  await wait(200);
}

export async function startLogin(): Promise<boolean> {
  if (!isNativeApp()) {
    window.location.href = "/auth/login";
    return true;
  }

  markOAuthPending();
  browserOpenedAt = -1;

  try {
    await resetBrowserBeforeOpen();
    const openPromise = Browser.open({
      url: `${SERVER_ORIGIN}/auth/login?native=1&browser=1`,
    });
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Browser open timeout")), BROWSER_OPEN_TIMEOUT_MS);
    });
    await Promise.race([openPromise, timeoutPromise]);
    browserOpenedAt = Date.now();
    return true;
  } catch {
    abortOAuthFlow();
    return false;
  }
}
