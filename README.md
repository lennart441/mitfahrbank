# Mitfahrbank

Digitale **Mitfahrbank** mit **Einkaufshilfe** für Gemeinden — installierbare **PWA** und **native Android-App**, seniorengerechtes UI, **OpenStreetMap**, Push für Fahrer, Chat & Telefon.

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

## Push-Benachrichtigungen für Fahrer

### Web (PWA)

1. **VAPID-Schlüssel** erzeugen und in `.env` eintragen:

   ```bash
   cd backend && node --input-type=module -e "import w from 'web-push'; console.log(w.generateVAPIDKeys())"
   ```

2. Potenzielle Fahrer: App **auf den Startbildschirm installieren**, im **Profil** Push aktivieren, Regionen und Zeiten festlegen, Benachrichtigungen erlauben.

3. Bei neuer Fahrtanfrage sendet der Server Web-Push an passende Fahrer (Filter nach Region und Uhrzeit).

Umgebungsvariablen:

- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — Schlüsselpaar
- `VAPID_SUBJECT` — z. B. `mailto:mitfahrbank@gemeinde.de`
- `WEB_PUSH_ENABLED=false` — Web Push abschalten

### Native Android-App (FCM)

Die Play-Store-App nutzt **Firebase Cloud Messaging** statt Web Push.

1. Firebase-Projekt anlegen, Android-App mit Package `de.stocksee.mitfahrbank` registrieren
2. `google-services.json` aus der Firebase Console nach `frontend/android/app/google-services.json` kopieren (Vorlage: `google-services.json.example`)
3. Firebase Service-Account-JSON für das Backend in `.env` eintragen:

   ```
   FCM_ENABLED=true
   FIREBASE_SERVICE_ACCOUNT_JSON=/pfad/zum/service-account.json
   ```

4. Potenzielle Fahrer: App aus dem Play Store installieren, im **Profil** Push aktivieren, Benachrichtigungsberechtigung erlauben.

Der Server sendet Benachrichtigungen parallel über Web Push (PWA) und FCM (native App) — jeweils an registrierte Geräte.

## PWA installieren (Web)

- Chrome/Edge: Menü → „App installieren“ oder Banner in der App
- iOS Safari: Teilen → „Zum Home-Bildschirm“
- Icons: `frontend/public/pwa-*.png` (aus `wappen.png` generiert)

## Native Android-App (Capacitor)

Zusätzlicher Installationsweg neben der PWA — kein Ersatz für den Web-Client.

### Entwicklung

```bash
cd frontend
npm run build:android    # Vite-Build + cap sync
npm run android:open     # Android Studio öffnen
```

**Android Studio:** Projekt aus `frontend/android/` öffnen — nicht `frontend/android/app/`. Siehe [`frontend/android/README.md`](frontend/android/README.md). JDK 17 oder 21 verwenden.

Die App nutzt `server.hostname = mitfahren.stocksee.de` und `server.html5mode = false`, damit OAuth-Pfade (`/auth/login`, `/auth/callback`) den Server erreichen und nicht lokal als SPA geladen werden.

Optional Live-Reload gegen den Dev-Server: in `capacitor.config.ts` temporär `server.url` setzen (Emulator: `http://10.0.2.2:5173`).

### Release-Build (Play Store)

Voraussetzungen: Android Studio, JDK, `google-services.json`, Release-Keystore.

```bash
cd frontend
npm run build:android
cd android
./gradlew bundleRelease
```

AAB liegt unter `android/app/build/outputs/bundle/release/`.

Play-Store-Checkliste:

- App-Signing bei Google Play (Upload-Key + App-Signing)
- Datenschutzerklärung: https://www.stocksee.de/datenschutz/
- Data Safety Form: Auth-Daten, Standort (Karte), Push-Tokens
- Screenshots für Smartphone und Tablet
- `versionCode` / `versionName` in `frontend/android/app/build.gradle` bei Updates erhöhen

App-Icons anpassen (optional):

```bash
cd frontend
npx @capacitor/assets generate --iconBackgroundColor '#1f5c2e' --splashBackgroundColor '#f6faf7'
```

Quelle: `public/pwa-512x512.png`

## iOS (Capacitor)

Native iOS-App neben PWA und Android — Frontend-only gegen **https://mitfahren.stocksee.de** (kein lokales Backend).

### Entwicklung

```bash
cd frontend
npm install
npm run build:ios    # Vite-Build + cap sync
npm run ios:open     # Xcode öffnen
```

**Xcode:** `frontend/ios/App/App.xcworkspace` öffnen — siehe [`frontend/ios/README.md`](frontend/ios/README.md).

Voraussetzungen: Apple Developer Account, `GoogleService-Info.plist` (Vorlage: `frontend/ios/App/App/GoogleService-Info.plist.example`), APNs-Key in Firebase.

Push auf iOS nutzt **Firebase Cloud Messaging** (`@capacitor-firebase/messaging`) — FCM-Token an Prod-Backend. Nur auf echtem iPhone testbar.

### App Store / TestFlight

- Signing in Xcode mit Developer-Team
- Datenschutzerklärung: https://www.stocksee.de/datenschutz/
- `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` in Xcode bei Updates erhöhen
- TestFlight-Upload: siehe [`frontend/ios/README.md`](frontend/ios/README.md#testflight-preflight--beta)

## Karte & Telefon & Chat

- **Suchende:** Kurzwahl mit Adresse oder OSM-Karte; Freitext → „OSM suchen“ → Treffer auswählen
- **Fahrer:** Karte zum Ziel, Link zu OpenStreetMap, **Chat**, **Anrufen** (`tel:`) wenn Nummer freigegeben
- **Chat:** WebSocket-Aktualisierung mit automatischem Reconnect; nach Abschluss der Fahrt werden Chat-Daten gelöscht

## Produktion

```bash
docker compose up -d --build
```

App: https://mitfahren.stocksee.de

## Authentik

OAuth2/OIDC — siehe `.env.example` (`OIDC_ISSUER`, `OIDC_CLIENT_ID`, …).

## Funktionen

| Bereich | Status |
|--------|--------|
| OIDC / Authentik + Dev-Login | ✓ |
| OSM-Karte (Leaflet) + Geocoding-Proxy | ✓ |
| Kurzwahl + freie Zieleingabe (OSM-Suche) | ✓ |
| Web Push für registrierte Fahrer (Region & Zeit) | ✓ |
| Native Android-App (Capacitor + FCM) | ✓ |
| Native iOS-App (Capacitor + FCM) | ✓ |
| Chat (Fahrten) + Telefon | ✓ |
| Einkaufshilfe | ✓ |
| Installierbare PWA | ✓ |
