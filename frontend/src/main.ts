import "./app.css";
import { mount } from "svelte";
import { registerSW } from "virtual:pwa-register";
import App from "./App.svelte";
import { initNativeAuthListener, normalizeNativeEntryUrl } from "./lib/auth";
import { initNativePushListeners } from "./lib/nativePush";
import { isNativeApp } from "./lib/platform";

async function startApp(): Promise<void> {
  if (!isNativeApp()) {
    registerSW({ immediate: true });
  } else {
    await initNativeAuthListener();
    void initNativePushListeners();
  }

  if (!normalizeNativeEntryUrl()) {
    mount(App, { target: document.getElementById("app")! });
  }
}

void startApp();
