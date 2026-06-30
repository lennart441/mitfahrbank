<script lang="ts">
  import ContextChat from "../lib/ContextChat.svelte";
  import { formatDateTime, shoppingStatusBadge, shoppingStatusLabel } from "../lib/format";
  import type { ShoppingRequest, User } from "../lib/api";

  let {
    entry,
    user,
    refreshKey = 0,
    claiming = false,
    completing = false,
    deleting = false,
    saving = false,
    actionError = "",
    onClaim,
    onDone,
    onDelete,
    onSave,
  }: {
    entry: ShoppingRequest;
    user: User;
    refreshKey?: number;
    claiming?: boolean;
    completing?: boolean;
    deleting?: boolean;
    saving?: boolean;
    actionError?: string;
    onClaim: (id: number) => void;
    onDone: (id: number) => void;
    onDelete: (id: number) => void;
    onSave: (id: number, body: { items: string; store_name: string | null }) => void;
  } = $props();

  let editing = $state(false);
  let editItems = $state("");
  let editStore = $state("");

  function startEdit() {
    editItems = entry.items;
    editStore = entry.store_name ?? "";
    editing = true;
  }

  function cancelEdit() {
    editing = false;
  }

  function callTarget() {
    if (user.id === entry.helper_id && entry.status === "claimed") {
      if (entry.creator_phone_public && entry.creator_phone) {
        return { label: "Ersteller anrufen", phone: entry.creator_phone };
      }
    } else if (user.id === entry.creator_id && entry.helper_id) {
      if (entry.helper_phone_public && entry.helper_phone) {
        return { label: "Helfer anrufen", phone: entry.helper_phone };
      }
    }
    return null;
  }

  const call = $derived(callTarget());
  const isCreator = $derived(user.id === entry.creator_id);
  const isHelper = $derived(user.id === entry.helper_id);
  const canComplete = $derived(
    entry.status === "open"
      ? isCreator
      : entry.status === "claimed" && (isCreator || isHelper),
  );
  const busy = $derived(claiming || completing || deleting || saving);

  $effect(() => {
    entry.id;
    entry.items;
    entry.store_name;
    editing = false;
  });
</script>

<section class="detail-panel">
  {#if actionError}
    <div class="alert alert-error" role="alert">{actionError}</div>
  {/if}

  <article class="card detail-panel__card">
    {#if editing}
      <div class="field">
        <label for="edit-store-{entry.id}">Geschäft (optional)</label>
        <input id="edit-store-{entry.id}" bind:value={editStore} placeholder="z. B. Rewe" />
      </div>
      <div class="field">
        <label for="edit-items-{entry.id}">Was wird gebraucht?</label>
        <textarea id="edit-items-{entry.id}" bind:value={editItems} rows="4"></textarea>
      </div>
      <button
        type="button"
        class="btn btn-primary"
        style="margin-top:0.5rem"
        disabled={busy || !editItems.trim()}
        onclick={() => onSave(entry.id, { items: editItems, store_name: editStore || null })}
      >
        {saving ? "Wird gespeichert …" : "Änderungen speichern"}
      </button>
      <button
        type="button"
        class="btn btn-secondary"
        style="margin-top:0.5rem"
        disabled={busy}
        onclick={cancelEdit}
      >
        Abbrechen
      </button>
    {:else}
      {#if entry.store_name}
        <p class="card-title">{entry.store_name}</p>
      {/if}
      <p style="margin:0 0 0.75rem;line-height:1.5;white-space:pre-wrap">{entry.items}</p>
      <p class="card-meta">Von <strong>{entry.creator_name}</strong></p>
      {#if entry.helper_name}
        <p class="card-meta">Helfer: <strong>{entry.helper_name}</strong></p>
      {/if}
      {#if entry.created_at}
        <p class="card-meta">Anfrage: {formatDateTime(entry.created_at)}</p>
      {/if}
      <span class="badge {shoppingStatusBadge(entry.status)}">
        {shoppingStatusLabel(entry.status)}
      </span>

      {#if call}
        <a class="btn btn-call" style="margin-top:1rem" href="tel:{call.phone}">
          {call.label} · {call.phone}
        </a>
      {:else if isHelper && entry.status === "claimed"}
        <p style="margin-top:1rem;font-size:0.9375rem;color:var(--text-muted)">
          Telefon des Erstellers nicht freigegeben — bitte im Chat abstimmen.
        </p>
      {:else if isCreator && entry.helper_id}
        <p style="margin-top:1rem;font-size:0.9375rem;color:var(--text-muted)">
          Telefon des Helfers nicht freigegeben — bitte im Chat abstimmen.
        </p>
      {/if}

      {#if isCreator && entry.status === "open"}
        <button
          type="button"
          class="btn btn-secondary"
          style="margin-top:1rem"
          disabled={busy}
          onclick={startEdit}
        >
          Liste bearbeiten
        </button>
      {/if}

      {#if entry.status === "open" && !isCreator}
        <button
          type="button"
          class="btn btn-primary"
          style="margin-top:1rem"
          disabled={busy}
          onclick={() => onClaim(entry.id)}
        >
          {claiming ? "Wird reserviert …" : "Liste reservieren (Helfer)"}
        </button>
      {/if}

      {#if canComplete}
        <button
          type="button"
          class="btn btn-secondary"
          style="margin-top:1rem"
          disabled={busy}
          onclick={() => onDone(entry.id)}
        >
          {completing ? "Wird abgeschlossen …" : "Als erledigt markieren"}
        </button>
      {/if}

      {#if isCreator}
        <button
          type="button"
          class="btn btn-secondary"
          style="margin-top:0.75rem"
          disabled={busy}
          onclick={() => onDelete(entry.id)}
        >
          {deleting ? "Wird gelöscht …" : "Liste löschen"}
        </button>
      {/if}
    {/if}

    <ContextChat contextType="shopping" contextId={entry.id} {refreshKey} />
  </article>
</section>
