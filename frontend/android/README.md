# Android-Projekt (Capacitor)

## Android Studio öffnen

**Wichtig:** Den Ordner `frontend/android/` öffnen — **nicht** `frontend/android/app/`.

In Android Studio: *File → Open* → `…/mitfahrbank/frontend/android`

Wenn fälschlich `app/` geöffnet wurde, erscheint oft:

```
Task 'prepareKotlinBuildScriptModel' not found in project ':app'
```

Dann Android Studio schließen, ggf. `app/.idea/` löschen und das Projekt erneut aus `frontend/android/` öffnen.

## JDK

JDK **17** oder **21** empfohlen (in Android Studio: *Settings → Build → Gradle → Gradle JDK*).

Mit **Gradle 8.14.5+** funktioniert auch JDK 25 als Gradle-Laufzeit. Ältere Gradle-Versionen (z. B. 8.11) schlagen mit `Unsupported class file major version 69` fehl.

## Build

```bash
cd frontend
npm run build:android

cd android
./gradlew assembleDebug      # APK
./gradlew bundleRelease      # AAB für Play Store
```

Voraussetzungen: Android SDK (`ANDROID_HOME` oder `local.properties` mit `sdk.dir=…`), optional `app/google-services.json` für Push.
