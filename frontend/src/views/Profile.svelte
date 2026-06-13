<script lang="ts">
  import { onMount } from "svelte";
  import { api, type DestinationPreset, type User } from "../lib/api";
  import { pushSupported, subscribeToPush, unsubscribeFromPush } from "../lib/push";
  import { isNativeApp } from "../lib/platform";

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
  let notifyAll = $state(true);
  let presetIds = $state<string[]>([]);
  let notifyLocationQuery = $state("");
  let notifyLocationLabel = $state("");
  let notifyCenterLat = $state<number | null>(null);
  let notifyCenterLon = $state<number | null>(null);
  let notifyRadiusKm = $state(15);
  let useTimeFilter = $state(false);
  let timeStart = $state("08:00");
  let timeEnd = $state("20:00");
  let notifyDays = $state<number[]>([1, 2, 3, 4, 5, 6, 0]);
  let presets = $state<DestinationPreset[]>([]);
  let pushEnabled = $state(false);
  let fcmEnabled = $state(false);
  let vapidKey = $state<string | null>(null);
  let locationResults = $state<{ label: string; lat: number; lon: number }[]>([]);
  let searchingLocation = $state(false);
  let saving = $state(false);
  let message = $state("");

  const weekdayOptions = [
    { id: 1, label: "Mo" },
    { id: 2, label: "Di" },
    { id: 3, label: "Mi" },
    { id: 4, label: "Do" },
    { id: 5, label: "Fr" },
    { id: 6, label: "Sa" },
    { id: 0, label: "So" },
  ];

  $effect(() => {
    phone = user.phone_number ?? "";
    isPublic = user.is_phone_public;
    isDriverNotify = user.is_driver_notify ?? false;
    notifyAll = user.notify_all_destinations ?? true;
    presetIds = [...(user.notify_preset_ids ?? [])];
    notifyCenterLat = user.notify_center_lat;
    notifyCenterLon = user.notify_center_lon;
    notifyRadiusKm = user.notify_radius_km ?? 15;
    if (user.notify_time_start && user.notify_time_end) {
      useTimeFilter = true;
      timeStart = user.notify_time_start.slice(0, 5);
      timeEnd = user.notify_time_end.slice(0, 5);
    }
    notifyDays = [...(user.notify_days ?? [0, 1, 2, 3, 4, 5, 6])];
  });

  onMount(async () => {
    const cfg = await api.config();
    presets = cfg.destinations;
    pushEnabled = cfg.push.enabled;
    fcmEnabled = cfg.push.fcmEnabled;
    vapidKey = cfg.push.vapidPublicKey;
  });

  function togglePreset(id: string) {
    if (presetIds.includes(id)) {
      presetIds = presetIds.filter((p) => p !== id);
    } else {
      presetIds = [...presetIds, id];
    }
  }

  function toggleDay(day: number) {
    if (notifyDays.includes(day)) {
      notifyDays = notifyDays.filter((d) => d !== day);
    } else {
      notifyDays = [...notifyDays, day];
    }
  }

  async function searchNotifyLocation() {
    const q = notifyLocationQuery.trim();
    if (q.length < 3) return;
    searchingLocation = true;
    try {
      locationResults = await api.geocode(q);
    } catch {
      locationResults = [];
    } finally {
      searchingLocation = false;
    }
  }

  function pickNotifyLocation(r: { label: string; lat: number; lon: number }) {
    notifyLocationLabel = r.label;
    notifyCenterLat = r.lat;
    notifyCenterLon = r.lon;
    locationResults = [];
    notifyLocationQuery = "";
  }

  async function save() {
    saving = true;
    message = "";
    try {
      const canPush = isNativeApp() ? fcmEnabled : pushEnabled && vapidKey;
      if (isDriverNotify && canPush && pushSupported()) {
        const ok = await subscribeToPush(vapidKey ?? "");
        if (!ok) {
          message =
            "Push konnte nicht aktiviert werden — bitte Benachrichtigungen in den Geräteeinstellungen erlauben.";
          saving = false;
          return;
        }
      } else if (!isDriverNotify) {
        await unsubscribeFromPush();
      }

      const updated = await api.updateMe({
        phone_number: phone || null,
        is_phone_public: isPublic,
        is_driver_notify: isDriverNotify,
        notify_all_destinations: notifyAll,
        notify_preset_ids: notifyAll ? null : presetIds.length ? presetIds : null,
        notify_center_lat: notifyAll ? null : notifyCenterLat,
        notify_center_lon: notifyAll ? null : notifyCenterLon,
        notify_radius_km: notifyAll ? null : notifyRadiusKm,
        notify_time_start: useTimeFilter ? timeStart : null,
        notify_time_end: useTimeFilter ? timeEnd : null,
        notify_days: useTimeFilter ? notifyDays : null,
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
  <p class="page-lead">
    Telefon für Anrufe. Als potenzieller Fahrer Push-Benachrichtigungen über die installierte App.
  </p>
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
    <h3 class="card-title">Push als Fahrer</h3>
    {#if isNativeApp() ? !fcmEnabled : !pushEnabled}
      <p class="alert" style="margin:0 0 1rem;background:var(--surface-muted)">
        Push-Benachrichtigungen sind auf dem Server noch nicht konfiguriert{isNativeApp()
          ? " (Firebase/FCM)."
          : " (VAPID-Schlüssel)."}
      </p>
    {:else if !pushSupported()}
      <p class="alert" style="margin:0 0 1rem;background:var(--surface-muted)">
        {isNativeApp()
          ? "Push-Benachrichtigungen werden auf diesem Gerät nicht unterstützt."
          : "Ihr Browser unterstützt keine Web-Push-Benachrichtigungen."}
      </p>
    {/if}
    <label class="field-check">
      <input
        type="checkbox"
        bind:checked={isDriverNotify}
        disabled={isNativeApp() ? !fcmEnabled : !pushEnabled}
      />
      <span>Bei neuen Fahrtwünschen Push erhalten</span>
    </label>
    <p style="font-size:0.875rem;color:var(--text-muted);margin:0 0 1rem">
      {#if isNativeApp()}
        Erlauben Sie Benachrichtigungen, wenn die App danach fragt.
      {:else}
        Installieren Sie die App auf dem Startbildschirm und erlauben Sie Benachrichtigungen.
      {/if}
    </p>

    {#if isDriverNotify}
      <fieldset class="notify-fieldset">
        <legend>Welche Fahrten?</legend>
        <label class="field-check">
          <input type="radio" name="notify-scope" checked={notifyAll} onchange={() => (notifyAll = true)} />
          <span>Alle Fahrtziele</span>
        </label>
        <label class="field-check">
          <input
            type="radio"
            name="notify-scope"
            checked={!notifyAll}
            onchange={() => (notifyAll = false)}
          />
          <span>Nur bestimmte Regionen</span>
        </label>

        {#if !notifyAll}
          <p style="font-size:0.875rem;color:var(--text-secondary);margin:0.75rem 0 0.5rem">
            Kurzwahl-Ziele (5&nbsp;km Umkreis):
          </p>
          {#each presets as p}
            <label class="field-check">
              <input
                type="checkbox"
                checked={presetIds.includes(p.id)}
                onchange={() => togglePreset(p.id)}
              />
              <span>{p.label} — {p.address}</span>
            </label>
          {/each}

          <p style="font-size:0.875rem;color:var(--text-secondary);margin:1rem 0 0.5rem">
            Oder eigener Standort mit Radius:
          </p>
          <div class="field">
            <label for="notify-loc">Ort suchen (OpenStreetMap)</label>
            <div class="btn-row" style="margin:0">
              <input
                id="notify-loc"
                type="search"
                bind:value={notifyLocationQuery}
                placeholder="Straße, Ort …"
                autocomplete="off"
              />
              <button
                type="button"
                class="btn btn-secondary"
                disabled={searchingLocation || notifyLocationQuery.trim().length < 3}
                onclick={searchNotifyLocation}
              >
                {searchingLocation ? "…" : "Suchen"}
              </button>
            </div>
          </div>
          {#if locationResults.length > 0}
            <ul class="search-results">
              {#each locationResults as r}
                <li>
                  <button type="button" onclick={() => pickNotifyLocation(r)}>{r.label}</button>
                </li>
              {/each}
            </ul>
          {/if}
          {#if notifyLocationLabel}
            <p style="font-size:0.875rem;margin:0.5rem 0">
              Gewählt: <strong>{notifyLocationLabel}</strong>
            </p>
          {/if}
          <div class="field">
            <label for="radius">Radius: {notifyRadiusKm} km</label>
            <input
              id="radius"
              type="range"
              min="5"
              max="40"
              step="5"
              bind:value={notifyRadiusKm}
            />
          </div>
        {/if}
      </fieldset>

      <fieldset class="notify-fieldset" style="margin-top:1rem">
        <legend>Wann benachrichtigen?</legend>
        <label class="field-check">
          <input type="checkbox" bind:checked={useTimeFilter} />
          <span>Nur zu bestimmten Zeiten</span>
        </label>
        {#if useTimeFilter}
          <div class="field-row">
            <div class="field">
              <label for="t-start">Von</label>
              <input id="t-start" type="time" bind:value={timeStart} />
            </div>
            <div class="field">
              <label for="t-end">Bis</label>
              <input id="t-end" type="time" bind:value={timeEnd} />
            </div>
          </div>
          <p style="font-size:0.875rem;color:var(--text-secondary);margin:0.5rem 0">Wochentage:</p>
          <div class="day-chips">
            {#each weekdayOptions as d}
              <button
                type="button"
                class="day-chip"
                class:active={notifyDays.includes(d.id)}
                onclick={() => toggleDay(d.id)}
              >
                {d.label}
              </button>
            {/each}
          </div>
        {/if}
      </fieldset>
    {/if}
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
