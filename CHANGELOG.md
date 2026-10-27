# Changelog

## 1.0.1
- Links open in the same tab.
- Readings, sessions, trends and strap details are marked so a browser's Translate button leaves them out
  (translation sends the page's text to an online service). New Privacy section in the manual, which also
  explains that opening the web app is an ordinary website visit.
- **New home:** the website moved to Cloudflare Pages, with stricter security headers: no other site can show
  the app inside its own page, and browsers always use HTTPS.
- Shorter thank-you line at the bottom of the start screen.

## 1.0.0
- **Any standard Bluetooth chest strap** now works, not just the Polar H10: Garmin HRM-Dual/Pro, Wahoo TICKR, Coospo,
  Magene, Decathlon and others that send beat-to-beat intervals. Devices that send heart rate only (often watches) are
  recognised and can't start a reading. Each reading saves the strap's model, and Trends points out when your baseline
  mixes straps.
- Breathing chimes are scheduled a moment ahead and allow for the phone's audio delay, so each one sounds exactly as the
  circle turns; chimes still due when you end a session early are cancelled.
- First public release, with the **Android app** alongside the web app. Download, install guide and checksums:
  https://stillpoint.anonacondacodelab.com/android.html
- Android app: readings, breathing sessions and chimes keep going with the screen off; no internet permission at all;
  **Check for updates** in Settings → About; links open in your browser or mail app.
- Contact address (hello@anonacondacodelab.com) and source-code link in Settings → About, the manual and the README.
- Source code published at https://github.com/Anonaconda-CodeLab/still-point. Releases are built from tagged source by
  GitHub Actions, with the APK's SHA-256 checksum and the signing certificate's fingerprint in every release.

## 0.7.0
- **Sleep aids** in the tags (herbal or other), compared with your HRV like the other tags.
- Unsaved readings and sessions keep **Save** and **Discard** pinned at the bottom of the screen.
- Session buttons stay clear of Android's navigation bar.

## 0.6.1
- A thank-you note with a Ko-fi link at the foot of the home screen; link previews and search-engine pages.

## 0.6.0 and earlier
- Morning readings with a personal baseline, the standing test, breathing guide and resonance test, open sessions,
  trends with commentary, tags and sleep, training guidance, weekly summary and Elite HRV import.
