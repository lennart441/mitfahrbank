# Mitfahrbank

Digitale **Mitfahrbank** mit **Einkaufshilfe** für Gemeinden — PWA mit seniorengerechtem UI (Pico.css), **OpenStreetMap**, **ntfy**-Push für Fahrer, Chat & Telefon.

## Schnellstart (Entwicklung)

```bash
cp .env.example .env
docker compose up db -d

cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
```

Ohne OIDC: **Anmelden** → Demo-Login.

## Kurzwahl-Ziele (fest im Code)

- Bornhöved Lidl  
- Plön Innenstadt  
- Ascheberg Edeka / Aldi  
- plus **freie Eingabe** über Karte/Suche (Nominatim)

Anpassen: `backend/src/destinations.ts`

## ntfy (Push für Fahrer)

1. Potenzielle Fahrer: im **Profil** „Push bei neuen Fahrtwünschen“ aktivieren und ein **privates Thema** eintragen (z. B. `mitfahrbank-max-geheim-42`).
2. Dieselbes Thema in der **ntfy-App** abonnieren (Subscribe).
3. Bei neuer Fahrtanfrage sendet der Server eine Nachricht an alle registrierten Fahrer-Themen.

Umgebungsvariablen:

- `NTFY_BASE_URL` — z. B. `https://ntfy.sh` oder `https://ntfy.ihre-domain.de`
- `NTFY_ENABLED=false` — Push abschalten

## Karte & Telefon & Chat

- **Suchende:** Kurzwahl oder OSM-Karte, Bestätigung mit Kartenpreview.
- **Fahrer:** Karte zum Ziel, Link zu OpenStreetMap, **Chat**, **Anrufen** (`tel:`) wenn Nummer freigegeben.
- **Chat:** WebSocket-Aktualisierung; Nach Abschluss der Fahrt werden Chat-Daten gelöscht.

## Produktion

```bash
docker compose up -d --build
```

App: http://localhost:3000

## Authentik

OAuth2/OIDC — siehe `.env.example` (`OIDC_ISSUER`, `OIDC_CLIENT_ID`, …).

## Funktionen

| Bereich | Status |
|--------|--------|
| OIDC / Authentik + Dev-Login | ✓ |
| OSM-Karte (Leaflet) + Geocoding-Proxy | ✓ |
| Kurzwahl + freie Zieleingabe | ✓ |
| ntfy Push für registrierte Fahrer | ✓ |
| Chat (Fahrten) + Telefon | ✓ |
| Einkaufshilfe | ✓ |
| PWA | ✓ |
