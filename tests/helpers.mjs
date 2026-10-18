// Loads the HRV maths into a sandbox (no browser needed).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = readFileSync(join(root, 'src', 'core.js'), 'utf8').replace(/\{\{APP_NAME\}\}/g, 'Still Point');

export function load() {
  const ctx = vm.createContext({ console, Date, Math });
  vm.runInContext(code + `
    ;globalThis.api = { cleanRR, hrvOf, orthoOf, rsaOf, resonanceOf, pacer, baseline, trend, trendInsights, dailySeries, makeSim, scoreOf, PACES, RESONANCE_STEPS, DAY, dayStart };`, ctx);
  return ctx.api;
}
export const distHtml = () => readFileSync(join(root, 'dist', 'index.html'), 'utf8');
