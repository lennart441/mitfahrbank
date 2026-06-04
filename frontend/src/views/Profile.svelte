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

<header class="page-header">
  <h2>Mein Profil</h2>
  <p class="page-lead">Telefon für Anrufe, ntfy für Push als potenzieller Fahrer.</p>
</header>

<div class="card-grid card-grid--2">
  <section class="card">
    <h3 class="card-title">Kontakt</h3>
    <p style="margin:0 0 1rem;color:var(--text-secondary);font-size:0.9375rem">
      Angemeldet als <strong>{user.name}</strong>
    </p>
    <div class="field">
      <label for="phone">Telefonnummer</label>
      <input id="phone" type="tel" bind:value={phone} placeholder="+49 …" autocomplete="tel" />
    </div>
    <label class="field-check">
      <input type="checkbox" bind:checked={isPublic} />
      <span>Nummer für Fahrer/Helfer sichtbar (großer Anrufen-Button)</span>
    </label>
  </section>

  <section class="card">
    <h3 class="card-title">Push als Fahrer (ntfy)</h3>
    <label class="field-check">
      <input type="checkbox" bind:checked={isDriverNotify} />
      <span>Bei neuen Fahrtwünschen Push erhalten</span>
    </label>
    <div class="field">
      <label for="ntfy">Privates ntfy-Thema</label>
      <input
        id="ntfy"
        type="text"
        bind:value={ntfyTopic}
        placeholder="z. B. mitfahrbank-meinname-xyz"
        autocomplete="off"
      />
    </div>
    <details class="panel">
      <summary>ntfy einrichten</summary>
      <ol style="margin:0.75rem 0 0;padding-left:1.25rem;color:var(--text-secondary)">
        <li>App <strong>ntfy</strong> installieren oder <a href="https://ntfy.sh" target="_blank" rel="noopener">ntfy.sh</a> nutzen</li>
        <li>Dasselbe Thema wie oben abonnieren</li>
        <li>Hier aktivieren und speichern</li>
      </ol>
    </details>
  </section>
</div>

{#if message}
  <div class="alert alert-success" style="margin-top:1rem">{message}</div>
{/if}

<div class="btn-row btn-row--split" style="margin-top:1.5rem">
  <button type="button" class="btn btn-primary" disabled={saving} onclick={save}>
    {saving ? "Speichern …" : "Änderungen speichern"}
  </button>
  <button type="button" class="btn btn-secondary" onclick={onLogout}>Abmelden</button>
</div>
