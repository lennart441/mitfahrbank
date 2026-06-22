<script lang="ts">
  import { onMount } from "svelte";
  import type { Snippet } from "svelte";

  let {
    title,
    subtitle = "",
    onClose,
    children,
  }: {
    title: string;
    subtitle?: string;
    onClose: () => void;
    children: Snippet;
  } = $props();

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") onClose();
  }

  onMount(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  });
</script>

<svelte:window onkeydown={onKeydown} />

<div
  class="detail-overlay"
  role="dialog"
  aria-modal="true"
  aria-labelledby="detail-overlay-title"
>
  <header class="detail-overlay__header">
    <button
      type="button"
      class="detail-overlay__close"
      onclick={onClose}
      aria-label="Schließen"
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path
          d="M18 6L6 18M6 6l12 12"
          fill="none"
          stroke="currentColor"
          stroke-width="2.25"
          stroke-linecap="round"
        />
      </svg>
    </button>
    <div class="detail-overlay__titles">
      <h2 id="detail-overlay-title">{title}</h2>
      {#if subtitle}
        <p>{subtitle}</p>
      {/if}
    </div>
  </header>

  <div class="detail-overlay__body">
    {@render children()}
  </div>
</div>
