<script lang="ts">
  let { title, onBack }: { title: string; onBack: () => void } = $props();
</script>

<div class="detail-back">
  <button type="button" class="btn btn-secondary" onclick={onBack}>← Zurück</button>
  <h2 style="margin:0.75rem 0 0;font-size:1.25rem">{title}</h2>
</div>
