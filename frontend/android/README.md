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

JDK **17** oder **21** verwenden (in Android Studio: *Settings → Build → Gradle → Gradle JDK*).

JDK 25 wird derzeit von Android Gradle Plugin 8.7 nicht unterstützt.

## Build

```bash
cd frontend
npm run build:android

cd android
./gradlew assembleDebug      # APK
./gradlew bundleRelease      # AAB für Play Store
```

Voraussetzungen: Android SDK (`ANDROID_HOME` oder `local.properties` mit `sdk.dir=…`), optional `app/google-services.json` für Push.
