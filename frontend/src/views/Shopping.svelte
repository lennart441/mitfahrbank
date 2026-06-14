<script lang="ts">
  import { onMount } from "svelte";
  import ShoppingSummaryCard from "../lib/ShoppingSummaryCard.svelte";
  import ShoppingDetailPanel from "../lib/ShoppingDetailPanel.svelte";
  import { api, type ShoppingRequest, type User } from "../lib/api";

  let {
    refreshKey = 0,
    user,
  }: {
    refreshKey?: number;
    user: User;
  } = $props();

  let list = $state<ShoppingRequest[]>([]);
  let items = $state("");
  let store = $state("");
  let showForm = $state(false);
  let selectedEntryId = $state<number | null>(null);

  async function load() {
    list = await api.shopping();
    if (selectedEntryId != null && !list.some((e) => e.id === selectedEntryId)) {
      selectedEntryId = null;
    }
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

  async function claim(id: number) {
    await api.claimShopping(id);
    await load();
  }

  async function done(id: number) {
    await api.doneShopping(id);
    selectedEntryId = null;
    await load();
  }

  const selectedEntry = $derived(
    selectedEntryId != null ? list.find((e) => e.id === selectedEntryId) : null,
  );
</script>

<header class="page-header">
  <h2>Einkaufshilfe</h2>
  <p class="page-lead">Listen einstellen oder als Helfer reservieren — übersichtlich auf einen Blick.</p>
</header>

{#if selectedEntry == null}
  <button
    type="button"
    class="btn btn-primary"
    style="max-width:20rem;margin-bottom:1.25rem"
    onclick={() => (showForm = !showForm)}
  >
    {showForm ? "Abbrechen" : "Neue Einkaufsliste"}
  </button>
{/if}

{#if showForm && selectedEntry == null}
  <section class="card" style="margin-bottom:1.5rem">
    <div class="field">
      <label for="store">Geschäft (optional)</label>
      <input id="store" bind:value={store} placeholder="z. B. Rewe" />
    </div>
    <div class="field">
      <label for="items">Was wird gebraucht?</label>
      <textarea id="items" bind:value={items} rows="4" placeholder="Brot, Milch, Zeitung …"></textarea>
    </div>
    <button type="button" class="btn btn-primary" disabled={!items.trim()} onclick={submit}>
      Liste veröffentlichen
    </button>
  </section>
{/if}

{#if selectedEntry}
  <ShoppingDetailPanel
    entry={selectedEntry}
    {user}
    {refreshKey}
    onBack={() => (selectedEntryId = null)}
    onClaim={claim}
    onDone={done}
  />
{:else if list.length === 0}
  <div class="empty-state">
    <p><strong>Noch keine Listen</strong></p>
    <p>Erstellen Sie die erste Einkaufsliste für die Nachbarschaft.</p>
  </div>
{:else}
  <div class="card-grid card-grid--2">
    {#each list as entry}
      <ShoppingSummaryCard
        {entry}
        onShowDetails={(id) => (selectedEntryId = id)}
      />
    {/each}
  </div>
{/if}
