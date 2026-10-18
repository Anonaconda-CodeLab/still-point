import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

const A = load();

test('RMSSD on a known series, and ln/score', () => {
  // alternating 1000/1040 ms: every successive difference is 40 ms
  const list = []; let t = 0;
  for (let i = 0; i < 120; i++) { const rr = i % 2 ? 1040 : 1000; t += rr / 1000; list.push([t, rr]); }
  const h = A.hrvOf(A.cleanRR(list));
  assert.ok(Math.abs(h.rmssd - 40) < 1e-9);
  assert.ok(Math.abs(h.ln - Math.log(40)) < 1e-9);
  assert.equal(h.score, Math.round(Math.log(40) * 100 / 6.5));
  assert.equal(h.artPct, 0);
  assert.equal(h.quality, 'good');
});

test('an ectopic beat is rejected and does not inflate RMSSD', () => {
  const list = []; let t = 0;
  for (let i = 0; i < 120; i++) { let rr = i % 2 ? 1010 : 990; if (i === 60) rr = 600; if (i === 61) rr = 1400; t += rr / 1000; list.push([t, rr]); }
  const h = A.hrvOf(A.cleanRR(list));
  assert.ok(h.rmssd < 25, 'rmssd ' + h.rmssd);
  assert.equal(h.beats - h.good, 2);
});

test('no difference is taken across a break', () => {
  const list = []; let t = 0;
  for (let i = 0; i < 60; i++) { t += 1; list.push([t, 1000]); }
  list.push([t, -1]);
  for (let i = 0; i < 60; i++) { t += 0.7; list.push([t, 700]); }
  const h = A.hrvOf(A.cleanRR(list));
  assert.equal(h.rmssd, 0);
});

test('pacer covers 3 to 7 breaths per minute in half steps, with smooth phases', () => {
  assert.deepEqual([...A.PACES], [3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7]);
  const p = A.pacer(6, 0.4);
  assert.equal(p.cycle, 10);
  assert.equal(p.at(0).phase, 'in'); assert.ok(p.at(0).lung < 0.01);
  assert.ok(Math.abs(p.at(4).lung - 1) < 0.01 || p.at(4).phase === 'out');
  assert.equal(p.at(5).phase, 'out');
  assert.ok(p.at(9.99).lung < 0.01);
});

test('simulated paced breathing: resonance test picks the pace with the biggest heart-rate swing', () => {
  const sim = A.makeSim(3), list = [], steps = []; let t0 = 0;
  for (const pace of A.RESONANCE_STEPS) {
    const pc = A.pacer(pace, 0.4), start = sim.t;
    while (sim.t < start + 120) list.push(sim.next({ pace, lung: t => pc.at(t - start).lung }));
    steps.push({ pace, t0: start, t1: sim.t }); t0 = sim.t;
  }
  const r = A.resonanceOf(A.cleanRR(list), steps);
  assert.ok([5, 5.5, 6].includes(r.best), 'best ' + r.best);
  for (const row of r.rows) assert.ok(row.cycles >= 5 && row.amp > 3);
});

test('standing test finds the heart-rate rise', () => {
  const sim = A.makeSim(9), list = [];
  while (sim.t < 120) list.push(sim.next({}));
  const standAt = sim.t;
  while (sim.t < standAt + 120) list.push(sim.next({ standAt }));
  const o = A.orthoOf(A.cleanRR(list), standAt, sim.t);
  assert.ok(o.rise > 18 && o.rise < 40, 'rise ' + o.rise);
  assert.ok(o.settle > 5 && o.settle < o.rise, 'settle ' + o.settle);
  assert.ok(o.ratio3015 > 1, '30:15 ' + o.ratio3015);
});

test('baseline needs 7 earlier days, then compares the 7-day average with the normal range', () => {
  const now = new Date(2026, 9, 18, 7, 0).getTime(), R = [];
  for (let d = 30; d >= 1; d--) R.push({ id: 'r' + d, t: now - d * A.DAY, pos: 'lying', ln: 4 + 0.08 * Math.sin(d), hr: 55, quality: 'good' });
  // second reading the same day is ignored
  R.push({ id: 'x', t: now - 2 * A.DAY + 3600e3, pos: 'lying', ln: 2, hr: 70, quality: 'good' });
  const b = A.baseline(R, 'lying', now);
  assert.ok(b.ready); assert.equal(b.status, 'steady');
  // a low week
  const low = R.map(r => r.t > now - 7 * A.DAY ? Object.assign({}, r, { ln: 3.6 }) : r);
  low.push({ id: 't', t: now, pos: 'lying', ln: 3.5, hr: 62, quality: 'good' });
  const b2 = A.baseline(low, 'lying', now);
  assert.equal(b2.status, 'low'); assert.ok(b2.todayZ < -2); assert.ok(b2.hrDelta > 5);
  // spot checks never change the baseline
  const spot = R.concat([{ id: 's', t: now - 3600e3, pos: 'lying', ln: 1.5, hr: 90, quality: 'good', type: 'spot' }]);
  assert.equal(A.baseline(spot, 'lying', now).status, 'steady');
  // other positions don't count, and too few days isn't ready
  assert.equal(A.baseline(R, 'sitting', now).ready, false);
  assert.equal(A.baseline(R.slice(-4), 'lying', now).ready, false);
  // trend has a value per day and a band once ready
  const tr = A.trend(R, 'lying', now, 60);
  assert.equal(tr.length, 30);
  assert.ok(Number.isNaN(tr[0].avg7) && Number.isFinite(tr[tr.length - 1].lo));
});

test('trends commentary: steady, a low run with heart rate up, bouncy weeks, standing rise and sparse readings', () => {
  const now = new Date(2026, 9, 18, 7, 0).getTime(), mk = (d, ln, hr, min = 0) => ({ id: 'r' + d, t: now - d * A.DAY + min * 60e3, pos: 'lying', ln, hr, quality: 'good' });
  const steady = []; for (let d = 40; d >= 0; d--) steady.push(mk(d, 4 + 0.1 * Math.sin(d * 1.7), 55));
  const s1 = A.trendInsights(steady, 'lying', now);
  assert.ok(s1.ready); assert.equal(s1.items.map(i => i.key).join(), 'steady');

  const low = steady.map(r => (now - r.t) < 6.5 * A.DAY ? Object.assign({}, r, { ln: 3.6, hr: 61 }) : r);
  const keys = A.trendInsights(low, 'lying', now).items.map(i => i.key);
  assert.ok(keys.includes('low-run') && keys.includes('hr-up'), keys.join());

  const bouncy = steady.map(r => (now - r.t) < 6.5 * A.DAY ? Object.assign({}, r, { ln: 4 + ((now - r.t) / A.DAY % 2 < 1 ? 0.35 : -0.35) }) : r);
  assert.ok(A.trendInsights(bouncy, 'lying', now).items.some(i => i.key === 'bouncy'));

  const rises = []; for (let d = 30; d >= 0; d -= 3) rises.push({ t: now - d * A.DAY, rise: d < 7 ? 32 : 22 });
  assert.ok(A.trendInsights(steady, 'lying', now, rises).items.some(i => i.key === 'stand-up'));

  const sparse = steady.filter(r => (now - r.t) > 14 * A.DAY || (now - r.t) / A.DAY % 3 < 1);
  assert.ok(A.trendInsights(sparse, 'lying', now).items.some(i => i.key === 'sparse'));

  const times = steady.map((r, i) => Object.assign({}, r, { t: r.t + (i % 2 ? 150 : 0) * 60e3 }));
  assert.ok(A.trendInsights(times, 'lying', now).items.some(i => i.key === 'times'));

  assert.equal(A.trendInsights(steady.slice(-4), 'lying', now).ready, false);
});

test('breathing rate is recovered from the beat intervals', () => {
  for (const [pace, ctxPace] of [[14, null], [6, 6], [10, 10]]) {
    const sim = A.makeSim(21), list = [];
    while (sim.t < 120) list.push(sim.next(ctxPace ? { pace: ctxPace, lung: t => (1 - Math.cos(2 * Math.PI * t * ctxPace / 60)) / 2 } : {}));
    const br = A.breathRate(A.cleanRR(list), 30, 120);
    assert.ok(br && Math.abs(br - pace) <= 1, `expected ~${pace}, got ${br}`);
  }
  assert.equal(A.breathRate(A.cleanRR([[1, 1000], [2, 1000]]), 0, 10), null);
});

test('breathing patterns with holds: box and 4-7-8', () => {
  const box = A.patternPacer(4, 4, 4, 4);
  assert.equal(box.cycle, 16);
  assert.equal(box.at(2).phase, 'in'); assert.equal(box.at(5).phase, 'hold'); assert.equal(box.at(5).lung, 1);
  assert.equal(box.at(9).phase, 'out'); assert.equal(box.at(13).phase, 'hold2'); assert.equal(box.at(13).lung, 0);
  const p = A.patternPacer(4, 7, 8, 0); assert.equal(p.cycle, 19); assert.equal(p.at(18.9).phase, 'out');
});

test('tags and sleep: effects appear after 3 tagged and 5 untagged mornings', () => {
  const now = new Date(2026, 9, 18, 7, 0).getTime(), R = [];
  for (let d = 30; d >= 0; d--) {
    const alc = d % 5 === 0, score = 50 + (d * 7) % 45;
    R.push({ id: 'r' + d, t: now - d * A.DAY, pos: 'lying', ln: 4 - (alc ? 0.2 : 0) + (score - 70) / 150, hr: 55, quality: 'good', tags: alc ? ['alcohol'] : [], sleepScore: score });
  }
  const e = A.tagEffects(R, 'lying', { alcohol: 'Alcohol last night' });
  const alc = e.effects.find(x => x.key === 'alcohol');
  assert.ok(alc && alc.pct < -12 && alc.pct > -25, JSON.stringify(e));
  const sl = e.effects.find(x => x.key === 'sleepScore'); assert.ok(sl && sl.pct < 0);
  assert.equal(A.tagEffects(R.slice(-6), 'lying').effects.length, 0);
});

test('training guidance follows the baseline', () => {
  assert.equal(A.trainingAdvice({ ready: false }), null);
  const base = { ready: true, today: {}, status: 'steady', todayZ: 0.2, hrDelta: 0 };
  assert.equal(A.trainingAdvice(base).level, 'go');
  assert.equal(A.trainingAdvice(Object.assign({}, base, { status: 'low' })).level, 'easy');
  assert.equal(A.trainingAdvice(Object.assign({}, base, { todayZ: -1.8, hrDelta: 6 })).level, 'rest');
});

test('Elite HRV text files: intervals in ms or seconds, time from the file name', () => {
  assert.deepEqual([...A.parseRRText('1000\n1020\r\n980\n')], [1000, 1020, 980]);
  assert.deepEqual([...A.parseRRText('1.000\n1.020\n0.980')], [1000, 1020, 980]);
  const l = A.rrToList([1000, 1000]); assert.equal(l[1][0], 2);
  assert.equal(A.timeFromName('2015-05-12 07-48-32.txt'), new Date(2015, 4, 12, 7, 48, 32).getTime());
  assert.equal(A.timeFromName('notes.txt'), null);
});
