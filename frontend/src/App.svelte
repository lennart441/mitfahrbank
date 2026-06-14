<script lang="ts">
  import { onMount } from "svelte";
  import { App as CapApp } from "@capacitor/app";
  import { Network } from "@capacitor/network";
  import { api, type User } from "./lib/api";
  import NavIcon from "./lib/NavIcon.svelte";
  import { navItems, type AppView } from "./lib/nav";
  import Home from "./views/Home.svelte";
  import Seeker from "./views/Seeker.svelte";
  import Driver from "./views/Driver.svelte";
  import Shopping from "./views/Shopping.svelte";
  import Profile from "./views/Profile.svelte";
  import PwaInstall from "./lib/PwaInstall.svelte";
  import LoadingScreen from "./lib/LoadingScreen.svelte";
  import { connectWsReconnect } from "./lib/ws";
  import { startLogin } from "./lib/auth";
  import { isNativeApp } from "./lib/platform";
  import { bootstrapSession, refreshSession, registerSessionExpiryHandler } from "./lib/session";
  import { wait } from "./lib/network";

  const wappenUrl = "/wappen.png";
  const bmlehLogoUrl = "/bmleh.svg";

  type Phase = "loading" | "login" | "app";

  let user = $state<User | null>(null);
  let phase = $state<Phase>("loading");
  let statusMessage = $state("Verbindung wird hergestellt …");
  let view = $state<AppView>("home");
  let refreshKey = $state(0);
  let sessionRenewing = $state(false);

  async function applyBootstrap() {
    const result = await bootstrapSession((msg) => {
      statusMessage = msg;
    });

    if (result.ok) {
      user = result.user;
      phase = "app";
      return;
    }

    if (result.reason === "unauthorized") {
      user = null;
      phase = "login";
      return;
    }

    phase = "loading";
    statusMessage = result.message;
  }

  async function handleSessionExpired() {
    if (sessionRenewing || phase === "loading") return;
    sessionRenewing = true;
    user = null;
    phase = "loading";
    statusMessage = "Anmeldung abgelaufen — erneute Anmeldung …";
    await wait(400);
    void startLogin();
  }

  async function resumeSession() {
    if (phase !== "app" && phase !== "login") return;
    const prevPhase = phase;
    phase = "loading";
    statusMessage = "Sitzung wird geprüft …";
    const refreshed = await refreshSession((msg) => {
      statusMessage = msg;
    });
    if (refreshed) {
      user = refreshed;
      phase = "app";
      refreshKey += 1;
      return;
    }
    if (prevPhase === "app") {
      await handleSessionExpired();
      return;
    }
    user = null;
    phase = "login";
  }

  onMount(() => {
    const stopUnauthorized = registerSessionExpiryHandler(() => {
      if (phase === "app") void handleSessionExpired();
    });

    void applyBootstrap();

    const ws = connectWsReconnect(() => {
      refreshKey += 1;
    });

    const cleanups: (() => void)[] = [stopUnauthorized, () => ws()];

    if (isNativeApp()) {
      void CapApp.addListener("appStateChange", ({ isActive }) => {
        if (isActive) void resumeSession();
      }).then((h) => cleanups.push(() => h.remove()));

      void Network.addListener("networkStatusChange", (status) => {
        if (status.connected && phase === "loading") void applyBootstrap();
      }).then((h) => cleanups.push(() => h.remove()));
    } else {
      const onOnline = () => {
        if (phase === "loading") void applyBootstrap();
      };
      window.addEventListener("online", onOnline);
      cleanups.push(() => window.removeEventListener("online", onOnline));
    }

    return () => {
      for (const fn of cleanups) fn();
    };
  });

  function login() {
    phase = "loading";
    statusMessage = "Anmeldung im Browser …";
    void startLogin();
  }

  async function logout() {
    phase = "loading";
    statusMessage = "Abmelden …";
    await api.logout();
    user = null;
    view = "home";
    phase = "login";
  }

  function bumpRefresh() {
    refreshKey += 1;
  }

  function setView(v: AppView) {
    view = v;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
</script>

{#if phase === "loading"}
  <LoadingScreen message={statusMessage} />
{:else}
  <div class="app-root">
    <header class="topbar">
      <div class="topbar-brand">
        <img class="topbar-wappen" src={wappenUrl} alt="Wappen Gemeinde Stocksee" width="44" height="44" />
        <div class="topbar-titles">
          <h1>Mitfahrbank</h1>
          <p>Gemeinde Stocksee</p>
        </div>
      </div>
      {#if user}
        <span class="topbar-user" title={user.name}>{user.name}</span>
      {/if}
    </header>

    {#if phase === "login"}
      <div class="login-shell">
        <div class="login-hero">
          <img class="wappen-lg" src={wappenUrl} alt="Wappen Gemeinde Stocksee" width="104" height="104" />
          <h2>Willkommen in Stocksee</h2>
          <p>Mitfahrgelegenheiten und Einkaufshilfe für unsere Gemeinde — einfach und übersichtlich.</p>
          <button type="button" class="btn btn-primary" onclick={login}>Anmelden</button>
          <p style="margin-top:1.25rem;font-size:0.875rem;color:var(--text-muted)">
            Mit Authentik oder im Entwicklungsmodus per Demo-Login.
          </p>
        </div>
        <footer class="login-footer">
          <nav class="login-footer-links" aria-label="Gemeinde Stocksee">
            <a href="https://www.stocksee.de/" target="_blank" rel="noopener noreferrer">Website</a>
            <span class="login-footer-sep" aria-hidden="true">·</span>
            <a href="https://www.stocksee.de/impressum/index.php" target="_blank" rel="noopener noreferrer"
              >Impressum</a
            >
            <span class="login-footer-sep" aria-hidden="true">·</span>
            <a href="https://www.stocksee.de/datenschutz/index.php" target="_blank" rel="noopener noreferrer"
              >Datenschutzerklärung</a
            >
          </nav>
          <img
            class="login-footer-logo"
            src={bmlehLogoUrl}
            alt="BMLEH – Bayerisches Ministerium für Ernährung, Landwirtschaft und Heimat"
            width="215"
            height="175"
          />
        </footer>
      </div>
    {:else if user}
      <PwaInstall />
      <div class="app-layout">
        <aside class="sidebar" aria-label="Navigation">
          <nav class="sidebar-nav">
            {#each navItems as item}
              <button
                type="button"
                class="nav-item"
                class:active={view === item.id}
                onclick={() => setView(item.id)}
              >
                <NavIcon id={item.id} />
                <span class="nav-label">{item.label}</span>
              </button>
            {/each}
          </nav>
        </aside>

        <div class="main-panel">
          <div class="page" class:page--wide={view === "driver" || view === "seeker"}>
            {#if view === "home"}
              <Home {user} onNavigate={setView} />
            {:else if view === "seeker"}
              <Seeker {refreshKey} onCreated={bumpRefresh} />
            {:else if view === "driver"}
              <Driver {refreshKey} />
            {:else if view === "shopping"}
              <Shopping {refreshKey} {user} />
            {:else if view === "profile"}
              <Profile {user} onSaved={(u) => (user = u)} onLogout={logout} />
            {/if}
          </div>
        </div>
      </div>

      <nav class="mobile-nav" aria-label="Hauptnavigation">
        {#each navItems as item}
          <button
            type="button"
            class="nav-item"
            class:active={view === item.id}
            onclick={() => setView(item.id)}
            aria-current={view === item.id ? "page" : undefined}
          >
            <NavIcon id={item.id} />
            <span class="nav-label">{item.short}</span>
          </button>
        {/each}
      </nav>
    {/if}
  </div>
{/if}
