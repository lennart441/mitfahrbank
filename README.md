# Mitfahrbank

Digitale **Mitfahrbank** mit **Einkaufshilfe** für Gemeinden — installierbare **PWA**, seniorengerechtes UI, **OpenStreetMap**, **Web-Push** für Fahrer, Chat & Telefon.

## Schnellstart (Entwicklung)

```bash
cp .env.example .env
docker compose up db -d

cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
```

Ohne OIDC: **Anmelden** → Demo-Login.

Für Push in der Entwicklung VAPID-Schlüssel in `.env` setzen (siehe unten). HTTPS ist für Push in Produktion erforderlich; lokal funktioniert `localhost`.

## Kurzwahl-Ziele (fest im Code)

- Lidl Bornhöved — Kieler Tor 25, 24619 Bornhöved
- Plön Innenstadt — Lange Str. 9-23, 24306 Plön
- Ascheberg Edeka / Aldi — Langenrade 2, 24326 Ascheberg (Holstein)
- plus **freie Eingabe** über Karte und OpenStreetMap-Suche (Nominatim)

Anpassen: `backend/src/destinations.ts`

## Web Push für Fahrer

1. **VAPID-Schlüssel** erzeugen und in `.env` eintragen:

   ```bash
   cd backend && node --input-type=module -e "import w from 'web-push'; console.log(w.generateVAPIDKeys())"
   ```

2. Potenzielle Fahrer: App **auf den Startbildschirm installieren**, im **Profil** Push aktivieren, Regionen und Zeiten festlegen, Benachrichtigungen erlauben.

3. Bei neuer Fahrtanfrage sendet der Server Web-Push an alle passenden Fahrer-Abonnements (Filter nach Region und Uhrzeit).

Umgebungsvariablen:

- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — Schlüsselpaar
- `VAPID_SUBJECT` — z. B. `mailto:mitfahrbank@gemeinde.de`
- `WEB_PUSH_ENABLED=false` — Push abschalten

## PWA installieren

- Chrome/Edge: Menü → „App installieren“ oder Banner in der App
- iOS Safari: Teilen → „Zum Home-Bildschirm“
- Icons: `frontend/public/pwa-*.png` (aus `wappen.png` generiert)

## Karte & Telefon & Chat

- **Suchende:** Kurzwahl mit Adresse oder OSM-Karte; Freitext → „OSM suchen“ → Treffer auswählen
- **Fahrer:** Karte zum Ziel, Link zu OpenStreetMap, **Chat**, **Anrufen** (`tel:`) wenn Nummer freigegeben
- **Chat:** WebSocket-Aktualisierung; nach Abschluss der Fahrt werden Chat-Daten gelöscht

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
| Kurzwahl + freie Zieleingabe (OSM-Suche) | ✓ |
| Web Push für registrierte Fahrer (Region & Zeit) | ✓ |
| Chat (Fahrten) + Telefon | ✓ |
| Einkaufshilfe | ✓ |
| Installierbare PWA | ✓ |
