// Smoke test for Monte Carlo (runs in main thread, skips the worker plumbing).
import fs from 'fs';
import jsYaml from 'js-yaml';

const { runMonteCarlo } = await import('./src/lib/sim/monteCarlo.ts');
const { defaultScenario } = await import('./src/lib/types/scenario.ts');
const { defaultMCConfig } = await import('./src/lib/sim/returns.ts');

const rules = jsYaml.load(fs.readFileSync('./public/tax-configs/tax-2025.yml', 'utf-8'));
const scenario = defaultScenario();
const mc = defaultMCConfig();
mc.runs = 500;

const t0 = Date.now();
const result = runMonteCarlo(scenario, rules, mc, null, 2026);
const elapsed = Date.now() - t0;

console.log(`=== MC SUMMARY (${result.runs} runs in ${elapsed}ms) ===`);
const b = result.lifetimeTax;
console.log(`Lifetime tax: p10=$${Math.round(b.p10).toLocaleString()} | p50=$${Math.round(b.p50).toLocaleString()} | p90=$${Math.round(b.p90).toLocaleString()} | mean=$${Math.round(b.mean).toLocaleString()}`);

const eb = result.endingTotalBalance;
console.log(`Ending balance: p10=$${Math.round(eb.p10).toLocaleString()} | p50=$${Math.round(eb.p50).toLocaleString()} | p90=$${Math.round(eb.p90).toLocaleString()}`);

const tf = result.endingTaxFree;
console.log(`Ending Roth: p10=$${Math.round(tf.p10).toLocaleString()} | p50=$${Math.round(tf.p50).toLocaleString()} | p90=$${Math.round(tf.p90).toLocaleString()}`);

console.log(`Probability of depletion: ${(result.probDepletion * 100).toFixed(1)}%`);
if (result.meanDepletionAge != null) console.log(`Mean depletion age: ${result.meanDepletionAge.toFixed(1)}`);

console.log('\n=== TOTAL BALANCE BANDS BY AGE (every 5 years) ===');
for (const ab of result.totalBalanceByAge.filter((_, i) => i % 5 === 0)) {
  const b = ab.bands;
  console.log(`age ${ab.age}: p10=$${(b.p10/1e6).toFixed(2)}M | p50=$${(b.p50/1e6).toFixed(2)}M | p90=$${(b.p90/1e6).toFixed(2)}M`);
}
