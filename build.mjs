#!/usr/bin/env node
// Copyright (C) 2026 Anonaconda Code Lab · SPDX-License-Identifier: GPL-3.0-or-later
// Builds dist/index.html: a single self-contained page (fonts, styles and scripts inlined)
// with a strict Content Security Policy that blocks every network request.
//   node build.mjs              -> dist/index.html
//   node build.mjs --fragment   -> dist/fragment.html (page body only, for embedding/preview hosts)
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
// ---- project settings (edit these) ----
const PROJECT = {
  name: 'Still Point',     // working name: change here and everything follows
  filePrefix: 'StillPoint',
  appUrl: 'https://stillpoint.anonacondacodelab.com', // the public address of the app (used in help texts)
  repoUrl: 'https://github.com/Anonaconda-CodeLab/still-point', // shown in Settings > About
  kofi: 'anonacondacodelab' // your Ko-fi username; leave empty to hide the support link
};
const APP = { APP_NAME: PROJECT.name, FILE_PREFIX: PROJECT.filePrefix, VERSION: pkg.version };
const appUrl = /^https:\/\/[\w.-]+\/?$/.test(PROJECT.appUrl) ? PROJECT.appUrl.replace(/\/$/, '') : '';
APP.APP_URL = appUrl || 'its https web address';
APP.APP_HOST = appUrl ? appUrl.replace('https://', '') : 'the https address';
const safeUrl = u => /^https:\/\/[\w.-]+(\/[\w./%-]*)?$/.test(u) ? u : '';
const repo = safeUrl(PROJECT.repoUrl), kofi = /^[A-Za-z0-9_]{1,60}$/.test(PROJECT.kofi) ? 'https://ko-fi.com/' + PROJECT.kofi : '';
const about = `<div class="card" id="aboutCard">
      <div><div class="dev-name">About ${APP.APP_NAME}</div><div class="dev-meta">Version ${APP.VERSION} · free and open source (GNU GPL v3) · runs entirely on this device</div></div>
      <p class="dev-meta" style="margin:0">© 2026 Anonaconda Code Lab. You may use, share and modify this app under the GNU General Public License v3 or later; it comes with no warranty. Independent software, not affiliated with Polar Electro. Not a medical device.</p>
      <div class="acts-row"><button id="btnHelp2" class="btn">User manual</button>${repo ? `<a class="btn" href="${repo}" target="_blank" rel="noopener noreferrer">Source code</a>` : ''}${kofi ? `<a class="btn coffee" href="${kofi}" target="_blank" rel="noopener noreferrer">☕ Support on Ko-fi</a>` : ''}</div>
    </div>`;

const src = f => readFileSync(join(root, 'src', f), 'utf8');

// minimal Markdown renderer for docs/MANUAL.md (headings, paragraphs, lists, '> ' callouts, bold, italics, code, https links)
function md(text) {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const inline = s => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\w)/g, '$1<i>$2</i>')
    .replace(/(?<!["\/])\bhttps:\/\/[\w.\/-]+[\w\/]/g, u => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u.replace('https://', '')}</a>`);
  const out = []; let para = [], list = null, quote = null;
  const flushP = () => { if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`); para = []; };
  const flushL = () => { if (list) out.push(`<${list.t}>${list.items.map(i => `<li>${inline(i.text)}${i.sub.length ? `<ul>${i.sub.map(x => `<li>${inline(x)}</li>`).join('')}</ul>` : ''}</li>`).join('')}</${list.t}>`); list = null; };
  const flushQ = () => { if (quote) out.push(`<div class="callout">${md(quote.join('\n'))}</div>`); quote = null; };
  for (const line of text.split('\n')) {
    if (/^>( |$)/.test(line)) { flushP(); flushL(); (quote = quote || []).push(line.replace(/^> ?/, '')); continue; }
    flushQ();
    const h = line.match(/^(#{1,3}) (.*)/), li = line.match(/^(-|\d+\.) (.*)/), sub = line.match(/^ {2,3}- (.*)/), cont = /^ {2,}\S/.test(line);
    if (/^-{3,}$/.test(line)) { flushP(); flushL(); out.push('<hr>'); }
    else if (h) { flushP(); flushL(); const n = h[1].length; if (n > 1) out.push(`<h${n}>${inline(h[2])}</h${n}>`); }
    else if (li) { flushP(); const t = li[1] === '-' ? 'ul' : 'ol'; if (!list || list.t !== t) { flushL(); list = { t, items: [] }; } list.items.push({ text: li[2], sub: [] }); }
    else if (sub && list) list.items[list.items.length - 1].sub.push(sub[1]);
    else if (cont && list) { const it = list.items[list.items.length - 1]; if (it.sub.length && /^ {4,}\S/.test(line)) it.sub[it.sub.length - 1] += ' ' + line.trim(); else it.text += ' ' + line.trim(); }
    else if (!line.trim()) { flushP(); flushL(); }
    else { flushL(); para.push(line.trim()); }
  }
  flushP(); flushL(); flushQ(); return out.join('\n');
}
const manual = md(readFileSync(join(root, 'docs', 'MANUAL.md'), 'utf8'));
const b64 = f => readFileSync(join(root, 'src', 'fonts', f)).toString('base64');
const fill = s => s.replace(/\{\{(APP_NAME|FILE_PREFIX|VERSION|APP_URL|APP_HOST)\}\}/g, (_, k) => APP[k]).replace('{{ABOUT}}', about).replace('{{MANUAL}}', () => manual);

const fonts = `@font-face{font-family:"Instrument Sans";font-style:normal;font-display:swap;font-weight:400 700;font-stretch:75% 100%;src:url(data:font/woff2;base64,${b64('InstrumentSans-latin-variable.woff2')}) format("woff2-variations")}
@font-face{font-family:"IBM Plex Mono";font-style:normal;font-display:swap;font-weight:400;src:url(data:font/woff2;base64,${b64('IBMPlexMono-latin-400.woff2')}) format("woff2")}
@font-face{font-family:"IBM Plex Mono";font-style:normal;font-display:swap;font-weight:500;src:url(data:font/woff2;base64,${b64('IBMPlexMono-latin-500.woff2')}) format("woff2")}`;

const css = `<style>${fonts}\n${src('style.css')}</style>`;
const js = `<script>\n${fill(src('core.js'))}\n${fill(src('app.js'))}\n</script>`;
const body = fill(src('body.html'));
const title = `<title>${APP.APP_NAME}</title>`;

const CSP = ["default-src 'none'", "script-src 'unsafe-inline'", "style-src 'unsafe-inline'", 'font-src data:', "img-src 'self' data: blob:",
  "connect-src 'none'", "media-src 'none'", "object-src 'none'", "frame-src 'none'", "worker-src 'self'", "manifest-src 'self'",
  "base-uri 'none'", "form-action 'none'"].join('; ');

const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="referrer" content="no-referrer">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#2b6f68" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0e1416" media="(prefers-color-scheme: dark)">
<meta name="description" content="${APP.APP_NAME}: a calm morning HRV reading, standing test and paced breathing with a chest-strap heart-rate monitor. Runs entirely in your browser.">
${title}
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png" type="image/png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<style>html{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}</style>
${css}
</head><body>
${body}
${js}
</body></html>
`;

mkdirSync(join(root, 'dist'), { recursive: true });
const fragment = process.argv.includes('--fragment');
const out = fragment ? `${title}\n<meta name="claude:viewport-fit-sides" content="cover">\n${css}\n${body}\n${js}\n` : page;
const file = join(root, 'dist', fragment ? 'fragment.html' : 'index.html');
writeFileSync(file, out);

/* installable app: manifest, offline service worker and icons, next to index.html */
if (!fragment) {
  const icons = ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];
  for (const f of icons) copyFileSync(join(root, 'src', 'icons', f), join(root, 'dist', f));
  writeFileSync(join(root, 'dist', 'manifest.webmanifest'), JSON.stringify({
    name: APP.APP_NAME, short_name: APP.APP_NAME, description: 'Morning HRV, standing test and calm breathing with a Polar H10. Everything stays on your device.',
    start_url: './', scope: './', display: 'standalone', orientation: 'portrait', background_color: '#0e1416', theme_color: '#2b6f68',
    icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }]
  }, null, 2));
  /* network first for the page so updates arrive straight away; the cached copy is used offline */
  writeFileSync(join(root, 'dist', 'sw.js'), `/* ${APP.APP_NAME} ${APP.VERSION} offline support. GPL-3.0-or-later */
const CACHE = 'stillpoint-${APP.VERSION}';
const FILES = ['./', './index.html', './manifest.webmanifest', ${icons.map(f => `'./${f}'`).join(', ')}];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  if (r.mode === 'navigate') { e.respondWith(fetch(r).then(res => { const c = res.clone(); caches.open(CACHE).then(x => x.put('./index.html', c)); return res; }).catch(() => caches.match('./index.html'))); return; }
  e.respondWith(caches.match(r).then(m => m || fetch(r)));
});
`);
}

// sanity checks: script parses, no remote resources
new Function(js.slice(8, -9));
const stripped = out.replace(/<code>[^<]*<\/code>/g, '');
// anything the page would load by itself (scripts, styles, images, frames) must be local; plain <a href> links are allowed
const remote = stripped.match(/\bsrc\s*=\s*["']https?:|<link\b[^>]*href\s*=\s*["']https?:|url\(\s*["']?https?:/gi);
if (remote) { console.error('Remote resource reference found:', remote); process.exit(1); }
console.log(`${APP.APP_NAME} ${APP.VERSION} -> ${file} (${(out.length / 1024).toFixed(0)} KB)`);
