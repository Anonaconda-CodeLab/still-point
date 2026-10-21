/* ===== {{APP_NAME}} · strap, storage, screens =====
   Copyright (C) 2026 Anonaconda Code Lab
   SPDX-License-Identifier: GPL-3.0-or-later
*/
const $ = s => document.querySelector(s);
let FRAMED = false; try { FRAMED = window.top !== window.self; } catch (e) { FRAMED = true; }
const SETTLE = 15, STAND = 120, LEAD = 5;
const POS = { lying: 'Lying', sitting: 'Sitting', standing: 'Standing' };
const LENS = [60, 120, 180, 300];
const HIST_FORMAT = 'still-point-history', READING_FORMAT = 'still-point-reading';

const S = {
  device: null, hrc: null, connected: false, battery: null, demo: false, sim: null, demoT0: 0, demoTimer: null,
  hr: null, lastBeat: 0, act: null, wake: null, audio: null, raf: 0, timer: 0, reconnecting: false,
  readings: [], sessions: [], trendPos: null
};

/* ---------- small helpers ---------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad2 = v => String(v).padStart(2, '0');
const mmss = sec => { sec = Math.max(0, Math.ceil(sec)); return Math.floor(sec / 60) + ':' + pad2(sec % 60); };
const f0 = v => fin(v) ? String(Math.round(v)) : '—';
const f1 = v => fin(v) ? v.toFixed(1) : '—';
const f2 = v => fin(v) ? v.toFixed(2) : '—';
const sgn = v => fin(v) ? (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(Math.round(v)) : '—';
const paceTxt = p => (p % 1 ? p.toFixed(1) : String(p));
function when(t) {
  const d = new Date(t), today = dayKey(Date.now()) === dayKey(t), yest = dayKey(Date.now() - DAY) === dayKey(t);
  const hm = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  return (today ? 'Today' : yest ? 'Yesterday' : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })) + ' · ' + hm;
}
let toastT;
function toast(msg, ms = 4200) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, ms); }
const TABS = ['scrToday', 'scrBreathe', 'scrTrends'];
function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
  document.body.dataset.screen = id; document.body.classList.toggle('tabbed', TABS.includes(id));
  for (const b of document.querySelectorAll('#tabs button')) { if (b.dataset.tab === id) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }
  $('#wellLine').hidden = !TABS.includes(id);
  window.scrollTo(0, 0);
  if (id === 'scrToday') renderToday(); if (id === 'scrTrends') renderTrends(); if (id === 'scrBreathe') renderBreathe();
}
function downloadFile(name, text, type = 'application/json') {
  if (NATIVE) { AppNative.saveFile(name, text, type).then(r => { if (r.saved) toast('Saved.'); }).catch(e => toast('Could not save the file: ' + (e && e.message || e), 6000)); return; }
  if (FRAMED) { toast('Saving files works when the app is opened from its own web address in Chrome.', 6000); return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
async function keepAwake() {
  if (NATIVE) { AppNative.keepScreenOn(true); AppNative.active(true, S.act && S.act.kind === 'reading' ? 'Reading in progress' : 'Session in progress'); return; }
  try { if (navigator.wakeLock) S.wake = await navigator.wakeLock.request('screen'); } catch (e) {}
}
function letSleep() {
  if (NATIVE) { AppNative.keepScreenOn(false); AppNative.active(false); return; }
  try { S.wake && S.wake.release(); } catch (e) {} S.wake = null;
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.act) keepAwake(); });

/* ---------- settings ---------- */
const DEFAULTS = { pos: 'lying', len: 120, ortho: false, pace: 6, ratio: 0.4, rhythm: '', custom: { tin: 4, h1: 0, tout: 6, h2: 0 }, dur: 10, medLen: 10, sound: true, vibe: false, resPace: null, training: true };
function getSettings() { let s = {}; try { s = JSON.parse(localStorage.getItem('stillpoint.settings') || '{}') || {}; } catch (e) {} return Object.assign({}, DEFAULTS, s); }
function patchSettings(p) { try { localStorage.setItem('stillpoint.settings', JSON.stringify(Object.assign(getSettings(), p))); } catch (e) {} }

/* ---------- storage (IndexedDB) ---------- */
let dbP = null;
function db() {
  return dbP = dbP || new Promise((res, rej) => {
    let rq; try { rq = indexedDB.open('stillpoint', 1); } catch (e) { return rej(e); }
    rq.onupgradeneeded = () => { const d = rq.result; if (!d.objectStoreNames.contains('readings')) d.createObjectStore('readings', { keyPath: 'id' }); if (!d.objectStoreNames.contains('sessions')) d.createObjectStore('sessions', { keyPath: 'id' }); };
    rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
  });
}
async function idb(store, mode, fn) {
  try {
    const d = await db();
    return await new Promise((res, rej) => { const tx = d.transaction(store, mode), r = fn(tx.objectStore(store)); tx.oncomplete = () => res(r && r.result !== undefined ? r.result : undefined); tx.onerror = () => rej(tx.error); });
  } catch (e) { if (mode === 'readonly') return []; throw e; }
}
async function loadAll() {
  S.readings = ((await idb('readings', 'readonly', s => s.getAll())) || []).sort((a, b) => a.t - b.t);
  S.sessions = ((await idb('sessions', 'readonly', s => s.getAll())) || []).sort((a, b) => a.t - b.t);
}
async function persistStorage() { try { if (navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch (e) {} }
/* sleep aids are typed by the person ("magnesium, chamomile tea"); each one is compared like a tag */
const aidKey = a => 'aid:' + a.toLowerCase();
function cleanAids(v) {
  const list = Array.isArray(v) ? v : String(v || '').split(/[,;\n]/), seen = new Set(), out = [];
  for (let a of list) {
    a = String(a || '').replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (a && !seen.has(a.toLowerCase())) { seen.add(a.toLowerCase()); out.push(a); }
  }
  return out.slice(0, 6);
}
/* sleep aids used before, most recent first (spelling as last typed) */
function knownAids() { const m = new Map(); for (const r of S.readings.slice().sort((a, b) => b.t - a.t)) for (const a of r.sleepAids || []) if (!m.has(a.toLowerCase())) m.set(a.toLowerCase(), a); return [...m.values()]; }
const effectLabels = () => Object.assign({}, TAG_LABEL, Object.fromEntries(knownAids().map(a => [aidKey(a), 'Sleep aid: ' + a])));
const forBaseline = r => ({ id: r.id, t: r.t, pos: r.pos, type: r.type || 'morning', ln: r.m.ln, hr: r.m.hr, quality: r.m.quality, tags: (r.tags || []).concat((r.sleepAids || []).map(aidKey)), sleepScore: r.sleepScore, sleepHours: r.sleepHours });
const lenTxt = sec => sec % 60 ? `${Math.round(sec / 6) / 10} min` : `${sec / 60} min`;
/* optional morning tags: things that often move HRV */
const TAGS = [['slept_badly', 'Slept badly'], ['slept_well', 'Slept well'], ['alcohol', 'Alcohol last night'], ['hard_training', 'Hard training yesterday'], ['rest_day', 'Rest day yesterday'],
  ['sore', 'Sore muscles'], ['ill', 'Feeling ill'], ['stressed', 'Stressed'], ['late_meal', 'Late or heavy meal'], ['caffeine', 'Caffeine before the reading'], ['travel', 'Travel or jet lag'], ['period', 'Period']];
const TAG_LABEL = Object.fromEntries(TAGS);
/* readings that feed the baseline: everything, or from the date the person chose to start afresh */
const baseR = list => { const f = getSettings().baseFrom; return (f ? list.filter(r => r.t >= f) : list).map(forBaseline); };
const allReadings = () => S.pending && !S.readings.some(x => x.id === S.pending.id) ? S.readings.concat([S.pending]) : S.readings;

/* compute everything for a reading from its beat intervals (also used for imports, so stored numbers always match the data) */
function computeReading(r) {
  const C = cleanRR(r.rr), m = hrvOf(C, r.settle, r.settle + r.len);
  r.m = { br: breathRate(C, r.settle, r.settle + r.len), ln: m.ln, rmssd: m.rmssd, hr: m.hr, sdnn: m.sdnn, artPct: m.artPct, quality: m.quality, score: m.score, beats: m.beats, fixed: m.beats - m.good };
  r.o = r.standAt != null ? orthoOf(C, r.standAt, r.standAt + STAND) : null;
  return r;
}

/* ---------- acknowledgement ---------- */
const acked = () => { try { return localStorage.getItem('stillpoint.ack') === '1'; } catch (e) { return true; } };
$('#ackBox').onchange = e => { $('#btnAck').disabled = !e.target.checked; };
$('#btnAck').onclick = () => { try { localStorage.setItem('stillpoint.ack', '1'); } catch (e) {} persistStorage(); show('scrToday'); };
$('#btnAckManual').onclick = () => { S.helpBack = 'scrAck'; show('scrHelp'); };

/* ---------- Bluetooth ---------- */
function btProblem() {
  if (NATIVE) return '';
  const ua = navigator.userAgent, linux = /Linux/.test(ua) && !/Android/.test(ua), brave = !!navigator.brave;
  const scheme = brave ? 'brave' : 'chrome', flag = f => `<code>${scheme}://flags/#${f}</code>`;
  if (FRAMED) return '<b>Bluetooth is blocked in this preview.</b> To use your strap, open the app from {{APP_URL}}. The simulated strap works here.';
  if (!window.isSecureContext || location.protocol !== 'https:' && location.hostname !== 'localhost')
    return `<b>This page was opened from ${esc(location.protocol === 'file:' ? 'a file on your device' : location.protocol + '//' + location.host)}.</b> Bluetooth only works on https pages. Open <code>{{APP_URL}}</code> instead.`;
  if ('bluetooth' in navigator) return '';
  if (brave) return `<b>Brave has Bluetooth for websites switched off.</b> Open ${flag('brave-web-bluetooth-api')}, set it to Enabled, then relaunch Brave.`;
  if (linux) return `<b>Chromium on Linux keeps Bluetooth for websites behind a setting.</b> Open ${flag('enable-experimental-web-platform-features')}, set it to Enabled, then relaunch.`;
  if (/Firefox|SamsungBrowser/.test(ua) || /iPhone|iPad|Macintosh/.test(ua) && !/Chrome/.test(ua)) return '<b>This browser can’t use Bluetooth from websites.</b> On a phone, use Google Chrome or Chromium on Android; on a computer, use Chrome or Edge.';
  return `<b>Bluetooth for websites is switched off in this browser.</b> Try enabling ${flag('enable-experimental-web-platform-features')}, then relaunch.`;
}
function envCheck() { const n = $('#envNote'), msg = btProblem(); n.innerHTML = msg; n.hidden = !msg; return !msg; }
function setDev(state, name, meta) {
  const dot = $('#devDot'); dot.className = 'dot' + (state === 'on' ? ' on' : state === 'busy' ? ' busy' : '');
  if (name) $('#devName').textContent = name; if (meta !== undefined) $('#devMeta').textContent = meta;
  $('#btnConnect').textContent = state === 'on' ? 'Disconnect' : 'Connect H10';
  $('#btnConnect').disabled = state === 'busy';
  const on = state === 'on';
  $('#strapPill').hidden = !on; $('#strapPillTxt').textContent = S.demo ? 'Simulated' : 'H10' + (S.battery != null ? ' · ' + S.battery + '%' : '');
  updateBreatheAvail(); if (document.body.dataset.screen === 'scrSetup') setupHint();
}
async function connectFlow() {
  if (!acked()) { show('scrAck'); return; }
  if (S.demo) { stopDemo(); return; }
  if (S.connected && S.device) { S.manualDisconnect = true; try { S.device.gatt.disconnect(); } catch (e) {} return; }
  if (!('bluetooth' in navigator) || FRAMED) { envCheck(); $('#envNote').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  try {
    setDev('busy', 'Searching for Polar H10…', 'Select your strap in the list that appears.');
    S.device = await navigator.bluetooth.requestDevice({ filters: [{ namePrefix: 'Polar H10' }, { namePrefix: 'Polar H9' }], optionalServices: ['heart_rate', 'battery_service'] });
    S.device.addEventListener('gattserverdisconnected', onDisconnected);
    await gattSetup();
    setDev('on', S.device.name || 'Polar H10', S.battery != null ? 'Battery ' + S.battery + '%' : 'Connected');
  } catch (e) {
    S.connected = false;
    setDev('off', 'Polar H10 not connected', e && e.name === 'NotFoundError' ? 'No strap was selected.' : 'Connection failed: ' + (e && e.message ? e.message : e));
  }
}
async function gattSetup() {
  const server = await S.device.gatt.connect();
  const h = await server.getPrimaryService('heart_rate');
  S.hrc = await h.getCharacteristic('heart_rate_measurement');
  S.hrc.addEventListener('characteristicvaluechanged', onHR); await S.hrc.startNotifications();
  S.connected = true;
  try { const b = await server.getPrimaryService('battery_service'); const c = await b.getCharacteristic('battery_level'); S.battery = (await c.readValue()).getUint8(0); } catch (e) {}
}
function onHR(ev) {
  const v = ev.target.value, f = v.getUint8(0); let o = 1;
  const hr = f & 1 ? v.getUint16(1, true) : v.getUint8(1); o += f & 1 ? 2 : 1; if (f & 8) o += 2;
  const rrs = []; if (f & 16) for (; o + 1 < v.byteLength; o += 2) rrs.push(v.getUint16(o, true) / 1024 * 1000);
  beats(rrs, performance.now(), hr);
}
async function onDisconnected() {
  S.connected = false; S.hrc = null;
  if (S.act) S.act.list.push([actClock(), -1]);
  if (S.manualDisconnect) { S.manualDisconnect = false; setDev('off', 'Polar H10 not connected', 'Disconnected.'); return; }
  setDev('busy', 'Reconnecting…', 'The strap dropped out. Trying again.');
  $('#rdConn').textContent = 'Reconnecting…'; $('#rdConn').classList.add('bad');
  for (let i = 0; i < 6 && !S.connected; i++) {
    await new Promise(r => setTimeout(r, 1500 + i * 1000));
    try { await gattSetup(); } catch (e) {}
  }
  if (S.connected) { setDev('on', S.device.name || 'Polar H10', 'Reconnected'); $('#rdConn').textContent = 'Reconnected'; $('#rdConn').classList.remove('bad'); }
  else setDev('off', 'Polar H10 not connected', 'Lost the connection. Check the strap is on and moist, then connect again.');
}

/* simulated strap: produces beat intervals that follow the breathing guide and the standing test */
function startDemo() {
  if (!acked()) { show('scrAck'); return; }
  S.demo = true; S.sim = makeSim((Date.now() / 1000) | 0); S.demoT0 = performance.now(); S.connected = true; S.battery = null;
  S.demoTimer = setInterval(() => {
    const now = performance.now(), target = (now - S.demoT0) / 1000, out = [];
    while (S.sim.t < target) out.push(S.sim.next(simCtx())[1]);
    if (out.length) beats(out, now, Math.round(60000 / out[out.length - 1]));
  }, 1000);
  setDev('on', 'Simulated strap', 'Made-up heart beats for trying the app. Tap Discard at the end so they stay out of your history.');
}
function stopDemo() { clearInterval(S.demoTimer); S.demo = false; S.connected = false; S.sim = null; setDev('off', 'Polar H10 not connected', 'Moisten the electrodes, fit the strap, then connect.'); }
function simCtx() {
  const a = S.act; if (!a || a.simOff == null) return {};
  const c = {}, off = a.simOff;
  if (a.lungAt) { c.pace = a.paceNow(); c.lung = t => a.lungAt(t - off); }
  if (a.standAt != null) c.standAt = off + a.standAt;
  return c;
}

/* every beat interval arrives here; the active reading or session keeps its own clock */
function actClock() { return S.act ? (performance.now() - S.act.t0) / 1000 : 0; }
function beats(rrs, now, hr) {
  if (rrs.length) { S.hr = Math.round(60000 / rrs[rrs.length - 1]); S.lastBeat = now; } else if (hr) S.hr = hr;
  const a = S.act; if (!a || !rrs.length) return;
  const tEnd = (now - a.t0) / 1000, sum = rrs.reduce((x, y) => x + y, 0) / 1000;
  if (a.beatClock == null || Math.abs(a.beatClock + sum - tEnd) > 1.5) a.beatClock = tEnd - sum;
  for (const rr of rrs) { a.beatClock += rr / 1000; a.list.push([+a.beatClock.toFixed(3), +rr.toFixed(1)]); }
}

/* ---------- chips ---------- */
function buildChips(el, defs, val, onPick) {
  el.innerHTML = '';
  for (const [v, label] of defs) {
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(String(v) === String(val))); b.textContent = label; b.dataset.v = v;
    b.onclick = () => { for (const x of el.children) x.setAttribute('aria-checked', 'false'); b.setAttribute('aria-checked', 'true'); onPick(v); };
    el.appendChild(b);
  }
}
function seg(el, val, onPick) {
  for (const b of el.children) {
    b.setAttribute('aria-checked', String(b.dataset.v === String(val)));
    b.onclick = () => { for (const x of el.children) x.setAttribute('aria-checked', 'false'); b.setAttribute('aria-checked', 'true'); onPick(b.dataset.v); };
  }
}

/* ---------- HOME and reading setup ---------- */
const TYPES = {
  morning: { title: 'Morning reading', sub: 'On waking, before coffee, in the same position each day. This builds your baseline.', type: 'morning', ortho: false },
  standing: { title: 'Morning reading + standing test', sub: 'The morning reading, then a chime asks you to stand up calmly and stay standing for 2 minutes.', type: 'morning', ortho: true },
  spot: { title: 'Spot check', sub: 'A reading at any time of day, for example after a busy afternoon or before bed. It is saved but doesn’t change your baseline.', type: 'spot', ortho: false }
};
const CFG_DEFAULT = { morning: { pos: 'lying', len: 120 }, standing: { pos: 'lying', len: 120 }, spot: { pos: 'sitting', len: 120 } };
const cfgKey = k => k === 'standing' ? 'morning' : k; /* the standing test uses the morning settings so its reading joins the same baseline */
const cfgOf = k => Object.assign({}, CFG_DEFAULT[cfgKey(k)], (getSettings().cfg || {})[cfgKey(k)]);
function setCfg(k, p) { const c = Object.assign({}, getSettings().cfg); c[cfgKey(k)] = Object.assign(cfgOf(k), p); patchSettings({ cfg: c }); }
const typeLabel = r => r.type === 'spot' ? 'Spot check' : r.o ? 'Morning + standing' : 'Morning reading';

function greeting() { const h = new Date().getHours(); return h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; }
function renderToday() {
  $('#greetH').textContent = greeting();
  $('#greetP').textContent = 'What would you like to do?';
  const todays = S.readings.filter(r => dayKey(r.t) === dayKey(Date.now()));
  const doneMorning = todays.some(r => r.type !== 'spot');
  $('#chMorningBadge').hidden = !doneMorning;
  const pos = cfgOf('morning').pos, b = baseline(baseR(S.readings), pos);
  $('#chMorning').textContent = b.ready ? `${cfgOf('morning').len / 60} minutes on waking. Compared with your usual range.` : b.have ? `${cfgOf('morning').len / 60} minutes on waking. Baseline: ${b.have} of ${b.need} days.` : `${cfgOf('morning').len / 60} minutes on waking. Builds your baseline.`;
  /* Monday recap of last week, once */
  const wk = $('#weekCard'), lastW = weekStart(Date.now()) - 7 * DAY, seen = getSettings().weekSeen;
  const recap = seen !== dayKey(lastW) ? weekHtml(lastW, 'Your week') : '';
  if (recap) { wk.outerHTML = recap.replace('<div class="card week"', '<div id="weekCard" class="card week"'); const w2 = $('#weekCard'); w2.insertAdjacentHTML('beforeend', '<div class="acts-row"><button class="btn" id="btnWeekSeen">Got it</button></div>'); $('#btnWeekSeen').onclick = () => { patchSettings({ weekSeen: dayKey(lastW) }); w2.hidden = true; }; }
  else wk.hidden = true;
  $('#installCard').hidden = !S.installEvt || getSettings().installLater > Date.now();
  const card = $('#todayResult');
  if (todays.length) {
    card.innerHTML = `<div class="dev-name">Today</div><ul class="past">${todays.slice().reverse().map(r => `<li><button class="li-btn" data-id="${esc(r.id)}"><span class="meta"><b>${typeLabel(r)}</b><span>${esc(when(r.t).split(' · ')[1])} · ${POS[r.pos]} · ${f0(r.m.hr)} bpm</span></span><span class="val">${r.m.score ?? '—'}<small>SCORE</small></span></button></li>`).join('')}</ul>`;
    card.hidden = false;
    for (const x of card.querySelectorAll('.li-btn')) x.onclick = () => { S.resultBack = 'scrToday'; openResult(x.dataset.id); };
  } else card.hidden = true;
}
for (const c of document.querySelectorAll('#choices .choice')) c.onclick = () => {
  if (!acked()) return show('scrAck');
  if (c.dataset.go === 'breathe') return show('scrBreathe');
  openSetup(c.dataset.go);
};
function openSetup(kind) {
  S.setup = kind; const T = TYPES[kind], c = cfgOf(kind);
  $('#setupH').textContent = T.title; $('#setupP').textContent = T.sub;
  const posDefs = Object.entries(POS).filter(([k]) => !(T.ortho && k === 'standing'));
  if (T.ortho && c.pos === 'standing') c.pos = 'lying';
  buildChips($('#posChips'), posDefs, c.pos, v => { setCfg(kind, { pos: v }); setupHint(); });
  buildChips($('#lenChips'), LENS.map(x => [x, x / 60 + ' min']), c.len, v => { setCfg(kind, { len: +v }); setupHint(); });
  setupHint(); show('scrSetup');
}
function setupHint() {
  const kind = S.setup; if (!kind) return;
  const T = TYPES[kind], c = cfgOf(kind), total = SETTLE + c.len + (T.ortho ? STAND : 0);
  $('#setupHint').textContent = `About ${Math.ceil(total / 60)} min in total, including ${SETTLE} s to settle.` + (kind !== 'spot' ? ' Use the same position and length every morning so readings compare.' : '');
  $('#setupConn').hidden = S.connected; $('#btnBegin').disabled = !S.connected;
  $('#beginHint').textContent = T.ortho ? 'Have somewhere to sit down nearby. Stop if you feel faint.' : 'Breathe normally and keep still.';
}
$('#btnSetupBack').onclick = () => show('scrToday');
$('#btnSetupConnect').onclick = connectFlow;
$('#btnSetupDemo').onclick = startDemo;
$('#btnConnect').onclick = connectFlow;

function scoreRing(score, size = 104) {
  const r = 44, c = 2 * Math.PI * r, p = fin(score) ? clamp(score, 0, 100) / 100 : 0;
  return `<div class="score" style="width:${size}px;height:${size}px"><svg viewBox="0 0 100 100"><circle class="s-bg" cx="50" cy="50" r="${r}"/><circle class="s-fg" cx="50" cy="50" r="${r}" stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}"/></svg><b style="font-size:${size * .34}px">${score == null ? '—' : score}</b></div>`;
}

/* reading in progress */
$('#btnBegin').onclick = async () => {
  if (!S.connected || !S.setup) return;
  const T = TYPES[S.setup], c = cfgOf(S.setup), ortho = T.ortho && c.pos !== 'standing';
  S.act = { kind: 'reading', t0: performance.now(), wall: Date.now(), list: [], beatClock: null, simOff: S.demo ? S.sim.t : null, type: T.type, pos: c.pos, len: c.len, ortho, standAt: null, phase: '' };
  ensureAudio(); keepAwake(); show('scrReading');
  $('#rdConn').textContent = S.demo ? 'Simulated' : 'Connected'; $('#rdConn').classList.remove('bad');
  clearInterval(S.timer); S.timer = setInterval(tickReading, 250); tickReading();
};
function tickReading() {
  const a = S.act; if (!a || a.kind !== 'reading') return;
  const el = actClock(), endRead = SETTLE + a.len, end = endRead + (a.ortho ? STAND : 0);
  let phase, left, frac, sub, msg;
  if (el < SETTLE) { phase = 'Settling'; left = SETTLE - el; frac = el / SETTLE; sub = 'settling'; msg = POS[a.pos] === 'Lying' ? 'Lie still and breathe normally.' : 'Sit still and breathe normally.'; if (a.pos === 'standing') msg = 'Stand still and breathe normally.'; }
  else if (el < endRead) { phase = 'Reading'; left = endRead - el; frac = (el - SETTLE) / a.len; sub = 'reading'; msg = 'Stay still. Breathe normally.'; }
  else if (a.ortho && el < end) {
    if (a.standAt == null) { a.standAt = endRead; chime(523, true); chime(659, true, .25); vibrate([300, 120, 300]); }
    phase = 'Standing'; left = end - el; frac = (el - endRead) / STAND; sub = 'standing'; msg = el - endRead < 8 ? 'Stand up now, calmly.' : 'Stand still. Breathe normally.';
  } else { finishReading(); return; }
  if (phase !== a.phase) {
    if (a.phase === 'Settling') chime(440, false);
    a.phase = phase; $('#rdPhase').textContent = phase;
    $('#rdChip').classList.toggle('stand', phase === 'Standing'); $('#rdRing').classList.toggle('stand', phase === 'Standing');
  }
  $('#rdLeft').textContent = mmss(left); $('#rdSub').textContent = sub; $('#rdMsg').textContent = msg;
  $('#rdRing').style.strokeDashoffset = String(1000 - 1000 * clamp(frac, 0, 1));
  const fresh = performance.now() - S.lastBeat < 4000;
  $('#rdHR').textContent = fresh && S.hr ? S.hr : '--';
  $('#btnSkipSettle').hidden = phase !== 'Settling';
  /* live HRV and breathing over the last minute, refreshed every 2 s */
  if (!a.liveAt || performance.now() - a.liveAt > 2000) {
    a.liveAt = performance.now();
    const C = cleanRR(a.list.filter(x => x[0] >= el - 75)), h = hrvOf(C, el - 60, el + 1), br = breathRate(C, el - 60, el + 1);
    $('#rdHRV').textContent = h.diffs >= 15 && fin(h.rmssd) ? Math.round(h.rmssd) : '--';
    $('#rdBr').textContent = br ? (br < 10 ? br.toFixed(1) : Math.round(br)) : el > 35 ? '…' : '--';
  }
  drawWave($('#rdWave'), a.list.filter(x => x[0] >= el - 75), { t0: Math.max(0, el - 60), t1: Math.max(60, el), settle: SETTLE, standAt: a.standAt, live: true });
  const recent = a.list.slice(-40);
  if (recent.length >= 15) { const C = cleanRR(recent), bad = C.OK.filter(x => !x).length / C.OK.length; const q = $('#rdQual'); q.textContent = bad <= 0.05 ? 'Good' : bad <= 0.15 ? 'Fair' : 'Poor'; q.className = bad <= 0.05 ? 'q-good' : 'q-weak'; }
}
$('#btnSkipSettle').onclick = () => {
  const a = S.act; if (!a || a.kind !== 'reading') return;
  const left = SETTLE - actClock(); if (left <= 0) return;
  a.t0 -= left * 1000; if (a.simOff != null) a.simOff -= left; a.beatClock = null; tickReading();
};
$('#btnCancelReading').onclick = () => { endActivity(); show('scrSetup'); toast('Reading cancelled.'); };
function endActivity() { clearInterval(S.timer); cancelAnimationFrame(S.raf); S.act = null; letSleep(); $('#dim').hidden = true; }
async function finishReading() {
  const a = S.act; endActivity(); chime(392, false); chime(523, false, .3);
  const r = computeReading({ id: 'r' + a.wall, t: a.wall + SETTLE * 1000, type: a.type, pos: a.pos, len: a.len, settle: SETTLE, standAt: a.standAt, rr: a.list });
  if (r.m.beats < 30 || !fin(r.m.ln)) { toast('Not enough clean beats were received. Check the strap is moist and snug, then try again.', 7000); show('scrSetup'); return; }
  S.pending = r; S.resultBack = 'scrToday'; openResult(r.id);
}

/* ---------- reading result ---------- */
function spotVerdict(r) {
  const prev = S.readings.filter(x => x.type === 'spot' && x.pos === r.pos && x.id !== r.id && x.m.quality !== 'poor' && x.m.quality !== 'short' && fin(x.m.score)).slice(-30).map(x => x.m.score);
  const mb = baseline(baseR(allReadings()), r.pos, r.t);
  const parts = ['Spot checks are saved and charted but don’t change your morning baseline, because HRV naturally runs lower later in the day, after food, coffee or activity.'];
  if (prev.length >= 3) parts.push(`Your ${POS[r.pos].toLowerCase()} spot checks usually score about ${Math.round(median(prev))}.`);
  if (mb.ready) parts.push(`For reference, your morning usual range is ${Math.round(mb.lo * 100 / 6.5)}–${Math.round(mb.hi * 100 / 6.5)}.`);
  return { cls: 'build', title: 'Spot check', text: parts.join(' ') };
}
function verdictOf(b, r) {
  if (r.m.quality === 'poor' || r.m.quality === 'short') return { cls: 'build', title: r.m.quality === 'poor' ? 'Noisy reading' : 'Too short to judge', text: r.m.quality === 'poor' ? `${f0(r.m.artPct)} % of beats had to be left out, so this reading doesn’t count towards your baseline. Moisten the electrodes and keep still, then take another.` : 'Too few clean beats for a reliable value. It doesn’t count towards your baseline.' };
  if (r.type === 'spot') return spotVerdict(r);
  if (!b.ready) return { cls: 'build', title: 'Building your baseline', text: `Day ${b.have} of ${b.need}. After ${b.need} mornings in the same position, each reading is compared with your own usual range. Until then, the number on its own says little: HRV differs a lot from person to person.` };
  const parts = [];
  if (b.status === 'low') parts.push('Your 7-day average is below your usual range. This often follows hard training, short or poor sleep, alcohol, illness, travel or stress. An easier day and an early night are sensible.');
  else if (b.status === 'high') parts.push('Your 7-day average is above your usual range. Usually a sign of good recovery. If it comes with unusual tiredness after a block of very heavy training, it can also mean you’re run down.');
  else parts.push('Your 7-day average is within your usual range. Nothing stands out; a normal day by your own standards.');
  if (b.today && b.today.id === r.id) {
    if (b.todayZ < -1.5) parts.push('Today’s reading on its own is unusually low for you.');
    else if (b.todayZ > 1.5) parts.push('Today’s reading on its own is unusually high for you.');
    if (b.hrDelta >= 5) parts.push(`Resting heart rate is ${Math.round(b.hrDelta)} bpm above your usual.`);
  }
  return { cls: b.status === 'low' ? 'low' : b.status === 'high' ? 'high' : 'ok', title: b.status === 'low' ? 'Lower than usual' : b.status === 'high' ? 'Higher than usual' : 'In your usual range', text: parts.join(' ') };
}
function bandHtml(b, r) {
  if (!b.ready) return '';
  const lo = b.mean - 3 * b.sd, hi = b.mean + 3 * b.sd, x = v => clamp(100 * (v - lo) / (hi - lo), 0, 100).toFixed(1) + '%';
  return `<div class="band" aria-hidden="true"><div class="track"></div><div class="norm" style="left:${x(b.lo)};width:calc(${x(b.hi)} - ${x(b.lo)})"></div>
    ${fin(b.avg7) ? `<div class="mk avg" style="left:${x(b.avg7)}"></div>` : ''}<div class="mk" style="left:${x(r.m.ln)}"></div></div>
    <div class="band-l"><span>lower</span><span>higher</span></div>
    <div class="legend"><span><i style="background:var(--fg);width:4px"></i>this reading</span><span><i style="background:var(--accent);width:9px;height:9px;border-radius:50%"></i>7-day average</span><span><i style="background:color-mix(in srgb,var(--ok) 35%,transparent)"></i>usual range</span></div>`;
}
/* ---------- breath wave: beat-by-beat heart rate, shaded around its local average ----------
   teal where the heart speeds up (usually breathing in), lavender where it slows (breathing out);
   beats left out are hollow grey rings, off the line, exactly as the calculation skips them */
function waveData(list, t0, t1) {
  const C = cleanRR(list), pts = [], bad = [];
  for (let i = 0; i < C.T.length; i++) { const t = C.T[i]; if (t < t0 - 10 || t > t1 + 10) continue; (C.OK[i] ? pts : bad).push({ t, hr: 60000 / C.V[i], seg: C.SEG[i] }); }
  /* local average: mean of accepted beats within ±6 s, so the shading follows each breath, not slow drifts or standing up */
  for (const p of pts) { let s = 0, n = 0; for (const q of pts) if (q.seg === p.seg && Math.abs(q.t - p.t) <= 6) { s += q.hr; n++; } p.avg = s / n; }
  return { pts, bad };
}
function drawWave(cv, list, o) {
  if (!cv) return;
  const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const cs = getComputedStyle(document.documentElement), col = k => cs.getPropertyValue(k).trim();
  const up = col('--accent'), down = col('--lav'), ink = col('--fg'), muted = col('--muted'), line = col('--line'), warn = col('--warn');
  const { pts, bad } = waveData(list, o.t0, o.t1);
  const L = 30, R = 6, T = 8, B = o.live ? 8 : 20, X = t => L + (t - o.t0) / (o.t1 - o.t0) * (w - L - R);
  const vis = pts.filter(p => p.t >= o.t0 && p.t <= o.t1);
  g.font = `10px ${col('--f-mono') || 'monospace'}`; g.fillStyle = muted;
  if (vis.length < 3) { g.textAlign = 'center'; g.fillText(o.live ? 'waiting for beats…' : 'not enough beats to draw', w / 2, h / 2); return; }
  let lo = Math.min(...vis.map(p => p.hr)), hi = Math.max(...vis.map(p => p.hr));
  const mid = (lo + hi) / 2, half = Math.max(5, (hi - lo) / 2 * 1.12); lo = mid - half; hi = mid + half;
  const Y = v => T + (hi - clamp(v, lo, hi)) / (hi - lo) * (h - T - B);
  // grid and axis labels
  g.strokeStyle = line; g.lineWidth = 1; g.textAlign = 'right';
  for (const v of [Math.ceil(lo), Math.round(mid), Math.floor(hi)]) { const y = Y(v); g.beginPath(); g.moveTo(L, y); g.lineTo(w - R, y); g.stroke(); g.fillText(String(v), L - 5, y + 3); }
  // settle (faded) and standing marker
  if (o.settle > o.t0) { g.fillStyle = muted; g.globalAlpha = .08; g.fillRect(L, T, X(Math.min(o.settle, o.t1)) - L, h - T - B); g.globalAlpha = 1; if (!o.live && X(o.settle) - L > 34) { g.fillStyle = muted; g.textAlign = 'left'; g.fillText('settle', L + 4, T + 10); } }
  // shaded breath wave per continuous segment
  const segs = []; for (const p of pts) { if (!segs.length || segs[segs.length - 1][0].seg !== p.seg) segs.push([]); segs[segs.length - 1].push(p); }
  for (const sg of segs) {
    if (sg.length < 2) continue;
    const area = () => { g.beginPath(); sg.forEach((p, i) => i ? g.lineTo(X(p.t), Y(p.hr)) : g.moveTo(X(p.t), Y(p.hr))); for (let i = sg.length - 1; i >= 0; i--) g.lineTo(X(sg[i].t), Y(sg[i].avg)); g.closePath(); };
    const clipSide = above => { g.beginPath(); sg.forEach((p, i) => i ? g.lineTo(X(p.t), Y(p.avg)) : g.moveTo(X(p.t), Y(p.avg))); g.lineTo(X(sg[sg.length - 1].t), above ? 0 : h); g.lineTo(X(sg[0].t), above ? 0 : h); g.closePath(); g.clip(); };
    for (const [above, c] of [[true, up], [false, down]]) { g.save(); g.beginPath(); g.rect(L, 0, w - L - R, h); g.clip(); clipSide(above); area(); g.fillStyle = c; g.globalAlpha = .42; g.fill(); g.restore(); }
    g.save(); g.beginPath(); g.rect(L, 0, w - L - R, h); g.clip();
    g.beginPath(); sg.forEach((p, i) => i ? g.lineTo(X(p.t), Y(p.avg)) : g.moveTo(X(p.t), Y(p.avg))); g.setLineDash([3, 4]); g.strokeStyle = muted; g.globalAlpha = .55; g.lineWidth = 1; g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
    g.beginPath(); sg.forEach((p, i) => i ? g.lineTo(X(p.t), Y(p.hr)) : g.moveTo(X(p.t), Y(p.hr))); g.strokeStyle = ink; g.lineWidth = 1.8; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke();
    g.restore();
  }
  // beats left out
  g.strokeStyle = muted; g.lineWidth = 1.4;
  for (const b of bad) { if (b.t < o.t0 || b.t > o.t1) continue; g.beginPath(); g.arc(X(b.t), Y(b.hr), 3.2, 0, 2 * Math.PI); g.stroke(); }
  // standing up
  if (o.standAt != null && o.standAt >= o.t0 && o.standAt <= o.t1) {
    const x = X(o.standAt); g.strokeStyle = warn; g.lineWidth = 1.5; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(x, T); g.lineTo(x, h - B); g.stroke(); g.setLineDash([]);
    g.fillStyle = warn; g.textAlign = x > w - 70 ? 'right' : 'left'; g.fillText('stood up', x + (x > w - 70 ? -4 : 4), o.live ? T + 10 : h - B - 6);
    if (!o.live) { // peak: highest 3-beat average in the first 30 s
      const sp = pts.filter(p => p.t >= o.standAt && p.t <= o.standAt + 30); let best = null;
      for (let i = 2; i < sp.length; i++) { const m = (sp[i].hr + sp[i - 1].hr + sp[i - 2].hr) / 3; if (!best || m > best.m) best = { m, t: sp[i - 1].t }; }
      if (best) { g.fillStyle = warn; g.beginPath(); g.arc(X(best.t), Y(best.m), 4, 0, 2 * Math.PI); g.fill(); g.textAlign = 'left'; g.fillText(`peak ${Math.round(best.m)} bpm`, Math.min(X(best.t) + 8, w - 70), Y(best.m) + 4); }
    }
  }
  // time axis on results
  if (!o.live) { g.fillStyle = muted; g.textAlign = 'left'; g.fillText(mmss(o.t0), L, h - 5); g.textAlign = 'right'; g.fillText(mmss(o.t1), w - R, h - 5); g.textAlign = 'center'; g.fillText('bpm · minutes', (L + w - R) / 2, h - 5); }
}
/* beat-pattern chart (Poincaré plot): each beat against the next */
function poincareSvg(rr, t0 = -Infinity, t1 = Infinity) {
  const C = cleanRR(rr), P = [], Q = [];
  for (let i = 1; i < C.V.length; i++) { if (C.SEG[i] !== C.SEG[i - 1] || C.T[i] < t0 || C.T[i] > t1) continue; (C.OK[i] && C.OK[i - 1] ? P : Q).push([C.V[i - 1], C.V[i]]); }
  if (P.length < 10) return '';
  const all = P.flat(), lo0 = quant(all, 0.01), hi0 = quant(all, 0.99), pad = Math.max(40, (hi0 - lo0) * 0.25), lo = lo0 - pad, hi = hi0 + pad;
  const S = 150, M = 6, sc = v => M + (clamp(v, lo, hi) - lo) / (hi - lo) * (S - 2 * M), y = v => S - sc(v);
  const dots = P.map(([a, b]) => `<circle class="pc" cx="${sc(a).toFixed(1)}" cy="${y(b).toFixed(1)}" r="2.3"/>`).join('');
  const odd = Q.map(([a, b]) => `<circle class="pc-bad" cx="${sc(a).toFixed(1)}" cy="${y(b).toFixed(1)}" r="3"/>`).join('');
  return `<svg class="poincare" viewBox="0 0 ${S} ${S}" role="img" aria-label="Beat-to-beat pattern"><rect class="pc-bg" x="0.5" y="0.5" width="${S - 1}" height="${S - 1}" rx="10"/><line class="pc-id" x1="${M}" y1="${S - M}" x2="${S - M}" y2="${M}"/>${dots}${odd}</svg>`;
}
function quant(a, q) { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * q)))]; }
const KEY = `<div class="wave-key"><span><i class="k-up"></i>speeding up (breathing in)</span><span><i class="k-down"></i>slowing down (breathing out)</span><span><i class="k-bad"></i>left out</span></div>`;
function waveHtml(r) {
  const st = r.standAt != null, pc = poincareSvg(r.rr, r.settle || 0, (r.settle || 0) + r.len);
  return `<div class="sub-card wave-res"><h3>Your reading, beat by beat</h3>
    <canvas id="resWave" aria-label="Heart rate during the reading"></canvas>
    ${st ? '<h3 style="margin-top:6px">Standing up</h3><canvas id="resWave2" class="res-wave2" aria-label="Heart rate when standing up"></canvas>' : ''}
    ${KEY}
    ${pc ? `<div class="pc-row">${pc}<p class="fine"><b>Beat-to-beat pattern.</b> Each dot is one beat against the next. A wider, rounder cloud means more variation from beat to beat (higher HRV); a narrow one means less. Grey rings are beats left out.</p></div>` : ''}</div>`;
}
function orthoHtml(r) {
  const o = r.o; if (!o) return '';
  const prev = S.readings.filter(x => x.o && x.id !== r.id && x.t < r.t && x.pos === r.pos && fin(x.o.rise)).slice(-20).map(x => x.o.rise);
  const usual = prev.length >= 3 ? median(prev) : NaN;
  return `<div class="sub-card"><h3>Standing test</h3>
    <div class="kv"><span>${POS[r.pos]} heart rate</span><b>${f0(o.lyingHr)} bpm</b></div>
    <div class="kv"><span>Peak after standing</span><b>${f0(o.peakHr)} bpm (${sgn(o.rise)})</b></div>
    <div class="kv"><span>Standing, last minute</span><b>${f0(o.standingHr)} bpm (${sgn(o.settle)})</b></div>
    <div class="kv"><span>30:15 ratio</span><b>${f2(o.ratio3015)}</b></div>
    <div class="kv"><span>Standing lnRMSSD</span><b>${f1(o.standLn)}</b></div>
    <p class="fine">${fin(usual) ? `Your usual rise is ${Math.round(usual)} bpm. ` : ''}Compare with your own earlier tests.${o.settle >= 30 ? ' If you often feel dizzy or faint when you stand, talk to a doctor.' : ''}</p></div>`;
}
/* plain-language "What this means" card */
const DISCLAIMER = 'General wellness information, not medical advice. It can’t diagnose or rule out any condition. If you feel unwell or are worried about your heart, see a doctor.';
function explainHtml(r, b) {
  const m = r.m, P = [];
  if (m.quality === 'poor' || m.quality === 'short') {
    P.push('The strap had trouble picking up a clean signal this time, so the numbers may not reflect how you really are. Moisten the electrodes, fit the strap snugly just below the chest muscles, keep still and quiet, and take another reading.');
  } else if (r.type === 'spot') {
    P.push('HRV is how much the time between your heartbeats varies. A relaxed, rested body varies the gap more; stress, effort, food, coffee and even talking make the beats more even, so HRV drops.');
    P.push('During the day it changes from minute to minute, so a single spot check is best used to see how something affects you: before and after a breathing session, after a stressful meeting, or in the evening compared with other evenings. It doesn’t say much about your day as a whole; your morning reading does that.');
  } else {
    P.push('HRV is how much the time between your heartbeats varies. When your body is rested and relaxed, the gap shifts more from beat to beat. When it is dealing with hard training, short sleep, illness, alcohol or stress, the beats become more even and HRV drops. Your number on its own matters less than how it compares with your own usual.');
    if (!b.ready) P.push(`For now the most useful thing is to take the reading the same way each morning. After ${b.need} mornings the app can tell you whether a reading is normal for you.`);
    else if (b.status === 'low') P.push('Today suggests your body is working harder than usual to recover. That doesn’t mean something is wrong. Take it as a nudge to go a bit easier today, sleep well, eat and drink properly, and see how the next few mornings look.');
    else if (b.status === 'high') P.push('Your body looks well recovered. A good day for whatever you have planned, as long as you feel good too.');
    else P.push('Today looks like a normal day for you: your body seems to be coping with whatever you are doing. Carry on as planned.');
    if (fin(m.hr)) P.push(`Your heart rate during the reading was ${f0(m.hr)} beats a minute.${b.ready && fin(b.hrDelta) && Math.abs(b.hrDelta) >= 3 ? ` That is ${Math.abs(Math.round(b.hrDelta))} ${b.hrDelta > 0 ? 'above' : 'below'} your usual. A resting heart rate a few beats higher than normal often goes with a lower HRV, for the same reasons.` : ' A resting heart rate a few beats above your usual often goes with a lower HRV, for the same reasons.'}`);
    if (b.ready) { const ms = Math.exp(b.mean); P.push(`For context: your usual RMSSD is about ${Math.round(ms)} ms. Published averages for healthy adults lying down range roughly from 20 to 75 ms and fall with age. Where you sit in that range mostly reflects age and genes, not how fit or healthy you are, which is why the app compares you with yourself.`); }
  }
  if (r.o) P.push('The standing test: when you stand up, blood pools in your legs and your heart briefly speeds up to keep your blood pressure steady, then settles back down. A rise of roughly 10 to 30 beats a minute that settles within a minute or two is typical. Compared with your own earlier tests, a bigger jump or slower settling can go with fatigue, dehydration, heat or a hard training block.');
  return `<div class="explain"><h3>What this means</h3>${P.map(x => `<p>${esc(x)}</p>`).join('')}<p class="fine">${DISCLAIMER}</p></div>`;
}
/* breathing pace moves HRV: flag a reading breathed much faster or slower than usual */
function breathNoteHtml(r) {
  if (r.type === 'spot' || !fin(r.m.br)) return '';
  const prev = allReadings().filter(x => x.id !== r.id && x.type !== 'spot' && x.pos === r.pos && x.t < r.t && fin(x.m.br)).slice(-30).map(x => x.m.br);
  if (prev.length < 5) return '';
  const u = median(prev), ratio = r.m.br / u;
  if (ratio < 1.6 && ratio > 0.625) return '';
  const faster = ratio >= 1.6;
  return `<div class="note-soft"><b>Breathing ${faster ? 'faster' : 'slower'} than usual.</b> You breathed about ${Math.round(r.m.br)} times a minute; you usually breathe about ${Math.round(u)}. Slow breathing raises HRV and faster breathing lowers it, so part of today’s ${faster ? 'lower' : 'higher'} number may simply be your breathing. For comparable readings, breathe the way you usually do.</div>`;
}
function trainingHtml(r, b) {
  if (r.type === 'spot' || !getSettings().training || !b.ready || !b.today || b.today.id !== r.id) return '';
  const a = trainingAdvice(b); if (!a) return '';
  return `<div class="train ${a.level}"><span class="tr-l">Training today</span><b>${esc(a.title)}</b><p>${esc(a.text)}</p></div>`;
}
function tagsHtml(r) {
  const aids = r.sleepAids || [], has = (r.tags && r.tags.length) || fin(r.sleepScore) || fin(r.sleepHours) || aids.length;
  const sum = [...(r.tags || []).map(k => TAG_LABEL[k] || k), fin(r.sleepScore) ? `sleep score ${r.sleepScore}` : '', fin(r.sleepHours) ? `${r.sleepHours} h sleep` : '', aids.length ? 'sleep aid: ' + aids.join(', ') : ''].filter(Boolean).join(' · ');
  return `<div class="tagbox"><div class="tag-top"><span><b>Tags</b> <small class="opt">optional</small>${has ? `<br><span class="dev-meta">${esc(sum)}</span>` : ''}</span><button class="btn" id="btnTags" aria-expanded="false">${has ? 'Edit tags' : '+ Add tags'}</button></div>
    <div id="tagEdit" class="tag-edit" hidden>
      <p class="fine">Tag anything that might have affected this reading. After a few weeks, Trends shows what affects your HRV.</p>
      <div class="chips" id="tagChips"></div>
      <div class="two"><div class="field"><label for="inSleepScore">Sleep score <small class="opt">0–100, from a watch or ring</small></label><input id="inSleepScore" type="number" inputmode="numeric" min="0" max="100" step="1" placeholder="e.g. 78" value="${fin(r.sleepScore) ? r.sleepScore : ''}"></div>
      <div class="field"><label for="inSleepHours">Hours slept</label><input id="inSleepHours" type="number" inputmode="decimal" min="0" max="24" step="0.25" placeholder="e.g. 7.5" value="${fin(r.sleepHours) ? r.sleepHours : ''}"></div></div>
      <div class="field"><label for="inSleepAids">Sleep aids <small class="opt">herbal or other, taken last night; separate with commas</small></label><input id="inSleepAids" type="text" maxlength="200" autocomplete="off" placeholder="e.g. magnesium, chamomile tea" value="${esc(aids.join(', '))}">
      <div class="chips" id="aidChips"></div></div>
      <div class="acts-row"><button class="btn primary" id="btnTagsDone">Done</button></div>
    </div></div>`;
}
function bindTags(r) {
  const btn = $('#btnTags'); if (!btn) return;
  const ed = $('#tagEdit'), sel = new Set(r.tags || []), chips = $('#tagChips');
  chips.innerHTML = TAGS.map(([k, l]) => `<button type="button" role="checkbox" aria-checked="${sel.has(k)}" data-k="${k}">${esc(l)}</button>`).join('');
  for (const c of chips.children) c.onclick = () => { const on = c.getAttribute('aria-checked') !== 'true'; c.setAttribute('aria-checked', String(on)); on ? sel.add(c.dataset.k) : sel.delete(c.dataset.k); };
  /* sleep aids used before: one tap adds or removes them */
  const aidIn = $('#inSleepAids'), aidChips = $('#aidChips'), known = knownAids().slice(0, 8);
  const drawAids = () => { const cur = cleanAids(aidIn.value).map(a => a.toLowerCase());
    aidChips.innerHTML = known.map(a => `<button type="button" role="checkbox" aria-checked="${cur.includes(a.toLowerCase())}" data-a="${esc(a)}">${esc(a)}</button>`).join(''); aidChips.hidden = !known.length;
    for (const c of aidChips.children) c.onclick = () => { const a = c.dataset.a, list = cleanAids(aidIn.value), i = list.findIndex(x => x.toLowerCase() === a.toLowerCase());
      if (i >= 0) list.splice(i, 1); else list.push(a); aidIn.value = list.join(', '); drawAids(); }; };
  aidIn.oninput = drawAids; drawAids();
  btn.onclick = () => { ed.hidden = !ed.hidden; btn.setAttribute('aria-expanded', String(!ed.hidden)); };
  $('#btnTagsDone').onclick = async () => {
    const sc = parseFloat($('#inSleepScore').value), hr = parseFloat($('#inSleepHours').value);
    r.tags = TAGS.map(t => t[0]).filter(k => sel.has(k));
    r.sleepScore = fin(sc) && sc >= 0 && sc <= 100 ? Math.round(sc) : undefined;
    r.sleepHours = fin(hr) && hr >= 0 && hr <= 24 ? Math.round(hr * 4) / 4 : undefined;
    const aids = cleanAids(aidIn.value); r.sleepAids = aids.length ? aids : undefined;
    if (S.pending !== r) { try { await idb('readings', 'readwrite', s => s.put(r)); } catch (e) { toast('The tags could not be saved.'); } }
    openResult(r.id); toast(S.pending === r ? 'Tags added. Save the reading to keep them.' : 'Tags saved.');
  };
}
/* several recent readings with beats left out despite a good signal: point to the ECG app, calmly */
const skipped = x => x && x.m && x.m.quality !== 'poor' && x.m.quality !== 'short' && x.m.beats > 0 && (x.m.fixed >= 3 || x.m.fixed / x.m.beats >= 0.03);
function leadOneHtml(r) {
  if (!skipped(r)) return '';
  const recent = allReadings().filter(x => x.t <= r.t).sort((a, b) => a.t - b.t).slice(-7);
  if (recent.filter(skipped).length < 3) return '';
  return `<div class="leadone"><p>Some beats in your recent readings didn’t fit the usual rhythm. Usually this is the strap: a dry electrode or a little movement. If you’re curious what’s behind it, <b>Lead One ECG</b> can record the actual heart trace from the same strap, so you can see each beat. Disconnect here first; the strap talks to one app at a time.</p>
    <a class="btn" href="https://leadone.anonacondacodelab.com" target="_blank" rel="noopener noreferrer">Open Lead One ECG</a>
    <p class="fine">Occasional early or skipped beats are common and usually harmless. If you have symptoms such as palpitations, dizziness or chest discomfort, see a doctor.</p></div>`;
}
function resultHtml(r) {
  const b = baseline(baseR(allReadings()), r.pos, r.t), v = verdictOf(b, r), m = r.m;
  const q = { good: 'good signal', fair: 'fair signal', poor: 'noisy signal', short: 'too short' }[m.quality];
  return `<div class="card result-card">
    <div class="res-head">${scoreRing(m.score)}<div><h2>${typeLabel(r)}</h2><p>${esc(when(r.t))}${r.src === 'elite' ? ' · from Elite HRV' : ''}<br>${POS[r.pos]} · ${lenTxt(r.len)} · ${q}${fin(m.br) ? ` · breathing about ${Math.round(m.br)}/min` : ''}${m.fixed ? ` · ${m.fixed} beat${m.fixed > 1 ? 's' : ''} left out` : ''}</p></div></div>
    <div class="kpis"><div><b>${f1(m.ln)}</b><span>lnRMSSD</span></div><div><b>${f0(m.rmssd)}<small>ms</small></b><span>RMSSD</span></div><div><b>${f0(m.hr)}<small>bpm</small></b><span>Heart rate</span></div></div>
    <div class="verdict ${v.cls}"><h3><i></i>${esc(v.title)}</h3><p>${esc(v.text)}</p>${r.type === 'spot' ? '' : bandHtml(b, r)}</div>
    ${breathNoteHtml(r)}
    ${trainingHtml(r, b)}
    ${Array.isArray(r.rr) && r.rr.length > 20 ? waveHtml(r) : ''}
    ${orthoHtml(r)}
    ${tagsHtml(r)}
    ${leadOneHtml(r)}
    ${explainHtml(r, b)}
    <p class="fine">Score = lnRMSSD × 100 / 6.5. Compare readings with each other, not with other people or other apps.</p>
  </div>`;
}
function drawResWave() {
  const r = S.resWave, cv = $('#resWave'); if (!r || !cv) return;
  const end = r.rr.length ? r.rr[r.rr.length - 1][0] : 0, readEnd = Math.min(end, (r.settle || 0) + r.len);
  /* the reading and the standing part get their own scales, so the small breath waves aren't flattened by the jump on standing */
  drawWave(cv, r.rr, { t0: 0, t1: Math.max(30, readEnd), settle: r.settle || 0, standAt: null, live: false });
  if (r.standAt != null) drawWave($('#resWave2'), r.rr, { t0: Math.max(0, r.standAt - 20), t1: Math.max(r.standAt + 30, Math.min(end, r.standAt + STAND)), settle: 0, standAt: r.standAt, live: false });
}
window.addEventListener('resize', () => { if (document.body.dataset.screen === 'scrResult') drawResWave(); });
function openResult(id) {
  const pend = S.pending && S.pending.id === id, r = pend ? S.pending : S.readings.find(x => x.id === id); if (!r) return;
  $('#resultBody').innerHTML = resultHtml(r); S.openId = id; bindTags(r);
  S.resWave = r; requestAnimationFrame(() => drawResWave());
  $('#resActsNew').hidden = !pend; $('#resActsSaved').hidden = pend; show('scrResult');
}
const resBack = () => show(S.resultBack || 'scrToday');
$('#btnResSave').onclick = async () => {
  const r = S.pending; if (!r) return;
  try { await idb('readings', 'readwrite', s => s.put(r)); } catch (e) { toast('The reading could not be saved on this device: ' + (e && e.message || e), 7000); return; }
  S.pending = null; await loadAll(); toast('Saved to your history.'); openResult(r.id);
};
$('#btnResDiscard').onclick = function () {
  if (!this.dataset.arm) { this.dataset.arm = 1; this.textContent = 'Tap again to discard'; setTimeout(() => { delete this.dataset.arm; this.textContent = 'Discard'; }, 3500); return; }
  delete this.dataset.arm; this.textContent = 'Discard'; S.pending = null; toast('Reading discarded.'); resBack();
};
$('#btnResultDone').onclick = resBack;
$('#btnResultFile').onclick = () => {
  const r = S.readings.find(x => x.id === S.openId); if (!r) return;
  const d = new Date(r.t), stamp = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;
  downloadFile(`{{FILE_PREFIX}}-reading-${stamp}.json`, JSON.stringify({ format: READING_FORMAT, version: 1, app: '{{APP_NAME}} {{VERSION}}', exported: new Date().toISOString(),
    reading: { id: r.id, t: r.t, type: r.type || 'morning', pos: r.pos, len: r.len, settle: r.settle, standAt: r.standAt, rr: r.rr }, summary: { score: r.m.score, lnRMSSD: r.m.ln, rmssd: r.m.rmssd, hr: r.m.hr, quality: r.m.quality, standing: r.o } }));
};
$('#btnResultDelete').onclick = async function () {
  if (!this.dataset.arm) { this.dataset.arm = 1; this.textContent = 'Tap again to delete'; setTimeout(() => { delete this.dataset.arm; this.textContent = 'Delete'; }, 3500); return; }
  delete this.dataset.arm; this.textContent = 'Delete';
  await idb('readings', 'readwrite', s => s.delete(S.openId)); await loadAll(); toast('Reading deleted.'); resBack();
};

/* ---------- sound and touch cues (gentle) ---------- */
function ensureAudio() { try { if (!S.audio) S.audio = new (window.AudioContext || window.webkitAudioContext)(); if (S.audio.state === 'suspended') S.audio.resume(); } catch (e) {} }
/* a soft bowl-like tone: a few inharmonic partials with a slow fade */
function chime(freq, force, at = 0) {
  if (!force && !getSettings().sound) return;
  const a = S.audio; if (!a) return;
  try {
    const t = a.currentTime + at, out = a.createGain(); out.gain.value = 0.9; out.connect(a.destination);
    [[1, .11], [2.0, .035], [2.76, .022], [5.4, .007]].forEach(([k, g], i) => {
      const o = a.createOscillator(), e = a.createGain(); o.type = 'sine'; o.frequency.value = freq * k;
      e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(g, t + 0.06); e.gain.exponentialRampToValueAtTime(0.0001, t + 2.6 - i * 0.4);
      o.connect(e); e.connect(out); o.start(t); o.stop(t + 2.7);
    });
  } catch (e) {}
}
function vibrate(p) { if (NATIVE) { AppNative.vibrate(p); return; } try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }

/* ---------- BREATHE ---------- */
function updateBreatheAvail() {
  const rb = $('#btnResonance'); if (!rb) return;
  rb.disabled = !S.connected;
  $('#breatheHint').textContent = S.connected ? 'Your heart rate will be shown following your breath.' : 'Works without the strap. Connect it to see your heart rate follow your breath.';
}
const RHYTHMS = [['0.4', 'Longer out'], ['0.5', 'Even'], ['box', 'Box 4-4-4-4'], ['478', '4-7-8'], ['custom', 'Custom']];
const rhythmOf = s => s.rhythm || String(s.ratio === 0.5 ? '0.5' : '0.4');
/* the pacer for the chosen rhythm; pace-based rhythms use the pace chips, patterns set their own timing */
function rhythmPacer(s) {
  const k = rhythmOf(s);
  if (k === '0.4' || k === '0.5') return { pc: pacer(s.pace, +k), name: '' };
  const c = k === 'custom' ? Object.assign({}, DEFAULTS.custom, s.custom) : PATTERNS[k];
  return { pc: patternPacer(c.tin, c.h1, c.tout, c.h2), name: k === 'custom' ? `Custom ${fmtS(c.tin)}-${fmtS(c.h1)}-${fmtS(c.tout)}-${fmtS(c.h2)}` : PATTERNS[k].name, pattern: c };
}
const fmtS = v => (v % 1 ? v.toFixed(1) : String(v));
function renderBreathe() {
  const s = getSettings();
  buildChips($('#paceChips'), PACES.map(p => [p, paceTxt(p)]), s.pace, v => { patchSettings({ pace: +v }); paceHint(); });
  if (s.resPace) for (const b of $('#paceChips').children) b.classList.toggle('res', +b.dataset.v === s.resPace);
  buildChips($('#rhythmChips'), RHYTHMS, rhythmOf(s), v => { patchSettings({ rhythm: v, ratio: v === '0.5' ? 0.5 : 0.4 }); paceHint(); });
  buildChips($('#medLenChips'), [[0, 'Open-ended'], [5, '5 min'], [10, '10 min'], [15, '15 min'], [20, '20 min'], [30, '30 min']], s.medLen, v => patchSettings({ medLen: +v }));
  $('#durVal').textContent = s.dur + ' min'; $('#soundOn').checked = !!s.sound; $('#vibeOn').checked = !!s.vibe;
  paceHint(); updateBreatheAvail();
  const last = [...S.sessions].reverse().find(x => x.kind === 'resonance' && x.best);
  $('#resInfo').innerHTML = s.resPace ? `Your resonance pace: <b>${paceTxt(s.resPace)} breaths/min</b>${last ? ` (tested ${esc(when(last.t).split(' · ')[0].toLowerCase())})` : ''}. It’s marked with a dot above.` : S.connected ? '' : 'Connect your strap to run the test.';
}
function paceHint() {
  const s = getSettings(), k = rhythmOf(s), R = rhythmPacer(s), p = R.pc, bpm = 60 / p.cycle;
  $('#paceField').hidden = !(k === '0.4' || k === '0.5'); $('#customPat').hidden = k !== 'custom';
  if (k === 'custom') { const c = Object.assign({}, DEFAULTS.custom, s.custom); $('#cpTin').textContent = fmtS(c.tin) + ' s'; $('#cpH1').textContent = fmtS(c.h1) + ' s'; $('#cpTout').textContent = fmtS(c.tout) + ' s'; $('#cpH2').textContent = fmtS(c.h2) + ' s'; }
  const parts = [`In ${f1(p.tin)} s`]; if (p.h1) parts.push(`hold ${f1(p.h1)} s`); parts.push(`out ${f1(p.tout)} s`); if (p.h2) parts.push(`hold ${f1(p.h2)} s`);
  $('#paceHint').textContent = parts.join(', ') + ` · ${bpm % 1 ? bpm.toFixed(1) : bpm} breaths a minute.` + (bpm <= 4 ? ' Very slow: if you feel short of air, choose a faster pace.' : '') + (p.h1 >= 7 ? ' Long holds: stop if you feel light-headed.' : '');
}
for (const b of document.querySelectorAll('#customPat .stepper button')) b.onclick = () => {
  const s = getSettings(), c = Object.assign({}, DEFAULTS.custom, s.custom), k = b.dataset.k, lo = k === 'tin' || k === 'tout' ? 1 : 0;
  c[k] = clamp(Math.round((c[k] + +b.dataset.d) * 2) / 2, lo, 20); patchSettings({ custom: c }); paceHint();
};
$('#durMinus').onclick = () => { const d = Math.max(2, getSettings().dur - (getSettings().dur > 10 ? 5 : 1)); patchSettings({ dur: d }); $('#durVal').textContent = d + ' min'; };
$('#durPlus').onclick = () => { const d = Math.min(30, getSettings().dur + (getSettings().dur >= 10 ? 5 : 1)); patchSettings({ dur: d }); $('#durVal').textContent = d + ' min'; };
$('#soundOn').onchange = e => { patchSettings({ sound: e.target.checked }); if (e.target.checked) { ensureAudio(); chime(396, true); } };
$('#vibeOn').onchange = e => { patchSettings({ vibe: e.target.checked }); if (e.target.checked) vibrate(60); };
$('#btnBreathe').onclick = () => {
  if (!acked()) return show('scrAck');
  const s = getSettings(), R = rhythmPacer(s), pace = Math.round(600 / R.pc.cycle) / 10;
  startSession('breath', [{ pace, dur: s.dur * 60, pc: R.pc }], s.ratio, R.name, R.pattern);
};
$('#btnResonance').onclick = () => { if (!S.connected) return; const k = rhythmOf(getSettings()); startSession('resonance', RESONANCE_STEPS.map(p => ({ pace: p, dur: 120 })), k === '0.5' ? 0.5 : 0.4); };
$('#btnMeditate').onclick = () => { if (!acked()) return show('scrAck'); startMeditation(getSettings().medLen); };

/* With the screen off (Android app) animation frames stop and timers slow down, so the session is advanced from a
   timer instead and the breathing cues for the next few seconds are scheduled ahead on the audio clock. */
function hiddenTick() {
  const a = S.act; if (!a || a.kind === 'reading' || !document.hidden) return;
  cancelAnimationFrame(S.raf); frame();
  if (S.act !== a || !a.steps.length) return;
  const el = actClock(), from = Math.max(el, a.cuedUntil || 0, 0), to = Math.min(el + 3, a.total), s = getSettings();
  if (to <= from) return;
  let prev = null;
  for (let t = from; t < to; t += 0.05) {
    const st = a.stepAt(t), p = st.pc.at(t - st.t0), key = a.steps.indexOf(st) + p.phase + p.cycle;
    if (prev !== null && key !== prev) {
      const at = t - el;
      if (p.phase === 'in') { chime(396, false, at); if (s.vibe) setTimeout(() => vibrate(50), at * 1000); }
      else if (p.phase === 'out') { chime(297, false, at); if (s.vibe) setTimeout(() => vibrate([20, 60, 20]), at * 1000); }
    }
    prev = key;
  }
  a.cuedUntil = to;
}
if (NATIVE) setInterval(hiddenTick, 500);
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.act && S.act.kind !== 'reading') { cancelAnimationFrame(S.raf); S.raf = requestAnimationFrame(frame); } });

function startSession(kind, steps, ratio, patternName, pattern) {
  let t = 0; for (const st of steps) { st.t0 = t; t += st.dur; st.t1 = t; st.pc = st.pc || pacer(st.pace, ratio); }
  const a = S.act = { kind, t0: performance.now() + LEAD * 1000, wall: Date.now() + LEAD * 1000, list: [], beatClock: null, steps, ratio, total: t, simOff: null, lastPhase: '', lastStep: -1, strap: S.connected, patternName, pattern };
  /* activity clock starts after the lead-in; the simulated strap aligns to it then */
  a.stepAt = tt => steps.find(st => tt < st.t1) || steps[steps.length - 1];
  a.lungAt = tt => { if (tt < 0) return 0; const st = a.stepAt(tt); return st.pc.at(tt - st.t0).lung; };
  a.paceNow = () => a.stepAt(Math.max(0, actClock())).pace;
  ensureAudio(); keepAwake(); show('scrSession');
  $('#sessHrBox').hidden = !S.connected; $('#sessSwing').textContent = '';
  $('#sessStep').textContent = kind === 'resonance' ? '' : patternName || paceTxt(steps[0].pace) + ' breaths/min';
  cancelAnimationFrame(S.raf); S.raf = requestAnimationFrame(frame);
  clearInterval(S.timer); S.timer = setInterval(sessionSlow, 500);
}
/* open session: no guide; heart rate and HRV tracked quietly */
function startMeditation(min) {
  const total = min ? min * 60 : Infinity;
  S.act = { kind: 'meditation', t0: performance.now() + LEAD * 1000, wall: Date.now() + LEAD * 1000, list: [], beatClock: null, steps: [], total, simOff: null, strap: S.connected, lastMin: 0 };
  ensureAudio(); keepAwake(); show('scrSession');
  $('#sessHrBox').hidden = !S.connected; $('#sessSwing').textContent = '';
  $('#sessStep').textContent = 'Open session';
  cancelAnimationFrame(S.raf); S.raf = requestAnimationFrame(frame);
  clearInterval(S.timer); S.timer = setInterval(sessionSlow, 500);
}
function frame() {
  const a = S.act; if (!a || !['breath', 'resonance', 'meditation'].includes(a.kind)) return;
  const el = actClock();
  if (a.simOff == null && el >= 0 && S.demo) a.simOff = S.sim.t;
  const orb = $('#orb'), halo = $('#orbHalo'), word = $('#orbWord'), cnt = $('#orbCount');
  if (a.kind === 'meditation' && el >= 0) {
    if (el >= a.total) { finishSession(true); return; }
    const sc = 0.86 + 0.04 * Math.sin(2 * Math.PI * el / 16);
    orb.style.transform = `scale(${sc.toFixed(4)})`; halo.style.transform = `scale(${(sc * 1.7).toFixed(4)})`; halo.style.opacity = (0.4 + 0.08 * Math.sin(2 * Math.PI * el / 16)).toFixed(3);
    if (word.textContent !== 'Breathe naturally') { word.textContent = 'Breathe naturally'; chime(396, false); }
    cnt.textContent = mmss(el);
    $('#sessLeft').textContent = fin(a.total) ? mmss(a.total - el) : mmss(el);
    S.raf = requestAnimationFrame(frame); return;
  }
  if (el < 0) {
    const sc = 0.75; orb.style.transform = `scale(${sc})`; halo.style.transform = `scale(${sc * 1.7})`; halo.style.opacity = .4;
    word.textContent = 'Get comfortable'; cnt.textContent = Math.ceil(-el); $('#sessLeft').textContent = fin(a.total) ? mmss(a.total) : '0:00';
    S.raf = requestAnimationFrame(frame); return;
  }
  if (el >= a.total) { finishSession(true); return; }
  const si = a.steps.findIndex(st => el < st.t1), st = a.steps[si], p = st.pc.at(el - st.t0);
  const sc = 0.75 + 0.85 * p.lung;
  orb.style.transform = `scale(${sc.toFixed(4)})`; halo.style.transform = `scale(${(sc * 1.7).toFixed(4)})`; halo.style.opacity = (0.35 + 0.65 * p.lung).toFixed(3);
  const key = si + p.phase + p.cycle;
  if (key !== a.lastPhase) {
    a.lastPhase = key; word.textContent = p.phase === 'in' ? 'Breathe in' : p.phase === 'out' ? 'Breathe out' : 'Hold';
    if (el < (a.cuedUntil || 0)) { /* this cue was already scheduled while the screen was off */ }
    else if (p.phase === 'in') { chime(396, false); if (getSettings().vibe) vibrate(50); } else if (p.phase === 'out') { chime(297, false); if (getSettings().vibe) vibrate([20, 60, 20]); } else if (getSettings().vibe) vibrate(15);
  }
  cnt.textContent = Math.ceil(p.left);
  if (si !== a.lastStep) { a.lastStep = si; if (a.kind === 'resonance') { $('#sessStep').textContent = `Pace ${si + 1} of ${a.steps.length} · ${paceTxt(st.pace)} per min`; if (si > 0) toast(`Now ${paceTxt(st.pace)} breaths a minute. Follow the circle.`, 3000); } }
  $('#sessLeft').textContent = mmss(a.total - el);
  S.raf = requestAnimationFrame(frame);
}
/* twice a second: the heart-rate trace and the size of the swing */
function sessionSlow() {
  const a = S.act; if (!a || !a.strap) return;
  const el = actClock(); if (el < 0) return;
  const fresh = performance.now() - S.lastBeat < 4000; $('#sessHR').textContent = fresh && S.hr ? S.hr : '--';
  drawHr(a, el);
  if (a.kind === 'meditation') {
    if (performance.now() - (a.liveAt || 0) > 2000) { a.liveAt = performance.now(); const h = hrvOf(cleanRR(a.list.filter(x => x[0] >= el - 75)), el - 60, el + 1); $('#sessSwing').textContent = h.diffs >= 15 && fin(h.rmssd) ? `HRV ${Math.round(h.rmssd)} ms` : ''; }
    return;
  }
  const st = a.stepAt(el), cyc = st.pc.cycle;
  if (el - st.t0 > 2 * cyc) { const r = rsaOf(cleanRR(a.list), Math.max(st.t0 + cyc, el - 3 * cyc), el, cyc, 0); $('#sessSwing').textContent = fin(r.amp) ? `swing ${f0(r.amp)} bpm` : ''; }
}
function drawHr(a, el) {
  const cv = $('#hrCanvas'), dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight; if (!w) return;
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const span = 60, t0 = el - span, X = t => (t - t0) / span * w;
  const cs = getComputedStyle(document.documentElement), acc = cs.getPropertyValue('--accent').trim(), lav = cs.getPropertyValue('--orb-b').trim();
  // breathing curve behind (not in an open session)
  if (a.lungAt) { g.beginPath(); for (let i = 0; i <= 120; i++) { const t = t0 + i / 120 * span, y = h - 6 - a.lungAt(Math.max(0, t)) * (h - 12); i ? g.lineTo(X(t), y) : g.moveTo(X(t), y); }
  g.strokeStyle = lav; g.globalAlpha = .45; g.lineWidth = 2; g.stroke(); g.globalAlpha = 1; }
  const C = cleanRR(a.list.filter(x => x[0] >= t0 - 10)), pts = []; for (let i = 0; i < C.T.length; i++) if (C.OK[i] && C.T[i] >= t0) pts.push([C.T[i], 60000 / C.V[i]]);
  if (pts.length < 2) return;
  let lo = Math.min(...pts.map(p => p[1])), hi = Math.max(...pts.map(p => p[1])); const mid = (lo + hi) / 2, half = Math.max(6, (hi - lo) / 2 + 2); lo = mid - half; hi = mid + half;
  g.beginPath(); pts.forEach((p, i) => { const x = X(p[0]), y = h - 6 - (p[1] - lo) / (hi - lo) * (h - 12); i ? g.lineTo(x, y) : g.moveTo(x, y); });
  g.strokeStyle = acc; g.lineWidth = 2.4; g.lineJoin = 'round'; g.stroke();
}
$('#btnSessEnd').onclick = () => finishSession(false);
$('#btnSessDim').onclick = () => { $('#dim').hidden = false; };
$('#dim').onclick = () => { $('#dim').hidden = true; };

async function finishSession(complete) {
  const a = S.act; if (!a) return;
  const el = Math.min(a.total, Math.max(0, actClock())); endActivity();
  if (complete) { chime(396, true); chime(528, true, .35); }
  const sess = { id: 's' + a.wall, t: a.wall, kind: a.kind, ratio: a.ratio, dur: Math.round(el), complete, strap: a.strap && !!a.list.length };
  const C = cleanRR(a.list);
  if (a.kind === 'meditation') {
    if (sess.strap) {
      const all = hrvOf(C, 0, el), w = Math.min(120, el / 2), first = hrvOf(C, 0, w), last = hrvOf(C, el - w, el + 1);
      sess.m = { hr: all.hr, rmssd: all.rmssd, ln: all.ln, br: breathRate(C, Math.max(0, el - 300), el + 1), hr1: first.hr, hr2: last.hr, rmssd1: first.rmssd, rmssd2: last.rmssd };
    }
  } else if (a.kind === 'breath') {
    sess.pace = a.steps[0].pace; if (a.patternName) { sess.patternName = a.patternName; sess.pattern = a.pattern; }
    if (sess.strap) { const r = rsaOf(C, 0, el, a.steps[0].pc.cycle, 1); sess.m = { hr: r.hr, amp: r.amp, rmssd: r.rmssd, ln: r.ln, cycles: r.cycles }; }
  } else {
    const done = a.steps.filter(st => st.t1 <= el + 1).map(st => ({ pace: st.pace, t0: st.t0, t1: st.t1 }));
    const res = resonanceOf(C, done); sess.rows = res.rows.map(r => ({ pace: r.pace, amp: r.amp, cycles: r.cycles, hr: r.hr, rmssd: r.rmssd, artPct: r.artPct })); sess.best = done.length >= 3 ? res.best : null;
  }
  S.resultBack = null; S.pendingSess = el >= 60 ? sess : null; openSession(sess, el < 60, true);
}
function sessionHtml(x, unsaved) {
  const mins = Math.round(x.dur / 60);
  if (x.kind === 'resonance') {
    const rows = x.rows || [], best = x.best, max = Math.max(1, ...rows.map(r => fin(r.amp) ? r.amp : 0));
    const W = 320, H = 150, bw = W / Math.max(rows.length, 5);
    const bars = rows.map((r, i) => { const hgt = fin(r.amp) ? (H - 34) * r.amp / max : 0, x0 = i * bw + 8; return `<rect class="col${r.pace === best ? ' best' : ''}" x="${x0}" y="${H - 20 - hgt}" width="${bw - 16}" height="${hgt}" rx="5"/><text x="${x0 + (bw - 16) / 2}" y="${H - 6}" text-anchor="middle">${paceTxt(r.pace)}</text><text x="${x0 + (bw - 16) / 2}" y="${H - 25 - hgt}" text-anchor="middle">${fin(r.amp) ? Math.round(r.amp) : '–'}</text>`; }).join('');
    return `<div class="card result-card"><div class="intro"><h1>${best ? `Your pace: ${paceTxt(best)}` : 'No clear result'}</h1><p>${esc(when(x.t))} · resonance test${x.complete ? '' : ' (stopped early)'}</p></div>
      ${rows.length ? `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Heart-rate swing at each pace">${bars}</svg><p class="fine" style="text-align:center">Heart-rate swing per breath (bpm) at each pace, breaths per minute</p>` : ''}
      <p style="margin:0">${best ? `Your heart rate swung most with each breath at <b>${paceTxt(best)} breaths a minute</b>. Breathing at this pace gives the strongest rhythm between breath and heartbeat for you. It can shift a little over weeks; retest every month or two.` : 'There weren’t enough clean beats at three or more paces to choose one. Moisten the strap, keep still and try again; you can still breathe at 6 a minute, which suits most people.'}</p>
      ${best ? `<button class="btn primary" id="btnUseRes">Use ${paceTxt(best)} as my pace</button>` : ''}</div>`;
  }
  const m = x.m;
  if (x.kind === 'meditation') {
    const d = (a, b) => { if (!fin(a) || !fin(b)) return ''; const x = Math.round(b) - Math.round(a); return (x > 0 ? '+' : x < 0 ? '−' : '±') + Math.abs(x); };
    return `<div class="card result-card"><div class="intro"><h1>${x.complete ? 'Nicely done' : 'Session ended'}</h1><p>${esc(when(x.t))} · open session · ${mins || '<1'} min${unsaved ? ' · under a minute, not saved' : ''}</p></div>
    ${m ? `<div class="kpis"><div><b>${f0(m.hr)}<small>bpm</small></b><span>Heart rate</span></div><div><b>${f0(m.rmssd)}<small>ms</small></b><span>HRV · RMSSD</span></div><div><b>${fin(m.br) ? Math.round(m.br) : '—'}<small>/min</small></b><span>Breathing</span></div></div>
    <div class="sub-card"><h3>Start → end</h3><div class="kv"><span>Heart rate</span><b>${f0(m.hr1)} → ${f0(m.hr2)} bpm ${d(m.hr1, m.hr2)}</b></div><div class="kv"><span>HRV (RMSSD)</span><b>${f0(m.rmssd1)} → ${f0(m.rmssd2)} ms ${d(m.rmssd1, m.rmssd2)}</b></div></div>
    <p class="fine">Start and end compare the first and last two minutes. As you settle, heart rate usually drifts down and HRV up; breathing often slows. Don’t chase the numbers: a wandering mind brought back gently is the practice.</p>` : '<p class="fine">Connect your strap next time to see how your heart rate and HRV changed as you settled.</p>'}</div>`;
  }
  return `<div class="card result-card"><div class="intro"><h1>${x.complete ? 'Nicely done' : 'Session ended'}</h1><p>${esc(when(x.t))} · ${mins || '<1'} min ${x.patternName ? esc(x.patternName.toLowerCase()) : `at ${paceTxt(x.pace)} breaths/min`}${unsaved ? ' · under a minute, not saved' : ''}</p></div>
    ${m ? `<div class="kpis"><div><b>${f0(m.hr)}<small>bpm</small></b><span>Heart rate</span></div><div><b>${f0(m.amp)}<small>bpm</small></b><span>Swing per breath</span></div><div><b>${f0(m.rmssd)}<small>ms</small></b><span>RMSSD</span></div></div>
    <p class="fine">Swing per breath is how far your heart rate rose and fell with each breath. Bigger swings at a calm pace mean breath and heartbeat are moving together. RMSSD rises during slow breathing, so it isn’t comparable with your morning reading.</p>` : '<p class="fine">Connect your strap next time to see how your heart rate followed your breathing.</p>'}</div>`;
}
function openSession(x, unsaved, fresh) {
  S.openSess = x;
  $('#sessDoneBody').innerHTML = sessionHtml(x, unsaved); show('scrSessDone');
  $('#sessActsNew').hidden = !(fresh && !unsaved); $('#sessActsSaved').hidden = !!(fresh && !unsaved);
  $('#btnSessDelete').hidden = !!fresh;
  const u = $('#btnUseRes'); if (u) u.onclick = async () => { patchSettings({ resPace: x.best, pace: x.best }); if (S.pendingSess === x) await saveSession(); toast(`Your pace is now ${paceTxt(x.best)} breaths a minute.`); show('scrBreathe'); };
}
async function saveSession() {
  const x = S.pendingSess; if (!x) return;
  try { await idb('sessions', 'readwrite', s => s.put(x)); } catch (e) { toast('The session could not be saved on this device.'); return; }
  S.pendingSess = null; await loadAll();
}
const sessBack = () => show(S.resultBack || 'scrBreathe');
$('#btnSessSave').onclick = async () => { await saveSession(); toast('Saved to your history.'); sessBack(); };
$('#btnSessDiscard').onclick = function () {
  if (!this.dataset.arm) { this.dataset.arm = 1; this.textContent = 'Tap again to discard'; setTimeout(() => { delete this.dataset.arm; this.textContent = 'Discard'; }, 3500); return; }
  delete this.dataset.arm; this.textContent = 'Discard'; S.pendingSess = null; toast('Session discarded.'); sessBack();
};
$('#btnSessDone').onclick = sessBack;
$('#btnSessDelete').onclick = async function () {
  if (!this.dataset.arm) { this.dataset.arm = 1; this.textContent = 'Tap again to delete'; setTimeout(() => { delete this.dataset.arm; this.textContent = 'Delete'; }, 3500); return; }
  delete this.dataset.arm; this.textContent = 'Delete';
  if (S.openSess) await idb('sessions', 'readwrite', s => s.delete(S.openSess.id)); await loadAll(); toast('Session deleted.'); sessBack();
};

/* ---------- TRENDS ---------- */
function lineChart(days, opts) {
  const W = 340, H = 168, L = 28, R = 8, T = 10, B = 22, at = opts.at, span = opts.span;
  const x0 = dayStart(at) - (span - 1) * DAY, X = t => L + (dayStart(t) - x0) / ((span - 1) * DAY) * (W - L - R);
  const vals = days.flatMap(d => opts.keys.map(k => d[k])).filter(fin); if (!vals.length) return '';
  let lo = Math.min(...vals), hi = Math.max(...vals); const pad = Math.max(2, (hi - lo) * .12); lo = Math.floor(lo - pad); hi = Math.ceil(hi + pad);
  const Y = v => T + (hi - v) / (hi - lo) * (H - T - B);
  let s = '';
  for (let i = 0; i <= 3; i++) { const v = lo + (hi - lo) * i / 3, y = Y(v); s += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text x="${L - 5}" y="${y + 3}" text-anchor="end">${Math.round(v)}</text>`; }
  for (const back of [span - 1, Math.round((span - 1) / 2), 0]) { const t = dayStart(at) - back * DAY; s += `<text x="${X(t)}" y="${H - 6}" text-anchor="middle">${new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</text>`; }
  if (opts.band) {
    const bd = days.filter(d => fin(d.lo));
    if (bd.length > 1) s += `<path class="band" d="M${bd.map(d => X(d.t) + ',' + Y(d.hi)).join('L')}L${bd.slice().reverse().map(d => X(d.t) + ',' + Y(d.lo)).join('L')}Z"/>`;
  }
  if (opts.line) { const ld = days.filter(d => fin(d[opts.line])); if (ld.length > 1) s += `<path class="${opts.lineCls || 'avg'}" d="M${ld.map(d => X(d.t).toFixed(1) + ',' + Y(d[opts.line]).toFixed(1)).join('L')}"/>`; }
  if (opts.dots) for (const d of days) if (fin(d[opts.dots])) s += `<circle class="pt${fin(d.lo) && d[opts.dots] < d.lo ? ' low' : ''}" cx="${X(d.t).toFixed(1)}" cy="${Y(d[opts.dots]).toFixed(1)}" r="3"/>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label)}">${s}</svg>`;
}
/* ---------- weekly summary (Monday to Sunday) ---------- */
function weekStart(t) { const d = new Date(dayStart(t)), k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return d.getTime(); }
function weekStats(t0, t1) {
  const mr = S.readings.filter(r => r.t >= t0 && r.t < t1 && r.type !== 'spot' && r.m.quality !== 'poor' && r.m.quality !== 'short');
  const by = new Map(); for (const r of mr.sort((a, b) => a.t - b.t)) { const k = dayKey(r.t); if (!by.has(k)) by.set(k, r); }
  const days = [...by.values()], ss = S.sessions.filter(x => x.t >= t0 && x.t < t1);
  const tagCount = {}; for (const r of days) for (const k of r.tags || []) tagCount[k] = (tagCount[k] || 0) + 1;
  const top = Object.entries(tagCount).sort((a, b) => b[1] - a[1])[0];
  return { n: days.length, score: days.length ? mean(days.map(r => r.m.score)) : NaN, hr: days.length ? mean(days.map(r => r.m.hr)) : NaN,
    br: Math.round(ss.filter(x => x.kind === 'breath').reduce((t, x) => t + x.dur, 0) / 60), med: Math.round(ss.filter(x => x.kind === 'meditation').reduce((t, x) => t + x.dur, 0) / 60),
    stands: S.readings.filter(r => r.t >= t0 && r.t < t1 && r.o).length, top: top ? `${TAG_LABEL[top[0]] || top[0]} (${top[1]}×)` : '' };
}
function weekHtml(at, title, id = '') {
  const w0 = weekStart(at), cur = weekStats(w0, w0 + 7 * DAY), prev = weekStats(w0 - 7 * DAY, w0);
  if (!cur.n && !cur.br && !cur.med) return '';
  const diff = (a, b, u = '') => { if (!fin(a) || !fin(b)) return ''; const d = Math.round(a) - Math.round(b); return `<small>${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)}${u} vs the week before</small>`; };
  const range = `${new Date(w0).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${new Date(w0 + 6 * DAY).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
  return `<div class="card week"${id ? ` id="${id}"` : ''}><div><div class="dev-name">${esc(title)}</div><div class="dev-meta">${range}</div></div>
    <div class="kv"><span>Morning readings</span><b>${cur.n} of 7</b></div>
    ${fin(cur.score) ? `<div class="kv"><span>Average HRV score${diff(cur.score, prev.score)}</span><b>${Math.round(cur.score)}</b></div>` : ''}
    ${fin(cur.hr) ? `<div class="kv"><span>Average resting heart rate${diff(cur.hr, prev.hr, ' bpm')}</span><b>${Math.round(cur.hr)} bpm</b></div>` : ''}
    ${cur.stands ? `<div class="kv"><span>Standing tests</span><b>${cur.stands}</b></div>` : ''}
    ${cur.br || cur.med ? `<div class="kv"><span>Breathing · open sessions</span><b>${cur.br} min · ${cur.med} min</b></div>` : ''}
    ${cur.top ? `<div class="kv"><span>Most-used tag</span><b>${esc(cur.top)}</b></div>` : ''}</div>`;
}
function effectsHtml(R, pos) {
  const e = tagEffects(R, pos, effectLabels());
  const any = R.some(r => r.pos === pos && ((r.tags && r.tags.length) || fin(r.sleepScore) || fin(r.sleepHours)));
  let body;
  if (!any) body = `<p class="dev-meta" style="margin:0">Add tags after your morning readings (tap <b>+ Add tags</b> on a result): alcohol, hard training, poor sleep, your sleep score, a sleep aid you took and so on. Once a tag has been used on at least ${TAG_MIN} mornings, with at least ${TAG_MIN_WITHOUT} mornings without it, this card shows how it relates to your HRV. Sleep score and hours slept need 8 mornings.</p>`;
  else {
    const line = x => x.unit !== undefined
      ? `<li class="${x.pct < 0 ? 'watch' : 'ok'}"><b>${esc(x.label)} below ${x.cut}${x.unit}</b><span>HRV about ${Math.abs(Math.round(x.pct))} % ${x.pct < 0 ? 'lower' : 'higher'} than after higher values (${x.n} mornings)</span></li>`
      : `<li class="${x.pct < 0 ? 'watch' : 'ok'}"><b>${esc(x.label)}</b><span>HRV about ${Math.abs(Math.round(x.pct))} % ${x.pct < 0 ? 'lower' : 'higher'} than on other mornings (${x.n} mornings)</span></li>`;
    body = (e.effects.length ? `<ul class="ins">${e.effects.map(line).join('')}</ul>` : '<p class="dev-meta" style="margin:0">No clear effects yet.</p>')
      + (e.small.length ? `<p class="dev-meta" style="margin:0">No clear difference: ${e.small.map(x => esc(x.label)).join(', ')}.</p>` : '')
      + (e.waiting.length ? `<p class="dev-meta" style="margin:0">Needs more mornings: ${e.waiting.map(x => `${esc(x.label)} (${x.have} of ${x.need || TAG_MIN})`).join(', ')}.</p>` : '');
  }
  return `<div class="card commentary"><div class="dev-name">What affects you</div>${body}<p class="fine">These are patterns in your own readings, not proof of cause: days often differ in more than one way.</p></div>`;
}
/* after moving from Elite HRV: compare the first Still Point mornings with the last Elite ones */
function firstPerDay(list) { const by = new Map(); for (const r of list.slice().sort((a, b) => a.t - b.t)) { const k = dayKey(r.t); if (!by.has(k)) by.set(k, r); } return [...by.values()]; }
function switchHtml(pos) {
  const st = getSettings(), ok = r => r.pos === pos && r.type !== 'spot' && r.m.quality !== 'poor' && r.m.quality !== 'short' && fin(r.m.ln);
  if (st.baseFrom) return `<div class="card"><div class="dev-name">Baseline</div><p class="dev-meta" style="margin:0">Your baseline starts from ${esc(new Date(st.baseFrom).toLocaleDateString())}; earlier readings are kept and charted but not used for it.</p><div class="acts-row"><button class="btn" id="btnBaseAll">Use my full history again</button></div></div>`;
  const el = firstPerDay(S.readings.filter(r => r.src === 'elite' && ok(r))); if (el.length < 7) return '';
  const lastT = el[el.length - 1].t, own = firstPerDay(S.readings.filter(r => !r.src && ok(r) && r.t > lastT));
  if (own.length < 5) return own.length ? `<div class="card"><div class="dev-name">Switching from Elite HRV</div><p class="dev-meta" style="margin:0">After 5 mornings in ${esc('{{APP_NAME}}')} (${own.length} so far), this card compares them with your last Elite HRV mornings, so a change in routine isn’t mistaken for a change in you.</p></div>` : '';
  const prev = el.slice(-14), d = mean(own.map(r => r.m.ln)) - mean(prev.map(r => r.m.ln)), sd = Math.max(0.08, std(prev.map(r => r.m.ln)));
  const brE = median(prev.map(r => r.m.br).filter(fin)), brO = median(own.map(r => r.m.br).filter(fin)), pct = Math.round(100 * (Math.exp(d) - 1));
  if (Math.abs(d) < sd) return `<div class="card"><div class="dev-name">Switching from Elite HRV</div><p class="dev-meta" style="margin:0">Your ${own.length} mornings in {{APP_NAME}} line up with your last Elite HRV mornings (${pct >= 0 ? '+' : '−'}${Math.abs(pct)} %), so your history carries on seamlessly.</p></div>`;
  const brLine = fin(brE) && fin(brO) && (brO / brE >= 1.4 || brO / brE <= 0.7) ? ` Your breathing has changed too: about ${Math.round(brO)} breaths a minute now against ${Math.round(brE)} before, which on its own moves HRV.` : '';
  const from = dayStart(own[0].t);
  return `<div class="card commentary"><div class="dev-name">Switching from Elite HRV</div><ul class="ins"><li class="info"><b>Your readings ${d < 0 ? 'dropped' : 'rose'} when you switched</b><span>Your first ${own.length} mornings here are about ${Math.abs(pct)} % ${d < 0 ? 'lower' : 'higher'} than your last Elite HRV mornings.${brLine} A step like this usually comes from a change in routine (breathing, position, time or reading length) rather than from you. If you think so too, start your baseline from the switch so the old routine doesn’t skew it; the old readings stay in your history.</span></li></ul>
    <div class="acts-row"><button class="btn primary" id="btnBaseFrom" data-from="${from}">Start my baseline from ${esc(new Date(from).toLocaleDateString())}</button></div></div>`;
}
function renderTrends() {
  const s = getSettings(), have = Object.keys(POS).filter(p => S.readings.some(r => r.pos === p && r.type !== 'spot'));
  const mp = cfgOf('morning').pos, pos = S.trendPos && have.includes(S.trendPos) ? S.trendPos : have.includes(mp) ? mp : have[0] || mp;
  S.trendPos = pos;
  const segEl = $('#trendPos'); segEl.innerHTML = (have.length ? have : [pos]).map(p => `<button type="button" role="radio" data-v="${p}">${POS[p]}</button>`).join('');
  seg(segEl, pos, v => { S.trendPos = v; renderTrends(); }); segEl.hidden = have.length < 2;
  const now = Date.now(), R = baseR(S.readings), tr = trend(R, pos, now, 60).map(d => Object.assign({}, d, { score: scoreOf(d.ln), s7: fin(d.avg7) ? d.avg7 * 100 / 6.5 : NaN, slo: fin(d.lo) ? d.lo * 100 / 6.5 : NaN, shi: fin(d.hi) ? d.hi * 100 / 6.5 : NaN }));
  const b = baseline(R, pos, now);
  let html = '';
  const ins = trendInsights(R, pos, now, S.readings.filter(r => r.pos === pos && r.type !== 'spot' && r.o).map(r => ({ t: r.t, rise: r.o.rise })));
  if (tr.length) html += `<div class="card commentary"><div class="dev-name">What your trend shows</div>${ins.ready
    ? `<ul class="ins">${ins.items.map(i => `<li class="${i.tone}"><b>${esc(i.title)}</b><span>${esc(i.text)}</span></li>`).join('')}</ul>`
    : `<p class="dev-meta" style="margin:0">Comments start on your ${ins.need}th morning reading in this position: ${ins.have} of ${ins.need} so far. A few need more: about two weeks of mornings for “drifting”, 5 readings in a week for “up-and-down”, and 6 standing tests for the standing trend.</p>`}<p class="fine">${DISCLAIMER}</p></div>`;
  html += switchHtml(pos);
  html += weekHtml(now, 'This week');
  html += effectsHtml(R, pos);
  if (!tr.length) html = `<div class="card"><p class="dev-meta" style="margin:0">No ${POS[pos].toLowerCase()} readings in the last 60 days yet. Take one each morning and your trend appears here.</p></div>`;
  else {
    html += `<div class="card"><div><div class="dev-name">HRV score</div><div class="dev-meta">${b.ready ? `Usual range ${Math.round(b.lo * 100 / 6.5)}–${Math.round(b.hi * 100 / 6.5)} · day-to-day variation ${f1(b.cv)} %` : `Building baseline: ${b.have} of ${b.need} days`}</div></div>
      ${lineChart(tr.map(d => ({ t: d.t, v: d.score, a: d.s7, lo: d.slo, hi: d.shi })), { at: now, span: 60, keys: ['v', 'a', 'lo', 'hi'], band: true, line: 'a', dots: 'v', label: 'HRV score, 7-day average and usual range' })}
      <div class="legend"><span><i style="background:var(--fg);border-radius:50%;width:8px"></i>morning reading</span><span><i style="background:var(--accent);height:3px"></i>7-day average</span><span><i style="background:color-mix(in srgb,var(--ok) 25%,transparent)"></i>usual range</span></div></div>`;
    html += `<div class="card"><div><div class="dev-name">Resting heart rate</div><div class="dev-meta">${b.ready && fin(b.hrMean) ? `Usually about ${Math.round(b.hrMean)} bpm` : 'From the same readings'}</div></div>
      ${lineChart(tr.map(d => ({ t: d.t, v: d.hr })), { at: now, span: 60, keys: ['v'], line: 'v', lineCls: 'hrl', dots: 'v', label: 'Resting heart rate' })}</div>`;
    const ot = S.readings.filter(r => r.pos === pos && r.type !== 'spot' && r.o && fin(r.o.rise) && r.t >= dayStart(now) - 59 * DAY).map(r => ({ t: r.t, v: r.o.rise, w: r.o.settle }));
    if (ot.length) html += `<div class="card"><div><div class="dev-name">Standing test</div><div class="dev-meta">Heart-rate rise on standing (line) and after 2 minutes (dots), bpm</div></div>
      ${lineChart(ot, { at: now, span: 60, keys: ['v', 'w'], line: 'v', lineCls: 'avg', dots: 'w', label: 'Heart-rate rise on standing' })}</div>`;
  }
  const sp = S.readings.filter(r => r.type === 'spot' && r.t >= dayStart(now) - 59 * DAY && fin(r.m.score));
  if (sp.length) html += `<div class="card"><div><div class="dev-name">Spot checks</div><div class="dev-meta">${sp.length} in the last 60 days · not part of your baseline</div></div>
      ${lineChart(sp.map(r => ({ t: r.t, v: r.m.score })), { at: now, span: 60, keys: ['v'], dots: 'v', label: 'Spot-check scores' })}</div>`;
  const since = now - 30 * DAY, br = S.sessions.filter(x => x.t >= since && x.kind === 'breath'), mins = Math.round(br.reduce((t, x) => t + x.dur, 0) / 60);
  const md = S.sessions.filter(x => x.t >= since && x.kind === 'meditation'), mmins = Math.round(md.reduce((t, x) => t + x.dur, 0) / 60);
  if (S.sessions.length) html += `<div class="card"><div><div class="dev-name">Breathing and open sessions, last 30 days</div><div class="dev-meta">Breathing: ${br.length} session${br.length === 1 ? '' : 's'} · ${mins} min${s.resPace ? ` · resonance pace ${paceTxt(s.resPace)}` : ''}<br>Open sessions: ${md.length} · ${mmins} min</div></div></div>`;
  $('#trendBody').innerHTML = html;
  const bf = $('#btnBaseFrom'); if (bf) bf.onclick = () => { patchSettings({ baseFrom: +bf.dataset.from }); toast('Baseline now starts from the switch.'); renderTrends(); };
  const ba = $('#btnBaseAll'); if (ba) ba.onclick = () => { patchSettings({ baseFrom: null }); toast('Using your full history again.'); renderTrends(); };
  const items = [...S.readings.map(r => ({ r, t: r.t })), ...S.sessions.map(x => ({ x, t: x.t }))].sort((a, b) => b.t - a.t).slice(0, 80);
  const list = $('#histList');
  list.innerHTML = items.length ? items.map((it, i) => it.r
    ? `<li><button class="li-btn" data-i="${i}"><span class="meta"><b>${typeLabel(it.r)} · ${POS[it.r.pos].toLowerCase()}</b><span>${esc(when(it.t))}${it.r.src === 'elite' ? ' · Elite HRV' : ''}${it.r.m.quality === 'poor' ? ' · noisy' : ''}</span></span><span class="val">${it.r.m.score ?? '—'}<small>SCORE</small></span></button></li>`
    : `<li><button class="li-btn" data-i="${i}"><span class="meta"><b>${it.x.kind === 'resonance' ? 'Resonance test' : it.x.kind === 'meditation' ? 'Open session' : it.x.patternName ? esc(it.x.patternName) : `Breathing · ${paceTxt(it.x.pace)}/min`}</b><span>${esc(when(it.t))} · ${Math.round(it.x.dur / 60)} min</span></span><span class="val">${it.x.kind === 'resonance' ? (it.x.best ? paceTxt(it.x.best) : '—') + '<small>PACE</small>' : it.x.kind === 'meditation' ? (it.x.m && fin(it.x.m.rmssd) ? Math.round(it.x.m.rmssd) + '<small>HRV MS</small>' : '') : it.x.m && fin(it.x.m.amp) ? Math.round(it.x.m.amp) + '<small>SWING</small>' : ''}</span></button></li>`).join('')
    : '<li class="empty">No readings yet.</li>';
  for (const b2 of list.querySelectorAll('.li-btn')) b2.onclick = () => { const it = items[+b2.dataset.i]; S.resultBack = 'scrTrends'; if (it.r) openResult(it.r.id); else openSession(it.x); };
}

/* ---------- settings, export / import ---------- */
$('#btnSettings').onclick = () => { if (S.act || S.pending || S.pendingSess) { if (!S.act) toast('Save or discard this first.'); return; } S.settingsBack = TABS.includes(document.body.dataset.screen) ? document.body.dataset.screen : 'scrToday'; refreshCount(); $('#optTraining').checked = getSettings().training !== false; $('#installRow').hidden = !S.installEvt; eliteInfo(); show('scrSettings'); };
$('#btnSettingsBack').onclick = () => show(S.settingsBack || 'scrToday');
$('#btnHelp').onclick = () => { S.helpBack = 'scrSettings'; show('scrHelp'); };
const helpBack = () => show(S.helpBack || 'scrToday'); $('#btnHelpBack').onclick = helpBack; $('#btnHelpBack2').onclick = helpBack;
const helpBtn2 = $('#btnHelp2'); if (helpBtn2) helpBtn2.onclick = () => { S.helpBack = 'scrSettings'; show('scrHelp'); };
$('#optTraining').onchange = e => patchSettings({ training: e.target.checked });
/* installable app */
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installEvt = e; $('#installRow').hidden = false; if (document.body.dataset.screen === 'scrToday') renderToday(); });
window.addEventListener('appinstalled', () => { S.installEvt = null; $('#installCard').hidden = true; $('#installRow').hidden = true; toast('Installed. Open it from your home screen.'); });
async function doInstall() { const e = S.installEvt; if (!e) return; e.prompt(); try { await e.userChoice; } catch (x) {} S.installEvt = null; $('#installCard').hidden = true; $('#installRow').hidden = true; }
$('#btnInstall').onclick = doInstall; $('#btnInstall2').onclick = doInstall;
$('#btnInstallLater').onclick = () => { patchSettings({ installLater: Date.now() + 14 * DAY }); $('#installCard').hidden = true; };

/* Elite HRV import: a .zip export, or the .txt files inside it (one per reading) */
async function unzipTexts(buf) {
  const v = new DataView(buf), u8 = new Uint8Array(buf), out = [], dec = new TextDecoder();
  let e = -1; for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('this doesn’t look like a zip file');
  const n = v.getUint16(e + 10, true); let p = v.getUint32(e + 16, true);
  for (let k = 0; k < n && p + 46 <= u8.length; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), lo = v.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
    if (!/\.txt$/i.test(name) || /(^|\/)__MACOSX\//.test(name)) continue;
    const start = lo + 30 + v.getUint16(lo + 26, true) + v.getUint16(lo + 28, true), data = u8.subarray(start, start + csize);
    let bytes; if (method === 0) bytes = data;
    else if (method === 8 && typeof DecompressionStream !== 'undefined') bytes = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    else continue;
    out.push({ name: name.split('/').pop(), text: dec.decode(bytes) });
  }
  return out;
}
$('#btnElite').onclick = () => $('#eliteIn').click();
$('#eliteIn').onchange = async e => {
  const files = [...e.target.files]; e.target.value = ''; if (!files.length) return;
  try {
    let texts = [];
    for (const f of files) {
      if (f.size > 200e6) throw new Error('a file is too large');
      if (/\.zip$/i.test(f.name) || f.type.includes('zip')) texts = texts.concat(await unzipTexts(await f.arrayBuffer()));
      else texts.push({ name: f.name, text: await f.text() });
    }
    const found = [];
    for (const x of texts) { const t = timeFromName(x.name), ms = parseRRText(x.text); if (t && ms.length >= 40) found.push({ t, ms }); }
    if (!found.length) throw new Error('no Elite HRV readings were found. Choose the .zip from the export link, or the .txt files inside it');
    found.sort((a, b) => a.t - b.t);
    const dup = found.filter(f => S.readings.some(r => r.id === 'elite-' + f.t)).length;
    S.elite = found;
    $('#eliteFound').innerHTML = `Found <b>${found.length}</b> reading${found.length === 1 ? '' : 's'} from ${esc(new Date(found[0].t).toLocaleDateString())} to ${esc(new Date(found[found.length - 1].t).toLocaleDateString())}.${dup ? ` ${dup} already imported will be updated.` : ''}`;
    buildChips($('#elitePos'), Object.entries(POS), S.elitePos || 'lying', v => { S.elitePos = v; });
    $('#elitePanel').hidden = false;
  } catch (err) { toast('Import failed: ' + (err && err.message || err), 7000); }
};
$('#btnEliteRemove').onclick = async function () {
  const ids = S.readings.filter(r => r.src === 'elite').map(r => r.id); if (!ids.length) return;
  if (!this.dataset.arm) { this.dataset.arm = 1; this.textContent = `Tap again to remove ${ids.length}`; setTimeout(() => { delete this.dataset.arm; this.textContent = 'Remove all Elite HRV imports'; }, 3500); return; }
  delete this.dataset.arm; this.textContent = 'Remove all Elite HRV imports';
  await idb('readings', 'readwrite', s => { for (const id of ids) s.delete(id); }); await loadAll(); refreshCount(); eliteInfo(); toast(`Removed ${ids.length} imported readings.`);
};
function eliteInfo() { const n = S.readings.filter(r => r.src === 'elite').length; $('#eliteCount').textContent = n ? `${n} readings imported from Elite HRV.` : ''; $('#btnEliteRemove').hidden = !n; }
$('#btnEliteCancel').onclick = () => { S.elite = null; $('#elitePanel').hidden = true; };
$('#btnEliteGo').onclick = async () => {
  const found = S.elite || [], pos = S.elitePos || 'lying', morn = $('#eliteMorning').checked, R = [];
  for (const f of found) {
    const rr = rrToList(f.ms), len = Math.round(rr[rr.length - 1][0]);
    if (len < 30) continue;
    const r = computeReading({ id: 'elite-' + f.t, t: f.t, type: morn && new Date(f.t).getHours() < 11 && len >= 60 && len <= 330 ? 'morning' : 'spot', pos, len: Math.min(900, len), settle: 0, standAt: null, rr: rr.filter(x => x[0] <= 900) });
    r.src = 'elite'; if (r.m.beats >= 30 && fin(r.m.ln)) R.push(r);
  }
  try { await idb('readings', 'readwrite', s => { for (const r of R) s.put(r); }); } catch (e) { toast('The readings could not be saved on this device.'); return; }
  S.elite = null; $('#elitePanel').hidden = true; await loadAll(); refreshCount(); eliteInfo();
  toast(`Imported ${R.length} reading${R.length === 1 ? '' : 's'} from Elite HRV.`, 5000);
};
function refreshCount() { $('#histCount').textContent = `${S.readings.length} reading${S.readings.length === 1 ? '' : 's'} · ${S.sessions.length} breathing session${S.sessions.length === 1 ? '' : 's'}`; }
$('#btnExport').onclick = () => {
  const s = getSettings(), out = { format: HIST_FORMAT, version: 1, app: '{{APP_NAME}} {{VERSION}}', exported: new Date().toISOString(), settings: s,
    readings: S.readings.map(r => ({ id: r.id, t: r.t, type: r.type || 'morning', pos: r.pos, len: r.len, settle: r.settle, standAt: r.standAt, rr: r.rr, tags: r.tags, sleepScore: r.sleepScore, sleepHours: r.sleepHours, sleepAids: r.sleepAids, src: r.src })), sessions: S.sessions };
  const d = new Date(); downloadFile(`{{FILE_PREFIX}}-history-${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}.json`, JSON.stringify(out));
};
$('#btnSaveInfo').onclick = e => { e.stopPropagation(); const p = $('#saveInfo'), open = p.hidden; p.hidden = !open; $('#btnSaveInfo').setAttribute('aria-expanded', String(open)); };
document.addEventListener('click', e => { const p = $('#saveInfo'); if (!p.hidden && !p.contains(e.target)) { p.hidden = true; $('#btnSaveInfo').setAttribute('aria-expanded', 'false'); } });
$('#btnExport2').onclick = () => $('#btnExport').click();
/* one row per reading and per breathing session, for spreadsheets */
function csvText() {
  const cols = ['kind', 'date', 'time', 'type', 'position', 'minutes', 'score', 'lnRMSSD', 'RMSSD_ms', 'SDNN_ms', 'heart_rate_bpm', 'breaths_per_min', 'signal', 'beats_left_out',
    'stand_peak_bpm', 'stand_rise_bpm', 'stand_settle_bpm', 'ratio_30_15', 'pace_per_min', 'pattern', 'swing_bpm', 'resonance_pace', 'tags', 'sleep_score', 'hours_slept', 'sleep_aids'];
  const n = (v, d = 1) => fin(v) ? v.toFixed(d) : '', q = v => /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  const dt = t => { const d = new Date(t); return [`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`, `${pad2(d.getHours())}:${pad2(d.getMinutes())}`]; };
  const rows = [cols.join(',')], items = [...S.readings.map(r => ({ t: r.t, r })), ...S.sessions.map(x => ({ t: x.t, x }))].sort((a, b) => a.t - b.t);
  for (const it of items) {
    const o = {}; [o.date, o.time] = dt(it.t);
    if (it.r) {
      const r = it.r, m = r.m; Object.assign(o, { kind: 'reading', type: typeLabel(r), position: POS[r.pos], minutes: n(r.len / 60), score: m.score ?? '', lnRMSSD: n(m.ln, 2), RMSSD_ms: n(m.rmssd), SDNN_ms: n(m.sdnn),
        heart_rate_bpm: n(m.hr), breaths_per_min: n(m.br), signal: m.quality, beats_left_out: m.fixed ?? '', tags: (r.tags || []).map(k => TAG_LABEL[k] || k).join('; '), sleep_score: r.sleepScore ?? '', hours_slept: r.sleepHours ?? '', sleep_aids: (r.sleepAids || []).join('; ') });
      if (r.o) Object.assign(o, { stand_peak_bpm: n(r.o.peakHr), stand_rise_bpm: n(r.o.rise), stand_settle_bpm: n(r.o.settle), ratio_30_15: n(r.o.ratio3015, 2) });
    } else {
      const x = it.x; Object.assign(o, { kind: x.kind === 'resonance' ? 'resonance test' : x.kind === 'meditation' ? 'open session' : 'breathing', minutes: n(x.dur / 60), pace_per_min: x.pace ?? '', pattern: x.patternName || '', resonance_pace: x.best ?? '' });
      if (x.m) Object.assign(o, { heart_rate_bpm: n(x.m.hr), RMSSD_ms: n(x.m.rmssd), swing_bpm: n(x.m.amp), breaths_per_min: n(x.m.br) });
    }
    rows.push(cols.map(c => q(String(o[c] ?? ''))).join(','));
  }
  return rows.join('\n') + '\n';
}
$('#btnCsv').onclick = $('#btnCsv2').onclick = () => {
  if (!S.readings.length && !S.sessions.length) { toast('Nothing saved yet.'); return; }
  const d = new Date(); downloadFile(`{{FILE_PREFIX}}-${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}.csv`, csvText(), 'text/csv');
};
$('#btnImport').onclick = () => $('#histIn').click();
const num = v => fin(v) ? v : null, str = (v, n) => typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, '').slice(0, n) : '';
function cleanReadingIn(r) {
  if (!r || typeof r !== 'object' || !Array.isArray(r.rr) || !POS[r.pos] || !num(r.t) || !(r.len >= 30 && r.len <= 900)) return null;
  const rr = r.rr.slice(0, 4000).filter(p => Array.isArray(p) && fin(p[0]) && fin(p[1]) && Math.abs(p[0]) < 1e4 && p[1] < 3000).map(p => [+p[0], +p[1]]);
  const o = computeReading({ id: str(r.id, 40) || 'r' + r.t, t: r.t, type: r.type === 'spot' ? 'spot' : 'morning', pos: r.pos, len: r.len, settle: num(r.settle) ?? SETTLE, standAt: num(r.standAt), rr });
  if (Array.isArray(r.tags)) o.tags = r.tags.filter(k => TAG_LABEL[k]);
  if (fin(r.sleepScore) && r.sleepScore >= 0 && r.sleepScore <= 100) o.sleepScore = Math.round(r.sleepScore);
  if (fin(r.sleepHours) && r.sleepHours >= 0 && r.sleepHours <= 24) o.sleepHours = r.sleepHours;
  if (Array.isArray(r.sleepAids)) { const a = cleanAids(r.sleepAids.filter(x => typeof x === 'string')); if (a.length) o.sleepAids = a; }
  if (r.src === 'elite') o.src = 'elite';
  return o;
}
function cleanSessionIn(x) {
  if (!x || typeof x !== 'object' || !num(x.t) || !['breath', 'resonance', 'meditation'].includes(x.kind)) return null;
  const o = { id: str(x.id, 40) || 's' + x.t, t: x.t, kind: x.kind, ratio: num(x.ratio) ?? 0.4, dur: num(x.dur) ?? 0, complete: !!x.complete, strap: !!x.strap };
  if (x.kind === 'meditation') { if (x.m && typeof x.m === 'object') { o.m = {}; for (const k of ['hr', 'rmssd', 'ln', 'br', 'hr1', 'hr2', 'rmssd1', 'rmssd2']) o.m[k] = num(x.m[k]); } }
  else if (x.kind === 'breath') { o.pace = num(x.pace) && x.pace >= 1 && x.pace <= 20 ? x.pace : 6; if (x.patternName) o.patternName = str(x.patternName, 60); if (x.m && typeof x.m === 'object') o.m = { hr: num(x.m.hr), amp: num(x.m.amp), rmssd: num(x.m.rmssd), ln: num(x.m.ln), cycles: num(x.m.cycles) }; }
  else { o.best = PACES.includes(x.best) ? x.best : null; o.rows = (Array.isArray(x.rows) ? x.rows : []).slice(0, 12).filter(r => r && PACES.includes(r.pace)).map(r => ({ pace: r.pace, amp: num(r.amp), cycles: num(r.cycles), hr: num(r.hr), rmssd: num(r.rmssd), artPct: num(r.artPct) })); }
  return o;
}
$('#histIn').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    if (f.size > 50e6) throw new Error('the file is too large');
    const j = JSON.parse(await f.text()); if (!j || (j.format !== HIST_FORMAT && j.format !== READING_FORMAT)) throw new Error('this is not a {{APP_NAME}} history or reading file');
    if (j.format === READING_FORMAT) j.readings = [j.reading];
    const R = (j.readings || []).map(cleanReadingIn).filter(Boolean), X = (j.sessions || []).map(cleanSessionIn).filter(Boolean);
    await idb('readings', 'readwrite', s => { for (const r of R) s.put(r); });
    await idb('sessions', 'readwrite', s => { for (const x of X) s.put(x); });
    if (j.settings && PACES.includes(j.settings.resPace) && !getSettings().resPace) patchSettings({ resPace: j.settings.resPace });
    await loadAll(); refreshCount(); toast(`Imported ${R.length} readings and ${X.length} sessions.`);
  } catch (err) { toast('Import failed: ' + (err && err.message || err), 6000); }
};
$('#btnClear').onclick = async function () {
  if (!this.dataset.arm) { this.dataset.arm = 1; this.textContent = 'Tap again to delete all'; setTimeout(() => { delete this.dataset.arm; this.textContent = 'Delete everything'; }, 3500); return; }
  delete this.dataset.arm; this.textContent = 'Delete everything';
  await idb('readings', 'readwrite', s => s.clear()); await idb('sessions', 'readwrite', s => s.clear()); patchSettings({ resPace: null });
  await loadAll(); refreshCount(); toast('All readings and sessions deleted.');
};

/* ---------- tabs and start-up ---------- */
/* Android Back button: go back inside the app; on the main screen, or during a reading or session, the app moves to the background */
window.appBack = () => {
  const scr = document.body.dataset.screen || 'scrToday';
  if (S.act || scr === 'scrToday' || scr === 'scrAck' || scr === 'scrReading' || scr === 'scrSession') return false;
  if (scr === 'scrResult' && S.pending || scr === 'scrSessDone' && S.pendingSess) { toast('Save or discard this first.'); return true; }
  const btn = { scrSetup: '#btnSetupBack', scrResult: '#btnResultDone', scrSessDone: '#btnSessDone', scrSettings: '#btnSettingsBack', scrHelp: '#btnHelpBack' }[scr];
  if (btn) $(btn).click(); else show('scrToday');
  return true;
};
for (const b of document.querySelectorAll('#tabs button')) b.onclick = () => { if (!S.act && !S.pending && !S.pendingSess) { S.resultBack = null; show(b.dataset.tab); } };
(async function init() {
  try { if ('serviceWorker' in navigator && !FRAMED && !NATIVE && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) {}
  await loadAll();
  envCheck();
  setDev('off', 'Polar H10 not connected', 'Moisten the electrodes, fit the strap, then connect.');
  const start = acked() ? 'scrToday' : 'scrAck';
  if (location.hash === '#manual') { S.helpBack = start; show('scrHelp'); } else show(start);
  window.addEventListener('hashchange', () => { if (location.hash === '#manual' && !S.act) { S.helpBack = document.body.dataset.screen || start; show('scrHelp'); } });
})();
