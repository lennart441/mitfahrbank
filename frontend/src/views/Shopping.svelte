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

  function statusBadge(s: string) {
    if (s === "open") return "badge-waiting";
    if (s === "claimed") return "badge-driving";
    return "badge-done";
  }
</script>

<header class="page-header">
  <h2>Einkaufshilfe</h2>
  <p class="page-lead">Listen einstellen oder als Helfer reservieren — übersichtlich auf einen Blick.</p>
</header>

<button type="button" class="btn btn-primary" style="max-width:20rem;margin-bottom:1.25rem" onclick={() => (showForm = !showForm)}>
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
      <article class="card">
        {#if entry.store_name}
          <p class="card-title">{entry.store_name}</p>
        {/if}
        <p style="margin:0 0 0.75rem;line-height:1.5">{entry.items}</p>
        <p style="font-size:0.9375rem;color:var(--text-secondary);margin:0 0 0.75rem">
          Von {entry.creator_name}
        </p>
        <span class="badge {statusBadge(entry.status)}">{entry.status}</span>
        {#if entry.status === "open"}
          <button
            type="button"
            class="btn btn-primary"
            style="margin-top:1rem"
            onclick={async () => {
              await api.claimShopping(entry.id);
              await load();
            }}
          >
            Liste reservieren (Helfer)
          </button>
        {:else if entry.status === "claimed"}
          <button
            type="button"
            class="btn btn-secondary"
            style="margin-top:1rem"
            onclick={async () => {
              await api.doneShopping(entry.id);
              await load();
            }}
          >
            Als erledigt markieren
          </button>
        {/if}
      </article>
    {/each}
  </div>
{/if}
