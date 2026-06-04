<script lang="ts">
  import type { User } from "../lib/api";
  import type { AppView } from "../lib/nav";

  let {
    user,
    onNavigate,
  }: {
    user: User;
    onNavigate: (view: AppView) => void;
  } = $props();
</script>

<header class="page-header">
  <h2>Hallo, {user.name.split(" ")[0]}</h2>
  <p class="page-lead">
    Nachbarschaftshilfe in der Gemeinde Stocksee — wählen Sie, wobei Sie Hilfe brauchen oder anderen helfen möchten.
  </p>
</header>

<div class="card-grid card-grid--home">
  <button
    type="button"
    class="action-tile action-tile--primary"
    onclick={() => onNavigate("seeker")}
  >
    <span class="action-tile-label">Mitfahrbank</span>
    <span class="action-tile-title">Ich brauche eine Mitfahrgelegenheit</span>
  </button>

  <button type="button" class="action-tile" onclick={() => onNavigate("driver")}>
    <span class="action-tile-label">Angebot</span>
    <span class="action-tile-title">Ich kann jemanden mitnehmen</span>
  </button>

  <button type="button" class="action-tile" onclick={() => onNavigate("shopping")}>
    <span class="action-tile-label">Nachbarschaft</span>
    <span class="action-tile-title">Einkaufshilfe — Schwarzes Brett</span>
  </button>

  <button type="button" class="action-tile" onclick={() => onNavigate("profile")}>
    <span class="action-tile-label">Einstellungen</span>
    <span class="action-tile-title">Profil, Telefon & Benachrichtigungen</span>
  </button>
</div>
