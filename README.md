# Still Point

**A calm morning HRV check-in, standing test and paced breathing for the Polar H10 or any standard Bluetooth chest strap.**
Everything runs in your browser: no account, no server, no data leaves your device. A sibling of
[Lead One ECG](https://leadone.anonacondacodelab.com) from Anonaconda Code Lab.

> **Not a medical device.** For general wellness only. See the [disclaimer](#disclaimer).

## Features
- **Morning reading** (1, 2, 3 or 5 minutes, lying, sitting or standing) from the strap's own beat-to-beat intervals:
  lnRMSSD, RMSSD, heart rate and a 0–100 HRV score, with ectopic beats and glitches left out.
- **Personal baseline**: after 7 mornings, your 7-day average is compared with your own 60-day usual range.
- **Standing test** (optional, +2 min): peak heart-rate rise, where it settles, 30:15 ratio.
- **Breathe**: a soothing guide from 3 to 7 breaths a minute in half steps, *longer out* or *even* rhythm, soft chimes
  or vibration, and a live heart-rate trace showing your heart rate following your breath.
- **Resonance test**: 6.5 → 4.5 breaths a minute, two minutes each, picks the pace with the biggest heart-rate swing.
- **Trends**: HRV score with usual range and 7-day average, resting heart rate, standing-test history, breathing minutes.
- **Optional tags** (alcohol, sleep, training, illness, stress…) plus sleep score and hours slept, and a *What affects
  you* card that shows how each relates to your HRV.
- **Training guidance** from your trend, a **weekly summary**, and plain-language trend commentary.
- **Breathing patterns**: box breathing, 4-7-8, or your own in / hold / out / hold timings, plus an **open session**
  with no guide and a quiet heart-rate and HRV summary.
- **Import from Elite HRV** (the .zip export), recalculated from the beat intervals.
- **Android app**: the same app, with readings and sessions that keep going while the screen is off, and no internet
  permission at all. Or install the web app to your home screen (works offline).
- **Any standard chest strap**: a Polar H10, or any strap that sends the standard Bluetooth Heart Rate signal with
  beat-to-beat intervals (Garmin HRM-Dual/Pro, Wahoo TICKR, Coospo, Magene, Decathlon…). Devices that send heart rate
  only are recognised and can't start a reading.
- **Simulated strap** for trying the app without a strap.
- History export/import.

## Android app
Download the APK from the [latest release](https://github.com/Anonaconda-CodeLab/still-point/releases/latest). The
[install guide](https://stillpoint.anonacondacodelab.com/android.html) explains how to install it, check that it's the
official build (SHA-256 checksum and signing-certificate fingerprint) and keep it up to date, for example with Obtainium.
It isn't on Google Play: we support [Keep Android Open](https://keepandroidopen.org). How it's built, and how to build
and sign your own: [mobile/README.md](mobile/README.md).

## Support
Questions or problems: **hello@anonacondacodelab.com**. A description or a screenshot is usually enough; please don't
send exported files unless you are happy to share them, because they contain your health data. Security issues: see
[SECURITY.md](SECURITY.md).

## Development
```sh
npm run build   # writes dist/index.html (no dependencies, Node 18+)
npm test        # builds and runs the tests
```
The app name, address, source link, contact address, signing-certificate fingerprint and Ko-fi username are set at
the top of `build.mjs`. Changes are listed in [CHANGELOG.md](CHANGELOG.md).
Methods are documented in [docs/MANUAL.md](docs/MANUAL.md), which is also built into the app.

## Hosting
The whole app is one file, `dist/index.html`, plus its offline helper `dist/sw.js`. The official site is on Cloudflare
Pages: link the repository and set the publish directory to `dist` (no build command). `dist/_headers` holds the HTTP
headers.

## Disclaimer
Still Point is for general wellness, relaxation and training only. It is not a medical device, has not been evaluated by
any regulator, and must not be used to diagnose, treat, rule out or monitor any condition. Polar and H10 are trademarks of Polar Electro Oy;
Garmin, HRM-Dual and HRM-Pro of Garmin Ltd.; Wahoo and TICKR of Wahoo Fitness; Coospo, Magene and Decathlon of their respective owners. This project is independent and not affiliated
with any of them.

## Licence
Copyright © 2026 Anonaconda Code Lab. Free software under the [GNU GPL v3 or later](LICENSE). Embedded fonts (SIL Open
Font License 1.1) and the Android app's components (MIT and Apache-2.0) are listed in [NOTICE.md](NOTICE.md).
