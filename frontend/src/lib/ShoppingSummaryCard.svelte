<script lang="ts">
  import { formatDateTime, shoppingStatusBadge, shoppingStatusLabel } from "./format";
  import type { ShoppingRequest } from "./api";

  let {
    entry,
    onShowDetails,
  }: {
    entry: ShoppingRequest;
    onShowDetails: (id: number) => void;
  } = $props();

  function title(e: ShoppingRequest) {
    if (e.store_name) return e.store_name;
    const preview = e.items.trim().split("\n")[0];
    return preview.length > 48 ? `${preview.slice(0, 48)}…` : preview;
  }
</script>

<article class="card summary-card">
  <p class="card-title">{title(entry)}</p>
  <p class="card-meta">Von <strong>{entry.creator_name}</strong></p>
  {#if entry.created_at}
    <p class="card-meta">Anfrage: {formatDateTime(entry.created_at)}</p>
  {/if}
  <span class="badge {shoppingStatusBadge(entry.status)}">
    {shoppingStatusLabel(entry.status)}
  </span>
  <button
    type="button"
    class="btn btn-secondary"
    style="margin-top:0.5rem"
    onclick={() => onShowDetails(entry.id)}
  >
    Details anzeigen
  </button>
</article>
