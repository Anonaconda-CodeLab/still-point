# Security and privacy

## Design
- **No network access.** The built page carries a Content Security Policy (`default-src 'none'; connect-src 'none'`) so the
  app cannot send or fetch anything, even if malicious code were injected. Fonts are embedded; there are no external scripts,
  analytics or trackers. The only outbound links (source code, Ko-fi, Lead One ECG, email) open in the same tab
  (`rel="noopener noreferrer"`). The site's HTTP headers (`dist/_headers`) add a second block on connections and stop
  other sites from framing the app; the offline helper may fetch only the app's own files.
- **Local storage only.** Readings, sessions, tags and settings are stored in the browser's IndexedDB and localStorage on
  the user's own device. Nothing is uploaded. Data leaves the device only when the user exports a file.
- **Untrusted input.** History imports and Elite HRV exports are validated (types, ranges, lengths, known values) and all
  text is HTML-escaped before display.
- **Bluetooth scope.** The app requests only devices offering the standard Heart Rate service (or named `Polar H10`/
  `Polar H9`), and only the heart-rate and battery services. Readings store the strap's model name, not its serial
  number.

## Android app
- **No internet permission.** It is removed in the manifest, and every build fails if it reappears. The app cannot
  connect to anything but the strap. Links (source code, Ko-fi, email, Check for updates) open in your browser or mail
  app, outside the app.
- **Permissions:** Bluetooth (Nearby devices; location only on Android 11 and older, where Bluetooth scanning requires
  it), notifications and a foreground service (so readings, sessions and chimes continue with the screen off), wake lock
  and vibration.
- **Signed releases.** Official APKs are signed with the studio's one key, shared by all Anonaconda Code Lab apps. Its
  SHA-256 certificate fingerprint is published on the [Android page](https://stillpoint.anonacondacodelab.com/android.html) and in every release, and the
  release build fails if an APK is signed with any other key. Each release also lists the APK's SHA-256 checksum.

## Known limitations
- Data at rest is not encrypted; anyone with access to the unlocked device and browser profile (or the app) can read it.
- Bluetooth Low Energy traffic from the strap is not encrypted by the device.
- Exported files contain health data. Treat them like medical records.

## Reporting a vulnerability
Please report security issues privately using GitHub's **Security → Report a vulnerability** (private vulnerability
reporting) on this repository rather than opening a public issue, or email hello@anonacondacodelab.com. Include steps
to reproduce and the affected version.
