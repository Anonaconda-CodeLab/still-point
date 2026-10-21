# Still Point for Android

The Android app wraps the same web app (`../dist`) with [Capacitor](https://capacitorjs.com).
Native code is small and lives in `android/app/src/main/java/com/anonacondacodelab/stillpoint/`:

- `AppPlugin.java`: saving files, vibration, spoken cues, keeping the screen on, starting the session service.
- `ActiveService.java`: a foreground service with a partial wake lock, so a reading, breathing session or meditation keeps going with the screen off.
- `MainActivity.java`: the Back button never closes the app during a session.

Bluetooth uses [@capacitor-community/bluetooth-le](https://github.com/capacitor-community/bluetooth-le); `native.js`
in the web app maps the Web Bluetooth calls the app makes onto it.

The app has **no internet permission** (it is removed in the manifest and the build checks for it).

## Building

GitHub builds the APK on every change (`.github/workflows/android.yml`) and publishes it as the `android-test`
pre-release. To build locally you need Node 22, JDK 21 and the Android SDK:

```
node build.mjs
cd mobile && npm ci && npx cap sync android
cd android && ./gradlew assembleRelease
```

Release signing reads `RELEASE_KEYSTORE`, `RELEASE_KEYSTORE_PASSWORD`, `RELEASE_KEY_ALIAS` and `RELEASE_KEY_PASSWORD`
from the environment. Without them the release APK is unsigned.
