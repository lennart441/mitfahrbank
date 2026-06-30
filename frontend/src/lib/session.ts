import { api, onUnauthorized } from "./api";
import type { User } from "./api";
import { isApiError } from "./errors";
import { isOnline, wait } from "./network";

export type BootstrapResult =
  | { ok: true; user: User }
  | { ok: false; reason: "offline" | "unauthorized" | "error"; message: string };

export type SessionCheckResult =
  | { ok: true; user: User }
  | { ok: false; reason: "offline" | "unauthorized" | "error" };

const MAX_ATTEMPTS = 12;

/** Single auth check for app resume — no retry loop. */
export async function checkSession(): Promise<SessionCheckResult> {
  if (!(await isOnline())) {
    return { ok: false, reason: "offline" };
  }

  try {
    const user = await api.me();
    return { ok: true, user };
  } catch (err) {
    if (isApiError(err, "unauthorized")) {
      return { ok: false, reason: "unauthorized" };
    }
    if (isApiError(err, "network")) {
      return { ok: false, reason: "offline" };
    }
    return { ok: false, reason: "error" };
  }
}

export async function bootstrapSession(
  onStatus: (message: string) => void,
): Promise<BootstrapResult> {
  let delay = 1000;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (!(await isOnline())) {
      onStatus("Keine Internetverbindung — warte auf Netz …");
      await wait(delay);
      delay = Math.min(delay * 1.5, 8000);
      continue;
    }

    onStatus(attempt === 1 ? "Verbindung wird hergestellt …" : "Erneuter Verbindungsversuch …");

    try {
      const user = await api.me();
      return { ok: true, user };
    } catch (err) {
      if (isApiError(err, "unauthorized")) {
        return { ok: false, reason: "unauthorized", message: "Nicht angemeldet" };
      }
      if (isApiError(err, "network")) {
        onStatus("Server nicht erreichbar — erneuter Versuch …");
        await wait(delay);
        delay = Math.min(delay * 1.5, 8000);
        continue;
      }
      onStatus("Verbindungsproblem — erneuter Versuch …");
      await wait(delay);
      delay = Math.min(delay * 1.5, 8000);
    }
  }

  return {
    ok: false,
    reason: "offline",
    message: "Server nicht erreichbar. Bitte Internetverbindung prüfen.",
  };
}

export async function refreshSession(onStatus: (message: string) => void): Promise<User | null> {
  const result = await bootstrapSession(onStatus);
  return result.ok ? result.user : null;
}

export function registerSessionExpiryHandler(onExpired: () => void): () => void {
  let active = false;
  return onUnauthorized(() => {
    if (active) return;
    active = true;
    onExpired();
    queueMicrotask(() => {
      active = false;
    });
  });
}
