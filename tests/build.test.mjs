// Copyright (C) 2026 Anonaconda Code Lab · SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distHtml } from './helpers.mjs';

test('built page is self-contained and locked down', () => {
  const h = distHtml();
  assert.match(h, /Content-Security-Policy" content="default-src 'none';[^"]*connect-src 'none'/);
  assert.ok(!/\bsrc\s*=\s*["']https?:|<link\b(?![^>]*rel="canonical")[^>]*href\s*=\s*["']https?:|url\(\s*["']?https?:/i.test(h), 'no remote resources');
  for (const m of h.matchAll(/<a\b[^>]*href="https?:[^"]*"[^>]*>/g)) assert.match(m[0], /rel="noopener noreferrer"/, 'external links are isolated');
  assert.ok(!/fetch\(|XMLHttpRequest|WebSocket|sendBeacon/.test(h), 'no network APIs');
  assert.ok(!/\{\{[A-Z_]+\}\}/.test(h), 'all placeholders filled');
  assert.ok(h.includes('<title>Still Point</title>'));
});

test('manual is built in and the pace buttons cover 3 to 7 in half steps', () => {
  const h = distHtml();
  assert.ok(h.includes('<h2>The standing test</h2>') && h.includes('<h2>Breathe</h2>'));
  assert.ok(h.includes('const PACES = [3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7]'));
});

test('web app, Android package and Android build all carry the same version', async () => {
  const { readFileSync } = await import('node:fs');
  const r = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  const v = JSON.parse(r('package.json')).version, [a, b, c] = v.split('.').map(Number);
  assert.equal(JSON.parse(r('mobile/package.json')).version, v, 'mobile/package.json');
  const g = r('mobile/android/app/build.gradle');
  assert.match(g, new RegExp(`versionName "${v.replace(/\./g, '\\.')}"`), 'versionName');
  assert.match(g, new RegExp(`versionCode ${a * 10000 + b * 100 + c}\\b`), 'versionCode');
  assert.ok(new RegExp(`^## ${v.replace(/\./g, '\\.')}$`, 'm').test(r('CHANGELOG.md')), 'CHANGELOG has an entry for ' + v);
});

test('Android download page and About: version, certificate, source and contact', async () => {
  const { readFileSync } = await import('node:fs');
  const r = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  const v = JSON.parse(r('package.json')).version, page = r('dist/android.html'), h = distHtml();
  assert.ok(!/\{\{[A-Z_]+\}\}/.test(page), 'all placeholders filled');
  assert.ok(page.includes(`StillPoint-${v}.apk`) && page.includes("var latest = '" + v + "'"));
  assert.match(page, /([0-9A-F]{2}:){31}[0-9A-F]{2}/, 'certificate fingerprint');
  assert.ok(page.includes('https://github.com/Anonaconda-CodeLab/still-point/releases/latest'));
  assert.ok(h.includes(`android.html?v=${v}`) && h.includes('mailto:hello@anonacondacodelab.com') && h.includes('github.com/Anonaconda-CodeLab/still-point'));
});
