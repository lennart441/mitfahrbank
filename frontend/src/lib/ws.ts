import { App } from "@capacitor/app";
import { Network } from "@capacitor/network";
import { SERVER_ORIGIN } from "./auth";
import { isNativeApp } from "./platform";

function wsUrl(): string {
  if (isNativeApp()) {
    const wsOrigin = SERVER_ORIGIN.replace(/^http/, "ws");
    return `${wsOrigin}/ws`;
  }
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}/ws`;
}

export function connectWsReconnect(onMessage: (data: unknown) => void): () => void {
  let ws: WebSocket | null = null;
  let delay = 1000;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  function clearReconnectTimer() {
    if (reconnectTimer != null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function scheduleReconnect() {
    if (closed) return;
    clearReconnectTimer();
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
    delay = Math.min(delay * 2, 30000);
  }

  function connect() {
    if (closed) return;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    ws = new WebSocket(wsUrl());

    ws.onopen = () => {
      delay = 1000;
    };

    ws.onmessage = (ev) => {
      try {
        onMessage(JSON.parse(ev.data));
      } catch {
        /* ignore */
      }
    };

    ws.onerror = () => {
      ws?.close();
    };

    ws.onclose = () => {
      ws = null;
      scheduleReconnect();
    };
  }

  function forceReconnect() {
    clearReconnectTimer();
    if (ws) {
      ws.onclose = null;
      ws.close();
      ws = null;
    }
    delay = 1000;
    connect();
  }

  connect();

  const cleanups: (() => void)[] = [];

  if (isNativeApp()) {
    void Network.addListener("networkStatusChange", (status) => {
      if (status.connected) forceReconnect();
    }).then((h) => cleanups.push(() => h.remove()));

    void App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) forceReconnect();
    }).then((h) => cleanups.push(() => h.remove()));
  }

  return () => {
    closed = true;
    clearReconnectTimer();
    for (const fn of cleanups) fn();
    if (ws) {
      ws.onclose = null;
      ws.close();
      ws = null;
    }
  };
}
