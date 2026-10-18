# Still Point

**A calm morning HRV check-in, standing test and paced breathing for the Polar H10.**
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
- **Simulated strap** for trying the app without a Polar H10.
- History export/import.

## Development
```sh
npm run build   # writes dist/index.html (no dependencies, Node 18+)
npm test        # builds and runs the tests
```
The app name, address, source link and Ko-fi username are set at the top of `build.mjs`.
Methods are documented in [docs/MANUAL.md](docs/MANUAL.md), which is also built into the app.

## Hosting
The whole app is one file, `dist/index.html`. On Netlify, link the repository and set the publish directory to `dist`
(no build command).

## Disclaimer
Still Point is for general wellness, relaxation and training only. It is not a medical device, has not been evaluated by
any regulator, and must not be used to diagnose, treat, rule out or monitor any condition. Polar and H10 are trademarks
of Polar Electro Oy; this project is independent and not affiliated with Polar.

## Licence
Copyright © 2026 Anonaconda Code Lab. Free software under the [GNU GPL v3 or later](LICENSE). Embedded fonts: SIL Open
Font License 1.1 (see [NOTICE.md](NOTICE.md)).
