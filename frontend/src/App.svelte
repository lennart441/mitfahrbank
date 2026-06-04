<script lang="ts">
  import { onMount } from "svelte";
  import { api, connectWs, type User } from "./lib/api";
  import Home from "./views/Home.svelte";
  import Seeker from "./views/Seeker.svelte";
  import Driver from "./views/Driver.svelte";
  import Shopping from "./views/Shopping.svelte";
  import Profile from "./views/Profile.svelte";

  type View = "home" | "seeker" | "driver" | "shopping" | "profile";

  let user = $state<User | null>(null);
  let loading = $state(true);
  let view = $state<View>("home");
  let refreshKey = $state(0);

  onMount(async () => {
    try {
      user = await api.me();
    } catch {
      user = null;
    } finally {
      loading = false;
    }

    const ws = connectWs(() => {
      refreshKey += 1;
    });
    return () => ws.close();
  });

  function login() {
    window.location.href = "/auth/login";
  }

  async function logout() {
    await api.logout();
    user = null;
    view = "home";
  }

  function bumpRefresh() {
    refreshKey += 1;
  }
</script>

{#if loading}
  <p>Laden …</p>
{:else if !user}
  <main>
    <h1>Mitfahrbank</h1>
    <p class="subtitle">Nachbarschaftshilfe für Ihre Gemeinde</p>
    <button class="touch-btn" onclick={login}>Anmelden</button>
    <p><small>Mit Authentik oder im Entwicklungsmodus per Demo-Login.</small></p>
  </main>
{:else}
  <nav class="app-nav" aria-label="Hauptnavigation">
    <button type="button" class:secondary={view !== "home"} onclick={() => (view = "home")}>
      Start
    </button>
    <button type="button" class:secondary={view !== "seeker"} onclick={() => (view = "seeker")}>
      Fahrt suchen
    </button>
    <button type="button" class:secondary={view !== "driver"} onclick={() => (view = "driver")}>
      Fahrer
    </button>
    <button type="button" class:secondary={view !== "shopping"} onclick={() => (view = "shopping")}>
      Einkauf
    </button>
    <button type="button" class:secondary={view !== "profile"} onclick={() => (view = "profile")}>
      Profil
    </button>
  </nav>

  {#if view === "home"}
    <Home {user} onNavigate={(v) => (view = v)} />
  {:else if view === "seeker"}
    <Seeker {refreshKey} onCreated={bumpRefresh} />
  {:else if view === "driver"}
    <Driver {refreshKey} />
  {:else if view === "shopping"}
    <Shopping {refreshKey} />
  {:else if view === "profile"}
    <Profile {user} onSaved={(u) => (user = u)} onLogout={logout} />
  {/if}
{/if}
