<script lang="ts">
  import type { RideRequest } from "./api";

  let {
    rides,
    variant = "seeker",
  }: {
    rides: RideRequest[];
    variant?: "seeker" | "driver";
  } = $props();

  function statusLabel(s: string) {
    const map: Record<string, string> = {
      completed: "Abgeschlossen",
      cancelled: "Abgebrochen",
    };
    return map[s] ?? s;
  }

  function statusBadge(s: string) {
    return s === "completed" ? "badge-done" : "badge-waiting";
  }

  function formatWhen(iso: string | null | undefined) {
    if (!iso) return "";
    return new Date(iso).toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
</script>

{#if rides.length === 0}
  <p style="color:var(--text-muted);margin:0">Noch keine archivierten Fahrten.</p>
{:else}
  <div class="archive-list">
    {#each rides as ride}
      <article class="card card--flat archive-item">
        <div class="archive-item-head">
          <p class="card-title" style="margin:0">{ride.destination}</p>
          <span class="badge {statusBadge(ride.status)}">{statusLabel(ride.status)}</span>
        </div>
        <p class="archive-meta">
          {#if variant === "driver" && ride.seeker_name}
            Suchende/r: {ride.seeker_name} ·
          {:else if ride.driver_name}
            Fahrer: {ride.driver_name} ·
          {/if}
          {formatWhen(ride.archived_at ?? ride.updated_at)}
        </p>
      </article>
    {/each}
  </div>
{/if}

<style>
  .archive-list {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }
  .archive-item {
    margin-bottom: 0;
    padding: 1rem 1.15rem;
    background: var(--bg);
  }
  .archive-item-head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .archive-meta {
    margin: 0.5rem 0 0;
    font-size: 0.875rem;
    color: var(--text-muted);
  }
</style>
