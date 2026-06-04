<script lang="ts">
  import { onMount } from "svelte";
  import { api, type ChatMessage } from "./api";

  let {
    rideId,
    refreshKey = 0,
  }: {
    rideId: number;
    refreshKey?: number;
  } = $props();

  let messages = $state<ChatMessage[]>([]);
  let draft = $state("");
  let sending = $state(false);

  async function load() {
    messages = await api.chat("ride", rideId);
  }

  async function send() {
    if (!draft.trim()) return;
    sending = true;
    try {
      await api.sendChat("ride", rideId, draft.trim());
      draft = "";
      await load();
    } finally {
      sending = false;
    }
  }

  onMount(load);
  $effect(() => {
    refreshKey;
    load();
  });
</script>

<div class="chat-panel">
  <h3>Nachrichten</h3>
  <div class="chat-feed" aria-live="polite">
    {#if messages.length === 0}
      <p style="margin:0;color:var(--text-muted);font-size:0.9375rem">
        Noch keine Nachrichten — z. B. „Ich stehe am blauen Auto“
      </p>
    {:else}
      {#each messages as m}
        <p class="chat-line">
          <strong>{m.sender_name}:</strong> {m.body}
        </p>
      {/each}
    {/if}
  </div>
  <div class="chat-compose">
    <input
      type="text"
      bind:value={draft}
      placeholder="Nachricht schreiben …"
      aria-label="Chat-Nachricht"
      onkeydown={(e) => e.key === "Enter" && send()}
    />
    <button type="button" class="btn btn-primary" disabled={sending} onclick={send}>
      Senden
    </button>
  </div>
</div>
