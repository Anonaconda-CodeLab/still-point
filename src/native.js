/* ---------- Android app (Capacitor) ----------
   Copyright (C) 2026 Anonaconda Code Lab · SPDX-License-Identifier: GPL-3.0-or-later
   In the Android app the page runs inside Android's WebView, which lacks Web Bluetooth, file downloads, vibration,
   speech and screen wake locks. This file supplies native stand-ins so the rest of the app runs unchanged.
   In a browser NATIVE is false and nothing here is used. All calls stay on the phone: the app has no internet permission. */
const NATIVE = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
const nativeCall = (plugin, method, opts) => window.Capacitor.nativePromise(plugin, method, opts || {});
const nativeOn = (plugin, event, cb) => window.Capacitor.addListener(plugin, event, cb);
const AppNative = NATIVE ? (() => {
  let active = false;
  return {
    async saveFile(name, text, mime) {   // pick the place first (name only), then write in 256 KB pieces
      const r = await nativeCall('AppNative', 'pickSaveLocation', { name, mime: mime || 'application/json' });
      if (!r || !r.uri) return { saved: false };
      const N = 256 * 1024;
      for (let i = 0; i === 0 || i < text.length; i += N)
        await nativeCall('AppNative', 'writeChunk', { uri: r.uri, text: text.slice(i, i + N), first: i === 0, last: i + N >= text.length });
      return { saved: true };
    },
    keepScreenOn: on => nativeCall('AppNative', 'keepScreenOn', { on: !!on }).catch(() => {}),
    vibrate: pattern => nativeCall('AppNative', 'vibrate', { pattern: Array.isArray(pattern) ? pattern : [pattern] }).catch(() => {}),
    speak: text => nativeCall('AppNative', 'speak', { text: String(text || '') }).catch(() => {}),
    openUrl: url => nativeCall('AppNative', 'openUrl', { url }),
    /* a session that must keep running with the screen off (foreground service + wake lock) */
    active(on, text) {
      if (!!on === active) return; active = !!on;
      nativeCall('AppNative', on ? 'startActive' : 'stopActive', { text: text || '' }).catch(() => {});
    }
  };
})() : null;

if (NATIVE) (() => {
  document.documentElement.classList.add('native');   // hides browser-only guidance (see style.css)
  // The Back button calls window.appBack() (defined by the app); returning false moves the app to the background.
  // links to websites and email open in the phone's browser or mail app, never inside the app
  document.addEventListener('click', e => {
    const a = e.target && e.target.closest && e.target.closest('a[href]'); if (!a) return;
    const href = a.getAttribute('href') || '';
    if (/^(https:|mailto:)/i.test(href)) { e.preventDefault(); AppNative.openUrl(href).catch(() => {}); }
  }, true);
  // Web Bluetooth subset used by app.js, implemented on @capacitor-community/bluetooth-le
  const BLE = 'BluetoothLe';
  const STD = { heart_rate: 0x180d, battery_service: 0x180f, device_information: 0x180a,
    heart_rate_measurement: 0x2a37, battery_level: 0x2a19, firmware_revision_string: 0x2a26 };
  const uuid = u => typeof u === 'number' ? `0000${u.toString(16).padStart(4, '0')}-0000-1000-8000-00805f9b34fb`
    : STD[u] != null ? uuid(STD[u]) : String(u).toLowerCase();
  const hexToView = h => { const m = String(h || '').replace(/[^0-9a-f]/gi, '').match(/../g) || []; return new DataView(Uint8Array.from(m, x => parseInt(x, 16)).buffer); };
  const toHex = v => { const u = v instanceof DataView ? new Uint8Array(v.buffer, v.byteOffset, v.byteLength) : v instanceof ArrayBuffer ? new Uint8Array(v) : new Uint8Array(v.buffer, v.byteOffset || 0, v.byteLength); return Array.from(u, x => x.toString(16).padStart(2, '0')).join(''); };
  const domErr = (name, message) => { const e = new Error(message); e.name = name; return e; };
  /* Android handles one Bluetooth request at a time and refuses a second one while the first is running ("status code
     201": request busy). Chrome queues them for us; here every request waits its turn, and a busy refusal is retried. */
  let gattQ = Promise.resolve();
  const BUSY = /status code 20\d|busy|in progress/i;
  const gattCall = (method, opts) => {
    const run = async () => {
      for (let i = 0; ; i++) {
        try { return await nativeCall(BLE, method, opts); }
        catch (e) { if (i >= 5 || !BUSY.test(String(e && e.message || e))) throw e; await new Promise(r => setTimeout(r, 150 * (i + 1))); }
      }
    };
    const p = gattQ.then(run, run); gattQ = p.catch(() => {}); return p;
  };
  let ready = null;
  const init = () => ready = ready || (async () => {
    await nativeCall(BLE, 'initialize', { androidNeverForLocation: true });
    const on = await nativeCall(BLE, 'isEnabled');
    if (!on || !on.value) await nativeCall(BLE, 'requestEnable').catch(() => {});
  })().catch(e => { ready = null; throw e; });

  class Emitter {
    constructor() { this._l = {}; }
    addEventListener(t, f) { (this._l[t] = this._l[t] || []).push(f); }
    removeEventListener(t, f) { this._l[t] = (this._l[t] || []).filter(x => x !== f); }
    _emit(t, e) { for (const f of (this._l[t] || []).slice()) { try { f(e); } catch (err) { console.error(err); } } }
  }
  class Characteristic extends Emitter {
    constructor(dev, service, id) { super(); this.dev = dev; this.service = service; this.uuid = id; this.value = null; }
    async startNotifications() {
      const sub = nativeOn(BLE, `notification|${this.dev.id}|${this.service}|${this.uuid}`, ev => {
        this.value = hexToView(ev && ev.value); this._emit('characteristicvaluechanged', { target: this });
      });
      this.dev._subs.push(sub);
      await gattCall('startNotifications', { deviceId: this.dev.id, service: this.service, characteristic: this.uuid });
      return this;
    }
    async readValue() {
      const r = await gattCall('read', { deviceId: this.dev.id, service: this.service, characteristic: this.uuid });
      return this.value = hexToView(r && r.value);
    }
    async writeValueWithResponse(v) { await gattCall('write', { deviceId: this.dev.id, service: this.service, characteristic: this.uuid, value: toHex(v) }); }
    writeValue(v) { return this.writeValueWithResponse(v); }
  }
  class Service {
    constructor(dev, s) { this.dev = dev; this.uuid = s.uuid.toLowerCase(); this._chars = (s.characteristics || []).map(c => String(c.uuid).toLowerCase()); }
    async getCharacteristic(c) {
      const id = uuid(c);
      if (!this._chars.includes(id)) throw domErr('NotFoundError', 'No characteristic ' + c);
      return new Characteristic(this.dev, this.uuid, id);
    }
  }
  class Device extends Emitter {
    constructor(id, name) {
      super(); this.id = id; this.name = name || 'Heart-rate strap'; this._subs = []; this._services = [];
      const dev = this;
      this.gatt = {
        connected: false, device: dev,
        async connect() {
          await init(); dev._drop();
          if (!dev._discSub) dev._discSub = nativeOn(BLE, `disconnected|${dev.id}`, () => {
            dev.gatt.connected = false; dev._drop(); dev._emit('gattserverdisconnected', { target: dev });
          });
          await gattCall('connect', { deviceId: dev.id, timeout: 15000 });
          const r = await gattCall('getServices', { deviceId: dev.id });
          dev._services = (r && r.services) || []; dev.gatt.connected = true;
          return dev.gatt;
        },
        disconnect() { nativeCall(BLE, 'disconnect', { deviceId: dev.id }).catch(() => {}); },
        async getPrimaryService(s) {
          const id = uuid(s), found = dev._services.find(x => String(x.uuid).toLowerCase() === id);
          if (!found) throw domErr('NotFoundError', 'No service ' + s);
          return new Service(dev, found);
        }
      };
    }
    _drop() { for (const s of this._subs) { try { s.remove(); } catch (e) {} } this._subs = []; }   // old notification listeners must not double up after a reconnect
  }
  const bluetooth = {
    async requestDevice(opts) {
      await init();
      const filters = (opts && opts.filters) || [];
      const prefixes = filters.map(f => f.namePrefix).filter(Boolean);
      const services = [...new Set(filters.flatMap(f => f.services || []).map(uuid))];
      let common = prefixes[0] || ''; for (const p of prefixes) while (!p.startsWith(common)) common = common.slice(0, -1);
      const q = {}; if (common) q.namePrefix = common; if (services.length) q.services = services;
      try {
        const d = await nativeCall(BLE, 'requestDevice', q);
        return new Device(d.deviceId, d.name);
      } catch (e) {
        const m = String(e && e.message || e);
        throw domErr(/cancel|no device/i.test(m) ? 'NotFoundError' : 'NetworkError', m);
      }
    },
    getAvailability: async () => true
  };
  try { Object.defineProperty(navigator, 'bluetooth', { value: bluetooth, configurable: true }); } catch (e) { navigator.bluetooth = bluetooth; }

})();
