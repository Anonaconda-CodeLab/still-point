# Notices

## Not a medical device
Still Point is experimental software for personal wellness use. It is not a medical device, has not been
cleared or approved by any regulator, and must not be used to diagnose, treat or rule out any condition. See the
[disclaimer in the README](README.md#disclaimer).

## Trademarks
Polar and H10 are trademarks of Polar Electro Oy. Still Point is an independent project and is not affiliated with,
endorsed by or sponsored by Polar Electro. Device names are used only to describe compatibility.

## Third-party components
The built app embeds two typefaces, each licensed under the SIL Open Font License 1.1:

| Font | Copyright | Licence file |
|---|---|---|
| Instrument Sans | The Instrument Sans Project Authors | [src/fonts/OFL-InstrumentSans.txt](src/fonts/OFL-InstrumentSans.txt) |
| IBM Plex Mono | IBM Corp. | [src/fonts/OFL-IBMPlexMono.txt](src/fonts/OFL-IBMPlexMono.txt) |

The **Android app** (built from `mobile/`) also includes:

| Component | Version | Licence |
|---|---|---|
| [Capacitor](https://capacitorjs.com) (`@capacitor/android`, `@capacitor/core`) | 8.5.3 | MIT |
| [@capacitor-community/bluetooth-le](https://github.com/capacitor-community/bluetooth-le) | 8.3.0 | MIT |
| AndroidX libraries (AppCompat, Core, CoordinatorLayout, Core SplashScreen, Activity, WebKit) | see `mobile/android/variables.gradle` | Apache-2.0 |
| Kotlin standard library | 2.2.20 | Apache-2.0 |
| Gradle wrapper (`mobile/android/gradle/wrapper`, build tool only) | | Apache-2.0 |

MIT and Apache-2.0 are compatible with the GNU GPL v3, under which the app as a whole is distributed. Their licence
texts travel with each package (`mobile/node_modules/*/LICENSE`, and the AndroidX and Kotlin artifacts).

No other third-party code is included. The Bluetooth protocol implementation is written from Polar's publicly documented
heart-rate service; see also the [Polar BLE SDK](https://github.com/polarofficial/polar-ble-sdk).
