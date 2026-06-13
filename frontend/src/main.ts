import "./app.css";
import { mount } from "svelte";
import { registerSW } from "virtual:pwa-register";
import App from "./App.svelte";
import { initNativeAuthListener, normalizeNativeEntryUrl } from "./lib/auth";
import { initNativePushListeners } from "./lib/nativePush";
import { isNativeApp } from "./lib/platform";

if (!isNativeApp()) {
  registerSW({ immediate: true });
} else {
  void initNativeAuthListener();
  void initNativePushListeners();
}

if (!normalizeNativeEntryUrl()) {
  mount(App, { target: document.getElementById("app")! });
}
