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

/* ---------- breathing rate from the heart rhythm ----------
   Heart rate rises a little on each breath in and falls on each breath out (respiratory sinus arrhythmia), so the beat
   intervals carry the breathing rhythm. The intervals are resampled at 4 Hz, detrended and windowed, and the strongest
   rhythm between 6 and 30 breaths a minute is taken. Needs at least 30 s of clean beats; returns null when no rhythm stands out. */
function breathRate(S, t0, t1) {
  const pts = idxRange(S, t0, t1).filter(i => S.OK[i]).map(i => [S.T[i], S.V[i]]);
  if (pts.length < 25) return null;
  const a = pts[0][0], span = pts[pts.length - 1][0] - a; if (span < 30) return null;
  const fs = 4, N = Math.floor(span * fs), y = new Float64Array(N);
  for (let k = 0, j = 0; k < N; k++) { const t = a + k / fs; while (j < pts.length - 2 && pts[j + 1][0] < t) j++; const [ta, va] = pts[j], [tb, vb] = pts[j + 1]; y[k] = va + (vb - va) * clamp((t - ta) / (tb - ta || 1), 0, 1); }
  let sx = 0, sy = 0, sxx = 0, sxy = 0; for (let k = 0; k < N; k++) { sx += k; sy += y[k]; sxx += k * k; sxy += k * y[k]; }
  const sl = (N * sxy - sx * sy) / (N * sxx - sx * sx), ic = (sy - sl * sx) / N;
  for (let k = 0; k < N; k++) y[k] = (y[k] - ic - sl * k) * (0.5 - 0.5 * Math.cos(2 * Math.PI * k / (N - 1)));
  let best = 0, bf = 0, tot = 0;
  for (let f = 0.1; f <= 0.5001; f += 0.0025) {
    let re = 0, im = 0; const w = 2 * Math.PI * f / fs;
    for (let k = 0; k < N; k++) { re += y[k] * Math.cos(w * k); im -= y[k] * Math.sin(w * k); }
    const p = re * re + im * im; tot += p; if (p > best) { best = p; bf = f; }
  }
  return tot > 0 && best / tot > 0.03 ? Math.round(bf * 600) / 10 : null;
}

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

/* ---------- trends commentary ----------
   Plain-language observations about the last few weeks of morning readings. Each needs enough data to say anything;
   tone: 'ok' (reassuring), 'watch' (worth noticing), 'info' (about how the readings are taken). */
function trendInsights(readings, pos, at = Date.now(), rises = []) {
  const all = dailySeries(readings, pos), now0 = dayStart(at);
  const b = baselineAt(all, at), items = [];
  if (!b.ready) return { ready: false, have: b.have, need: b.need, items };
  const recent = all.filter(d => d.t >= now0 - 13 * DAY && d.t < now0 + DAY);
  const week = all.filter(d => d.t >= now0 - 6 * DAY && d.t < now0 + DAY);
  const st = all.filter(d => d.t < now0 + DAY).map(d => Object.assign({}, d, { b: baselineAt(all, d.t) })).filter(d => d.b.ready);
  const last = st[st.length - 1];
  // 1. direction: a run outside the usual range, or a drift of the 7-day average over two weeks
  let run = 0, runFrom = null;
  if (last && last.t >= now0 - 2 * DAY && last.b.status !== 'steady') {
    const k = last.b.status; for (let i = st.length - 1; i >= 0 && st[i].b.status === k; i--) runFrom = st[i];
    run = Math.round((last.t - runFrom.t) / DAY) + 1;
    if (k === 'low') items.push({ key: 'low-run', tone: 'watch', title: run >= 3 ? `Lower than usual for ${run} days` : 'Dipped below your usual range',
      text: `Your 7-day average is below your usual range${run >= 3 ? ` and has been for ${run} days` : ''}. Runs like this often follow a block of hard training, short or broken sleep, illness, alcohol, travel or a stressful stretch. Easing off and prioritising sleep usually brings it back within a week or two.` });
    else if (k === 'high') items.push({ key: 'high-run', tone: 'ok', title: run >= 3 ? `Higher than usual for ${run} days` : 'Above your usual range',
      text: 'Your 7-day average is above your usual range. This usually reflects good recovery, for example after a lighter week, a holiday or better sleep. Only if it comes with unusual tiredness during a period of very heavy training is it worth easing off.' });
  }
  if (!items.length) {
    const old = st.filter(d => d.t <= at - 10 * DAY && d.t >= at - 18 * DAY).pop();
    const drift = old && last ? (last.b.avg7 - old.b.avg7) / b.sd : NaN;
    if (drift <= -0.5) items.push({ key: 'drift-down', tone: 'watch', title: 'Drifting down', text: 'Over the last two weeks your 7-day average has slowly slipped, though it is still within your usual range. Nothing to act on yet; just worth keeping an eye on alongside how you feel and sleep.' });
    else if (drift >= 0.5) items.push({ key: 'drift-up', tone: 'ok', title: 'Drifting up', text: 'Over the last two weeks your 7-day average has slowly risen while staying within your usual range: a sign your body is coping well with what you are doing.' });
    else items.push({ key: 'steady', tone: 'ok', title: 'Steady', text: 'Your 7-day average has stayed within your usual range over the last two weeks. Your body seems to be handling your current routine well.' });
  }
  // 2. day-to-day variation compared with your usual (a rising variation is often an early sign of strain)
  if (week.length >= 5) {
    const ratio = std(week.map(d => d.ln)) / b.sd;
    if (ratio >= 1.6) items.push({ key: 'bouncy', tone: 'watch', title: 'More up-and-down than usual', text: 'Your readings this week have jumped around more than they normally do. Unsettled days often show up this way before the average itself drops, for example with irregular sleep, late meals, alcohol or a change in training.' });
  }
  // 3. heart rate and HRV together
  const hrW = week.map(d => d.hr).filter(fin);
  if (hrW.length >= 4 && fin(b.hrMean)) {
    const dHr = mean(hrW) - b.hrMean, dLn = mean(week.map(d => d.ln)) - b.mean;
    if (dHr >= 3 && dLn < 0) items.push({ key: 'hr-up', tone: 'watch', title: 'Heart rate up, HRV down', text: `This week your resting heart rate has averaged about ${Math.round(dHr)} beats a minute above your usual while HRV is lower. When both move this way together it is a clearer sign of strain than either alone; illness coming on, heat, dehydration and heavy training are common causes.` });
    else if (dHr <= -3 && dLn > 0) items.push({ key: 'hr-down', tone: 'ok', title: 'Heart rate down, HRV up', text: `Your resting heart rate is about ${Math.round(-dHr)} beats a minute below your usual and HRV is higher: both point the same way, towards good recovery.` });
  }
  // 4. standing test: a rise creeping up compared with your earlier tests
  const rs = rises.filter(x => fin(x.rise) && x.t < at + DAY).sort((p, q) => p.t - q.t);
  if (rs.length >= 6) {
    const last3 = mean(rs.slice(-3).map(x => x.rise)), before = median(rs.slice(0, -3).slice(-20).map(x => x.rise));
    if (last3 - before >= 5) items.push({ key: 'stand-up', tone: 'watch', title: 'Bigger jump on standing', text: `In your last three standing tests your heart rate rose about ${Math.round(last3 - before)} beats a minute more than it usually does. Fatigue, dehydration, heat and hard training can all do this. If you also feel dizzy or faint when you stand, talk to a doctor.` });
  }
  // 5. how the readings are taken
  if (recent.length < 7) items.push({ key: 'sparse', tone: 'info', title: 'A few mornings missed', text: `There are ${recent.length} morning readings in the last two weeks. The comparison gets more reliable the more mornings you record; even four or five a week is plenty.` });
  if (recent.length >= 5) {
    const mins = recent.map(d => { const x = new Date(d.t); return x.getHours() * 60 + x.getMinutes(); });
    if (std(mins) > 75) items.push({ key: 'times', tone: 'info', title: 'Reading times vary', text: 'Your morning readings have been taken at quite different times of day. HRV changes through the morning, so taking it at about the same time, soon after waking, makes the comparison fairer.' });
  }
  return { ready: true, items, baseline: b };
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
