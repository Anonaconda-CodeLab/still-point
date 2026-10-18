/* ===== {{APP_NAME}} · HRV maths (no DOM, testable in Node) =====
   Copyright (C) 2026 Anonaconda Code Lab
   SPDX-License-Identifier: GPL-3.0-or-later
*/
const DAY = 864e5;

/* ---------- small statistics ---------- */
function mean(a) { let s = 0; for (const v of a) s += v; return a.length ? s / a.length : NaN; }
function std(a) { const m = mean(a); let s = 0; for (const v of a) s += (v - m) * (v - m); return a.length > 1 ? Math.sqrt(s / (a.length - 1)) : NaN; }
function median(a) { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; }
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const fin = v => typeof v === 'number' && isFinite(v);

/* ---------- beat intervals ----------
   Input: the strap's own beat-to-beat intervals as [[tEndSec, rrMs], …]. rrMs < 0 marks a break
   (pause or Bluetooth drop) so no difference is taken across it.
   Each beat is checked against the median of its 10 neighbours on either side; a beat more than
   20 % away (or outside 300–2000 ms) is treated as an artifact or ectopic beat and left out. Successive
   differences are only taken between two accepted, adjacent beats, so one bad beat never creates a
   large false difference. */
function cleanRR(list) {
  const S = { T: [], V: [], OK: [], SEG: [] };
  let seg = 0, cur = [];
  const flush = () => {
    for (let i = 0; i < cur.length; i++) {
      const nb = []; for (let j = Math.max(0, i - 10); j <= Math.min(cur.length - 1, i + 10); j++) if (j !== i) nb.push(cur[j][1]);
      const lm = nb.length >= 4 ? median(nb) : cur[i][1], v = cur[i][1];
      S.T.push(cur[i][0]); S.V.push(v); S.SEG.push(seg);
      S.OK.push(v >= 300 && v <= 2000 && Math.abs(v - lm) <= 0.2 * lm);
    }
    cur = []; seg++;
  };
  for (const p of list || []) { if (!Array.isArray(p) || !fin(p[0]) || !fin(p[1])) continue; if (p[1] < 0) flush(); else cur.push(p); }
  flush();
  return S;
}
function idxRange(S, t0 = -Infinity, t1 = Infinity) { const out = []; for (let i = 0; i < S.T.length; i++) if (S.T[i] >= t0 && S.T[i] < t1) out.push(i); return out; }

/* score: lnRMSSD on a 0–100 scale (lnRMSSD × 100 / 6.5). The same idea several apps use; not identical to any of them. */
const scoreOf = ln => fin(ln) ? clamp(Math.round(ln * 100 / 6.5), 0, 100) : null;

function hrvOf(S, t0, t1) {
  const ix = idxRange(S, t0, t1), good = ix.filter(i => S.OK[i]), d = [];
  for (let k = 1; k < ix.length; k++) { const a = ix[k - 1], b = ix[k]; if (b === a + 1 && S.OK[a] && S.OK[b] && S.SEG[a] === S.SEG[b]) d.push(S.V[b] - S.V[a]); }
  const V = good.map(i => S.V[i]);
  const rmssd = d.length >= 10 ? Math.sqrt(mean(d.map(x => x * x))) : NaN;
  const ln = rmssd > 0 ? Math.log(rmssd) : NaN;
  const art = ix.length ? 100 * (ix.length - good.length) / ix.length : 0;
  return {
    beats: ix.length, good: good.length, diffs: d.length, artPct: art,
    rmssd, ln, score: scoreOf(ln), sdnn: V.length > 2 ? std(V) : NaN, hr: V.length ? 60000 / mean(V) : NaN,
    quality: d.length < 40 ? 'short' : art > 10 ? 'poor' : art > 5 ? 'fair' : 'good'
  };
}

/* instantaneous heart rate of accepted beats: [[t, bpm], …] */
function hrPoints(S, t0, t1) { return idxRange(S, t0, t1).filter(i => S.OK[i]).map(i => [S.T[i], 60000 / S.V[i]]); }

/* ---------- standing (orthostatic) test ----------
   standAt: seconds into the reading when the person was asked to stand; end: seconds at the end.
   lying HR  = mean of the last 60 s lying down
   peak HR   = highest 3-beat average in the first 30 s after standing
   standing  = mean of the last 60 s standing
   30:15     = longest interval around beat 30 / shortest around beat 15 after standing (Ewing's ratio) */
function orthoOf(S, standAt, end) {
  const lie = hrvOf(S, standAt - 60, standAt), st = hrvOf(S, Math.max(standAt + 30, end - 60), end);
  const pts = hrPoints(S, standAt, standAt + 30); let peak = NaN;
  for (let i = 2; i < pts.length; i++) { const m = (pts[i][1] + pts[i - 1][1] + pts[i - 2][1]) / 3; if (!(m <= peak)) peak = m; }
  const after = idxRange(S, standAt, end).filter(i => S.OK[i]).map(i => S.V[i]);
  let r3015 = NaN;
  if (after.length >= 40) { const short = Math.min(...after.slice(5, 25)), long = Math.max(...after.slice(20, 40)); r3015 = long / short; }
  return {
    lyingHr: lie.hr, peakHr: peak, rise: peak - lie.hr, standingHr: st.hr, settle: st.hr - lie.hr,
    ratio3015: r3015, standRmssd: st.rmssd, standLn: st.ln, lyingLn: lie.ln
  };
}

/* ---------- paced breathing ----------
   RSA amplitude: for each breath cycle, highest minus lowest beat-to-beat heart rate; averaged over cycles.
   The first cycle after a change of pace is skipped because breathing takes a moment to settle. */
function rsaOf(S, t0, t1, cycleSec, skip = 1) {
  const amps = [];
  for (let k = skip, a = t0 + skip * cycleSec; a + cycleSec <= t1 + 0.01; k++, a += cycleSec) {
    const p = hrPoints(S, a, a + cycleSec).map(x => x[1]);
    if (p.length >= Math.max(3, 0.6 * cycleSec * 0.75)) amps.push(Math.max(...p) - Math.min(...p));
  }
  const h = hrvOf(S, t0 + skip * cycleSec, t1);
  return { amp: amps.length ? mean(amps) : NaN, cycles: amps.length, hr: h.hr, rmssd: h.rmssd, ln: h.ln, artPct: h.artPct };
}
/* resonance test steps: [{pace, t0, t1}] -> per-step RSA and the pace with the largest swing */
function resonanceOf(S, steps) {
  const rows = steps.map(s => Object.assign({ pace: s.pace }, rsaOf(S, s.t0, s.t1, 60 / s.pace, 1)));
  const ok = rows.filter(r => fin(r.amp) && r.cycles >= 2 && r.artPct <= 15);
  let best = null; for (const r of ok) if (!best || r.amp > best.amp) best = r;
  return { rows, best: best ? best.pace : null };
}

/* ---------- pacer timing ----------
   pace in breaths/min, inhale = fraction of the cycle spent breathing in.
   lung(t) returns 0 (empty) … 1 (full) with gentle cosine easing, phase 'in' or 'out', and seconds left in the phase. */
function pacer(pace, inhale = 0.4) {
  const cyc = 60 / pace, tin = cyc * inhale, tout = cyc - tin;
  return {
    cycle: cyc, tin, tout,
    at(t) {
      const c = Math.floor(t / cyc), x = t - c * cyc;
      if (x < tin) return { phase: 'in', lung: (1 - Math.cos(Math.PI * x / tin)) / 2, left: tin - x, cycle: c };
      const y = x - tin; return { phase: 'out', lung: (1 + Math.cos(Math.PI * y / tout)) / 2, left: tout - y, cycle: c };
    }
  };
}
const PACES = [3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7];
const RESONANCE_STEPS = [6.5, 6, 5.5, 5, 4.5];

/* ---------- personal baseline ----------
   readings: [{t, pos, ln, hr, quality}] — the first good-quality reading of each day counts.
   Normal range = 60-day mean ± 0.5 SD of daily lnRMSSD (the "smallest worthwhile change"), compared with the
   7-day rolling average (Plews et al. 2012; Kiviniemi et al. 2007). Needs 7 earlier days. */
const dayKey = t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const dayStart = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
/* only morning readings build the baseline; spot checks (type 'spot') are kept out */
function dailySeries(readings, pos) {
  const by = new Map();
  for (const r of [...readings].sort((a, b) => a.t - b.t)) {
    if (pos && r.pos !== pos) continue;
    if (r.type && r.type !== 'morning') continue;
    if (!fin(r.ln) || r.quality === 'poor' || r.quality === 'short') continue;
    const k = dayKey(r.t); if (!by.has(k)) by.set(k, { day: k, t: r.t, ln: r.ln, hr: r.hr, id: r.id });
  }
  return [...by.values()];
}
const BASE_MIN_DAYS = 7, BASE_WINDOW = 60;
function baselineAt(days, at) {
  const s0 = dayStart(at), today = days.find(d => d.day === dayKey(at)) || null;
  const prior = days.filter(d => d.t < s0 && d.t >= s0 - BASE_WINDOW * DAY);
  const week = days.filter(d => d.t >= s0 - 6 * DAY && d.t < s0 + DAY);
  if (prior.length < BASE_MIN_DAYS) return { ready: false, have: prior.length + (today ? 1 : 0), need: BASE_MIN_DAYS + 1, today };
  const m = mean(prior.map(d => d.ln)), sd = Math.max(std(prior.map(d => d.ln)), 0.04);
  const lo = m - 0.5 * sd, hi = m + 0.5 * sd, avg7 = mean(week.map(d => d.ln));
  const hrs = prior.map(d => d.hr).filter(fin), hrM = hrs.length ? mean(hrs) : NaN;
  const status = !week.length ? 'none' : avg7 < lo ? 'low' : avg7 > hi ? 'high' : 'steady';
  return {
    ready: true, mean: m, sd, lo, hi, avg7, n7: week.length, nPrior: prior.length, status, today,
    todayZ: today ? (today.ln - m) / sd : NaN, hrMean: hrM, hrDelta: today && fin(today.hr) ? today.hr - hrM : NaN,
    cv: 100 * sd / m
  };
}
function baseline(readings, pos, at = Date.now()) { return baselineAt(dailySeries(readings, pos), at); }
/* chart data: each day with its value, the rolling 7-day average and the normal range at that day */
function trend(readings, pos, at = Date.now(), span = 60) {
  const days = dailySeries(readings, pos).filter(d => d.t >= dayStart(at) - (span - 1) * DAY && d.t < dayStart(at) + DAY), all = dailySeries(readings, pos);
  return days.map(d => { const b = baselineAt(all, d.t); return { day: d.day, t: d.t, ln: d.ln, hr: d.hr, avg7: b.ready ? b.avg7 : NaN, lo: b.ready ? b.lo : NaN, hi: b.ready ? b.hi : NaN }; });
}

/* ---------- simulated strap (demo mode and tests) ---------- */
function makeSim(seed = 7) {
  let s = seed >>> 0;
  const rnd = () => { s += 0x6D2B79F5; let q = s; q = Math.imul(q ^ (q >>> 15), q | 1); q ^= q + Math.imul(q ^ (q >>> 7), q | 61); return ((q ^ (q >>> 14)) >>> 0) / 4294967296; };
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  const base = 58 + 6 * rnd();
  let t = 0, drift = 0;
  /* ctx: { lung(t) -> 0..1 or null for spontaneous breathing, pace (bpm) when paced, standAt (s) when standing } */
  return {
    next(ctx = {}) {
      const pace = ctx.pace || 14, lung = ctx.lung ? ctx.lung(t) : (1 - Math.cos(2 * Math.PI * t * pace / 60)) / 2;
      const amp = ctx.pace ? 5 + 11 * Math.exp(-(((ctx.pace - 5.5) / 1.1) ** 2)) : 4;
      let stand = 0;
      if (ctx.standAt != null && t >= ctx.standAt) { const u = t - ctx.standAt; stand = u < 12 ? 28 * u / 12 : 12 + 16 * Math.exp(-(u - 12) / 10); }
      drift += 0.05 * gauss(); drift *= 0.995;
      const hr = base + stand + drift + amp * (lung - 0.5) * (ctx.standAt != null && t >= ctx.standAt ? 0.5 : 1);
      let rr = 60000 / hr + 9 * gauss();
      if (rnd() < 0.006) rr *= 0.62; // occasional early beat
      t += rr / 1000;
      return [t, rr];
    },
    get t() { return t; }
  };
}
