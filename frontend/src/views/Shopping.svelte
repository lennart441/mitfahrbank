<script lang="ts">
  import { onMount } from "svelte";
  import ShoppingSummaryCard from "../lib/ShoppingSummaryCard.svelte";
  import ShoppingDetailPanel from "../lib/ShoppingDetailPanel.svelte";
  import DetailOverlay from "../lib/DetailOverlay.svelte";
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
  let claiming = $state(false);
  let completing = $state(false);
  let deleting = $state(false);
  let saving = $state(false);
  let actionError = $state("");

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
    actionError = "";
    claiming = true;
    try {
      await api.claimShopping(id);
      await load();
    } catch (e) {
      actionError =
        e instanceof Error ? e.message : "Liste konnte nicht reserviert werden.";
    } finally {
      claiming = false;
    }
  }

  async function done(id: number) {
    actionError = "";
    completing = true;
    try {
      await api.doneShopping(id);
      selectedEntryId = null;
      await load();
    } catch (e) {
      actionError =
        e instanceof Error ? e.message : "Liste konnte nicht abgeschlossen werden.";
    } finally {
      completing = false;
    }
  }

  async function remove(id: number) {
    actionError = "";
    deleting = true;
    try {
      await api.deleteShopping(id);
      selectedEntryId = null;
      await load();
    } catch (e) {
      actionError =
        e instanceof Error ? e.message : "Liste konnte nicht gelöscht werden.";
    } finally {
      deleting = false;
    }
  }

  async function save(
    id: number,
    body: { items: string; store_name: string | null },
  ) {
    actionError = "";
    saving = true;
    try {
      await api.updateShopping(id, body);
      await load();
    } catch (e) {
      actionError =
        e instanceof Error ? e.message : "Liste konnte nicht gespeichert werden.";
    } finally {
      saving = false;
    }
  }

  function closeDetail() {
    selectedEntryId = null;
    actionError = "";
  }

  const selectedEntry = $derived(
    selectedEntryId != null ? list.find((e) => e.id === selectedEntryId) : null,
  );

  function overlayTitle(entry: ShoppingRequest) {
    return entry.store_name || "Einkaufsliste";
  }
</script>

<header class="page-header">
  <h2>Einkaufshilfe</h2>
  <p class="page-lead">Listen einstellen oder als Helfer reservieren — übersichtlich auf einen Blick.</p>
</header>

<button
  type="button"
  class="btn btn-primary"
  style="max-width:20rem;margin-bottom:1.25rem"
  onclick={() => (showForm = !showForm)}
>
  {showForm ? "Abbrechen" : "Neue Einkaufsliste"}
</button>

{#if showForm}
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

{#if list.length === 0}
  <div class="empty-state">
    <p><strong>Noch keine Listen</strong></p>
    <p>Erstellen Sie die erste Einkaufsliste für die Nachbarschaft.</p>
  </div>
{:else}
  <div class="card-grid card-grid--2">
    {#each list as entry}
      <ShoppingSummaryCard
        {entry}
        onShowDetails={(id) => {
          actionError = "";
          selectedEntryId = id;
        }}
      />
    {/each}
  </div>
{/if}

{#if selectedEntry}
  <DetailOverlay
    title={overlayTitle(selectedEntry)}
    subtitle="Einkaufshilfe"
    onClose={closeDetail}
  >
    <ShoppingDetailPanel
      entry={selectedEntry}
      {user}
      {refreshKey}
      {claiming}
      {completing}
      {deleting}
      {saving}
      {actionError}
      onClaim={claim}
      onDone={done}
      onDelete={remove}
      onSave={save}
    />
  </DetailOverlay>
{/if}
