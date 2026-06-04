<script lang="ts">
  import type { User } from "../lib/api";

  let {
    user,
    onNavigate,
  }: {
    user: User;
    onNavigate: (view: "seeker" | "driver" | "shopping" | "profile") => void;
  } = $props();
</script>

<main>
  <h1>Hallo, {user.name}</h1>
  <p class="subtitle">Was möchten Sie tun?</p>

  <button class="touch-btn" onclick={() => onNavigate("seeker")}>
    Ich brauche eine Mitfahrgelegenheit
  </button>
  <button class="touch-btn secondary" onclick={() => onNavigate("driver")}>
    Ich kann jemanden mitnehmen
  </button>
  <button class="touch-btn secondary" onclick={() => onNavigate("shopping")}>
    Einkaufshilfe (Schwarzes Brett)
  </button>
  <button class="touch-btn secondary" onclick={() => onNavigate("profile")}>
    Mein Profil & Telefonnummer
  </button>
</main>
