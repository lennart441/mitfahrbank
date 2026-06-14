<script lang="ts">
  import { onMount } from "svelte";
  import { api, type ShoppingRequest, type User } from "../lib/api";
  import DetailBackHeader from "../lib/DetailBackHeader.svelte";
  import ContextChat from "../lib/ContextChat.svelte";
  import { formatDateTime, shoppingStatusBadge, shoppingStatusLabel } from "../lib/format";

  let {
    entry,
    user,
    refreshKey = 0,
    onBack,
    onClaim,
    onDone,
  }: {
    entry: ShoppingRequest;
    user: User;
    refreshKey?: number;
    onBack: () => void;
    onClaim: (id: number) => void;
    onDone: (id: number) => void;
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
</script>

<section class="detail-panel">
  <DetailBackHeader
    title={entry.store_name || "Einkaufsliste"}
    {onBack}
  />

  <article class="card">
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
        onclick={() => onClaim(entry.id)}
      >
        Liste reservieren (Helfer)
      </button>
    {:else if entry.status === "claimed" && (user.id === entry.creator_id || user.id === entry.helper_id)}
      <button
        type="button"
        class="btn btn-secondary"
        style="margin-top:1rem"
        onclick={() => onDone(entry.id)}
      >
        Als erledigt markieren
      </button>
    {/if}

    <ContextChat contextType="shopping" contextId={entry.id} {refreshKey} />
  </article>
</section>
