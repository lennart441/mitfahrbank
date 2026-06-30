# iOS-Projekt (Capacitor)

Frontend-only: Die App spricht mit dem **Produktions-Backend** unter https://mitfahren.stocksee.de — kein Docker, kein lokales Backend nötig.

## Voraussetzungen

- Xcode (inkl. Command Line Tools)
- Node.js 22+
- CocoaPods (`brew install cocoapods`)
- **iOS 15+** Deployment Target (Capacitor 8 / Firebase Messaging 12)
- Apple Developer Account (Signing, Push, TestFlight)
- Firebase-Projekt (gleiches wie Android)

## Xcode öffnen

**Wichtig:** `frontend/ios/App/App.xcworkspace` öffnen — **nicht** `.xcodeproj`.

```bash
cd frontend
npm install
npm run build:ios
npm run ios:open
```

Nach Frontend-Änderungen erneut `npm run build:ios` und in Xcode Run.

## Signing

- **Bundle Identifier:** `de.stocksee.mitfahrbank`
- **Team:** euer Apple-Developer-Team in Xcode wählen
- URL Scheme und Push sind im Projekt vorkonfiguriert (`Info.plist`, `App.entitlements`)

## Firebase & Push (FCM)

> **Crash `FirebaseApp.configure() could not find a valid GoogleService-Info.plist`?**  
> Die echte Datei aus der Firebase Console fehlt noch — die `.example`-Datei reicht nicht.

1. [Firebase Console](https://console.firebase.google.com) → euer Projekt (gleiches wie Android)
2. **Project settings** → **Your apps** → **Add app** → **iOS**
3. Bundle ID: `de.stocksee.mitfahrbank`
4. `GoogleService-Info.plist` herunterladen
5. Datei nach `frontend/ios/App/App/GoogleService-Info.plist` kopieren (exakter Name!)
6. In Xcode prüfen: Datei im Navigator sichtbar, Target **App** angehakt
7. **Product → Clean Build Folder**, dann erneut Run

Danach APNs Auth Key (`.p8`) in Firebase hochladen — siehe unten.

Push wird auf iOS über `@capacitor-firebase/messaging` (FCM-Token) an das Prod-Backend gesendet. **Nur auf einem echten iPhone testbar** — nicht im Simulator.

Für App-Store-Release: in `App.entitlements` ggf. `aps-environment` von `development` auf `production` stellen (oder von Xcode beim Archive automatisch setzen lassen).

## OAuth-Login

Die App öffnet den Browser gegen Prod-OIDC und kehrt per Deep Link zurück:

`de.stocksee.mitfahrbank://auth/success?token=...`

## Build

```bash
cd frontend
npm run build:ios
```

In Xcode: Product → Run (Simulator oder angeschlossenes iPhone).

## TestFlight (Preflight / Beta)

**Version:** 1.0.3 (Build **4**) — `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` in Xcode.

### Einmalig: App in App Store Connect

1. [App Store Connect](https://appstoreconnect.apple.com) → **Apps** → **+** → **Neue App**
2. Plattform **iOS**, Name **Mitfahrbank**, Bundle ID `de.stocksee.mitfahrbank`, SKU z. B. `mitfahrbank-ios`
3. Datenschutz-URL: https://www.stocksee.de/datenschutz/

### Signing in Xcode (einmalig)

1. `npm run ios:open`
2. Target **App** → **Signing & Capabilities**
3. **Team** wählen (Apple Developer Account)
4. **Automatically manage signing** aktiv lassen

> **CLI-Upload (`npm run ios:upload`):** Team-ID als Umgebungsvariable setzen:
>
> ```bash
> # Team-ID: developer.apple.com → Account → Membership details
> export APPLE_TEAM_ID=XXXXXXXXXX
> npm run ios:upload
> ```
>
> Fehler *„Signing requires a development team“* → `APPLE_TEAM_ID` fehlt oder Team in Xcode nicht gewählt.

### Upload (empfohlen: Xcode GUI)

```bash
cd frontend
npm run build:ios
npm run ios:open
```

In Xcode:

1. Zielgerät: **Any iOS Device (arm64)** (kein Simulator)
2. **Product → Archive**
3. Im Organizer: **Distribute App** → **App Store Connect** → **Upload**
4. Optionen: Upload, automatisches Signing, Symbole hochladen
5. Nach Verarbeitung (~5–30 Min.): App Store Connect → **TestFlight** → interne/externe Tester einladen

### Upload (Kommandozeile)

```bash
cd frontend
export APPLE_TEAM_ID=XXXXXXXXXX   # 10 Zeichen, siehe Membership details
npm run ios:upload
```

Voraussetzung: in Xcode mit Apple-ID angemeldet (Xcode → Settings → Accounts).

### Vor jedem neuen TestFlight-Build

`CURRENT_PROJECT_VERSION` in Xcode erhöhen (muss eindeutig sein). `MARKETING_VERSION` nur bei sichtbaren Releases ändern.

```bash
cd frontend
npm run build:ios
```

## Test-Checkliste

| Test | Wo |
|------|-----|
| UI, Karte, Navigation | Simulator |
| Login (OIDC über Prod) | Simulator oder iPhone |
| Push aktivieren | Nur iPhone |
| Push bei neuer Fahrt | Nur iPhone, als registrierter Fahrer |

## Typische Fehler

| Symptom | Lösung |
|---------|--------|
| Weißer Screen nach Login | URL Scheme `de.stocksee.mitfahrbank` in Info.plist prüfen |
| „Server nicht erreichbar“ beim Start | `npm run build:ios` nach Frontend-Änderungen; API läuft über natives HTTP zum Prod-Server |
| Push-Registrierung schlägt fehl | `GoogleService-Info.plist` fehlt oder APNs-Key nicht in Firebase |
| Pod-Fehler nach Plugin-Update | `cd ios/App && LANG=en_US.UTF-8 pod install`, dann Clean Build Folder |
| `pod install` Encoding-Fehler | `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` vor `npm run build:ios` |
| **No Accounts** beim Archive | Xcode → **Settings → Accounts** → Apple-ID hinzufügen (siehe unten) |
| **No profiles for de.stocksee.mitfahrbank** | Team in Xcode wählen, Bundle-ID registrieren, einmal per GUI archivieren |

## Archive schlägt fehl: No Accounts / No profiles

Diese Meldungen bedeuten: Xcode kann nicht signieren — **nicht** dass der App-Code falsch ist.

### Schritt 1: Apple-ID in Xcode hinterlegen

1. **Xcode** öffnen (nicht nur Terminal)
2. **Xcode → Settings…** (⌘,) → Tab **Accounts**
3. **+** → **Apple ID** → Developer-Account anmelden
4. Account sollte euer **Team** mit Rolle *Admin* oder *Developer* zeigen

### Schritt 2: Bundle-ID & Signing im Projekt

```bash
cd frontend
npm run ios:open
```

1. Target **App** → **Signing & Capabilities**
2. **Team** auswählen (nicht „None“)
3. **Automatically manage signing** aktivieren
4. Wenn Xcode nach **Register Device** / **Create Profile** fragt → **Enable** / **Try Again**

Falls die Bundle-ID noch nicht existiert:

- [developer.apple.com](https://developer.apple.com/account/resources/identifiers/list) → **Identifiers** → **+** → **App IDs**
- Bundle ID: `de.stocksee.mitfahrbank`
- Capabilities: **Push Notifications** aktivieren

### Schritt 3: Erstes Archiv über Xcode (empfohlen)

CLI-Upload funktioniert zuverlässiger, wenn Xcode einmal Profile erzeugt hat:

1. Ziel: **Any iOS Device (arm64)**
2. **Product → Archive**
3. Wenn das klappt: **Distribute App → App Store Connect → Upload**

Danach optional wieder CLI:

```bash
export APPLE_TEAM_ID=XXXXXXXXXX
npm run ios:upload
```

### Schritt 4: App Store Connect

Unter [appstoreconnect.apple.com](https://appstoreconnect.apple.com) muss eine App mit Bundle ID `de.stocksee.mitfahrbank` existieren (siehe TestFlight-Abschnitt oben).
