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

<div class="chat-box">
  <h3>Nachrichten</h3>
  <div class="chat-messages" aria-live="polite">
    {#if messages.length === 0}
      <p><small>Noch keine Nachrichten. z. B. „Ich stehe am blauen Auto“</small></p>
    {:else}
      {#each messages as m}
        <p class="chat-line">
          <strong>{m.sender_name}:</strong> {m.body}
        </p>
      {/each}
    {/if}
  </div>
  <div class="chat-input">
    <input
      type="text"
      bind:value={draft}
      placeholder="Nachricht schreiben …"
      onkeydown={(e) => e.key === "Enter" && send()}
    />
    <button class="touch-btn" disabled={sending} onclick={send}>Senden</button>
  </div>
</div>

<style>
  .chat-box {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 2px solid var(--pico-muted-border-color);
  }
  .chat-messages {
    max-height: 10rem;
    overflow-y: auto;
    margin-bottom: 0.75rem;
  }
  .chat-line {
    margin: 0.35rem 0;
  }
  .chat-input {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
</style>
