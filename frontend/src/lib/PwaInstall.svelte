<script lang="ts">
  import { onMount } from "svelte";

  let deferredPrompt = $state<Event | null>(null);
  let dismissed = $state(false);
  let isStandalone = $state(false);

  onMount(() => {
    isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e;
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  });

  async function install() {
    const prompt = deferredPrompt as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string }>;
    };
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    deferredPrompt = null;
  }

  function dismiss() {
    dismissed = true;
    deferredPrompt = null;
  }
</script>

{#if !isStandalone && deferredPrompt && !dismissed}
  <aside class="pwa-install-banner" role="region" aria-label="App installieren">
    <p>
      <strong>Als App installieren</strong> — Mitfahrbank auf dem Startbildschirm mit
      Push-Benachrichtigungen.
    </p>
    <div class="btn-row">
      <button type="button" class="btn btn-primary" onclick={install}>Installieren</button>
      <button type="button" class="btn btn-secondary" onclick={dismiss}>Später</button>
    </div>
  </aside>
{/if}
