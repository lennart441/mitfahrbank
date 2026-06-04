<script lang="ts">
  import { api, type User } from "../lib/api";

  let {
    user,
    onSaved,
    onLogout,
  }: {
    user: User;
    onSaved: (u: User) => void;
    onLogout: () => void;
  } = $props();

  let phone = $state("");
  let isPublic = $state(false);
  let isDriverNotify = $state(false);
  let ntfyTopic = $state("");
  let saving = $state(false);
  let message = $state("");

  $effect(() => {
    phone = user.phone_number ?? "";
    isPublic = user.is_phone_public;
    isDriverNotify = user.is_driver_notify ?? false;
    ntfyTopic = user.ntfy_topic ?? "";
  });

  async function save() {
    saving = true;
    message = "";
    try {
      const updated = await api.updateMe({
        phone_number: phone || null,
        is_phone_public: isPublic,
        is_driver_notify: isDriverNotify,
        ntfy_topic: ntfyTopic.trim() || null,
      });
      onSaved(updated);
      message = "Gespeichert.";
    } catch {
      message = "Speichern fehlgeschlagen.";
    } finally {
      saving = false;
    }
  }
</script>

<main>
  <h1>Mein Profil</h1>
  <p class="subtitle">Telefon, Push für Fahrer, ntfy</p>

  <p><strong>Name:</strong> {user.name}</p>

  <h2>Telefon & Anruf</h2>
  <label>
    Telefonnummer
    <input type="tel" bind:value={phone} placeholder="+49 …" autocomplete="tel" />
  </label>
  <label>
    <input type="checkbox" bind:checked={isPublic} />
    Telefonnummer für Fahrer/Helfer sichtbar (Anrufen-Button)
  </label>

  <h2>Push als potenzieller Fahrer (ntfy)</h2>
  <label>
    <input type="checkbox" bind:checked={isDriverNotify} />
    Ich möchte Push-Benachrichtigungen bei neuen Fahrtwünschen
  </label>
  <label>
    ntfy-Thema (privat wählen, z. B. mitfahrbank-meinname-xyz)
    <input
      type="text"
      bind:value={ntfyTopic}
      placeholder="ihr-geheimes-topic"
      autocomplete="off"
    />
  </label>
  <details>
    <summary>ntfy einrichten (Kurzanleitung)</summary>
    <ol>
      <li>App <strong>ntfy</strong> installieren oder <a href="https://ntfy.sh" target="_blank" rel="noopener">ntfy.sh</a> nutzen</li>
      <li>Dasselbe Thema wie oben abonnieren (Subscribe)</li>
      <li>Hier „Push bei neuen Fahrtwünschen“ aktivieren und speichern</li>
    </ol>
    <p>
      <small>
        Selbst gehostet: Server-Admin setzt <code>NTFY_BASE_URL</code> in der
        Mitfahrbank-.env.
      </small>
    </p>
  </details>

  <button class="touch-btn" disabled={saving} onclick={save}>
    {saving ? "Speichern …" : "Speichern"}
  </button>
  {#if message}<p>{message}</p>{/if}

  <button class="touch-btn secondary" onclick={onLogout}>Abmelden</button>
</main>
