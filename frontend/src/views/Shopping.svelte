<script lang="ts">
  import { onMount } from "svelte";
  import { api, type ShoppingRequest } from "../lib/api";

  let { refreshKey = 0 }: { refreshKey?: number } = $props();

  let list = $state<ShoppingRequest[]>([]);
  let items = $state("");
  let store = $state("");
  let showForm = $state(false);

  async function load() {
    list = await api.shopping();
  }

  onMount(load);
  $effect(() => {
    refreshKey;
    load();
  });

  async function submit() {
    await api.createShopping(items, store || undefined);
    items = "";
    store = "";
    showForm = false;
    await load();
  }
</script>

<main>
  <h1>Einkaufshilfe</h1>
  <p class="subtitle">Listen einstellen oder als Helfer übernehmen</p>

  <button class="touch-btn" onclick={() => (showForm = !showForm)}>
    {showForm ? "Abbrechen" : "Neue Einkaufsliste"}
  </button>

  {#if showForm}
    <label>
      Geschäft (optional)
      <input bind:value={store} placeholder="z. B. Rewe" />
    </label>
    <label>
      Was wird gebraucht?
      <textarea bind:value={items} rows="4" placeholder="Brot, Milch, Zeitung …"></textarea>
    </label>
    <button class="touch-btn" disabled={!items.trim()} onclick={submit}>
      Liste veröffentlichen
    </button>
  {/if}

  {#each list as entry}
    <article class="card-block">
      {#if entry.store_name}<p><strong>{entry.store_name}</strong></p>{/if}
      <p>{entry.items}</p>
      <p>Von: {entry.creator_name} — Status: {entry.status}</p>
      {#if entry.status === "open"}
        <button class="touch-btn" onclick={async () => { await api.claimShopping(entry.id); await load(); }}>
          Liste reservieren (Helfer)
        </button>
      {:else if entry.status === "claimed"}
        <button class="touch-btn secondary" onclick={async () => { await api.doneShopping(entry.id); await load(); }}>
          Als erledigt markieren
        </button>
      {/if}
    </article>
  {/each}
</main>
