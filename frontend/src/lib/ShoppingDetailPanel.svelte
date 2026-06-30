<script lang="ts">
  import { onMount } from "svelte";
  import { api, type ShoppingRequest, type User } from "../lib/api";
  import ContextChat from "../lib/ContextChat.svelte";
  import { formatDateTime, shoppingStatusBadge, shoppingStatusLabel } from "../lib/format";

  let {
    entry,
    user,
    refreshKey = 0,
    claiming = false,
    completing = false,
    deleting = false,
    actionError = "",
    onClaim,
    onDone,
    onDelete,
  }: {
    entry: ShoppingRequest;
    user: User;
    refreshKey?: number;
    claiming?: boolean;
    completing?: boolean;
    deleting?: boolean;
    actionError?: string;
    onClaim: (id: number) => void;
    onDone: (id: number) => void;
    onDelete: (id: number) => void;
  } = $props();

  function callTarget() {
    if (user.id === entry.helper_id) {
      if (entry.creator_phone_public && entry.creator_phone) {
        return { label: "Ersteller anrufen", phone: entry.creator_phone };
      }
    } else if (user.id === entry.creator_id && entry.helper_id) {
      if (entry.helper_phone_public && entry.helper_phone) {
        return { label: "Helfer anrufen", phone: entry.helper_phone };
      }
    } else if (entry.status === "open" && user.id !== entry.creator_id) {
      if (entry.creator_phone_public && entry.creator_phone) {
        return { label: "Ersteller anrufen", phone: entry.creator_phone };
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
</script>

<section class="detail-panel">
  {#if actionError}
    <div class="alert alert-error" role="alert">{actionError}</div>
  {/if}

  <article class="card detail-panel__card">
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
    {:else if entry.status !== "open" || user.id !== entry.creator_id}
      <p style="margin-top:1rem;font-size:0.9375rem;color:var(--text-muted)">
        Telefon nicht freigegeben — bitte im Chat abstimmen.
      </p>
    {/if}

    {#if entry.status === "open" && user.id !== entry.creator_id}
      <button
        type="button"
        class="btn btn-primary"
        style="margin-top:1rem"
        disabled={claiming || completing || deleting}
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
        disabled={claiming || completing || deleting}
        onclick={() => onDone(entry.id)}
      >
        {completing ? "Wird abgeschlossen …" : "Als erledigt markieren"}
      </button>
    {/if}

    {#if isCreator && entry.status !== "done"}
      <button
        type="button"
        class="btn btn-secondary"
        style="margin-top:0.75rem"
        disabled={claiming || completing || deleting}
        onclick={() => onDelete(entry.id)}
      >
        {deleting ? "Wird gelöscht …" : "Liste löschen"}
      </button>
    {/if}

    <ContextChat contextType="shopping" contextId={entry.id} {refreshKey} />
  </article>
</section>
