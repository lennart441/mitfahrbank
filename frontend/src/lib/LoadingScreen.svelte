<script lang="ts">
  let { message = "Laden …" }: { message?: string } = $props();
</script>

<div class="boot-screen" role="status" aria-live="polite" aria-busy="true">
  <img class="boot-screen__logo" src="/wappen.png" alt="" width="88" height="88" />
  <p class="boot-screen__title">Mitfahrbank</p>
  <p class="boot-screen__message">{message}</p>
  <div class="boot-screen__bar" aria-hidden="true">
    <div class="boot-screen__bar-fill"></div>
  </div>
</div>
