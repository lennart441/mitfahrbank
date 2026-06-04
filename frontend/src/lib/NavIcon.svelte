<script lang="ts">
  import type { AppView } from "./nav";

  let { id }: { id: AppView } = $props();
</script>

<svg
  class="nav-icon"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if id === "home"}
    <path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z" />
  {:else if id === "seeker"}
    <path d="M12 21s7-4.35 7-10.5A7 7 0 0 0 5 10.5C5 16.65 12 21 12 21z" />
    <circle cx="12" cy="10.5" r="2.25" />
  {:else if id === "driver"}
    <path d="M5 11h14l-1.5-4.5H6.5L5 11Z" />
    <path d="M5 11v6h14v-6" />
    <circle cx="7.5" cy="17" r="1.5" />
    <circle cx="16.5" cy="17" r="1.5" />
  {:else if id === "shopping"}
    <path d="M6 7h15l-1.5 9H7.5L6 7Z" />
    <path d="M6 7 5 4H3" />
    <circle cx="9.5" cy="19" r="1.25" />
    <circle cx="17" cy="19" r="1.25" />
  {:else if id === "profile"}
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6" />
  {/if}
</svg>
