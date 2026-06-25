// Quick smoke test: load real YAML, run simulatePath, print summary.
// Run with: node --experimental-strip-types smoke-test.mjs  (Node 22+)
// Or compile via: npx tsx smoke-test.mjs
import fs from 'fs';
import jsYaml from 'js-yaml';

// Dynamic import via Vite-style works in Node ESM with relative .ts paths only via loaders.
// Easiest: use tsx. Fallback: write a JS-compatible mini-test.
const { simulatePath } = await import('./src/lib/sim/simulatePath.ts');
const { defaultScenario } = await import('./src/lib/types/scenario.ts');
const { compare } = await import('./src/lib/sim/compare.ts');

const rules = jsYaml.load(fs.readFileSync('./public/tax-configs/tax-2025.yml', 'utf-8'));
const scenario = defaultScenario();
const path = simulatePath(scenario, rules, { startYear: 2026 });

console.log('=== SUMMARY ===');
console.log('Years:', path.years.length);
console.log('Lifetime tax:', '$' + Math.round(path.lifetimeTax).toLocaleString());
console.log('Lifetime federal:', '$' + Math.round(path.lifetimeFederalTax).toLocaleString());
console.log('Lifetime state:', '$' + Math.round(path.lifetimeStateTax).toLocaleString());
console.log('Total converted:', '$' + Math.round(path.totalConverted).toLocaleString());
console.log('Total RMD:', '$' + Math.round(path.totalRMD).toLocaleString());
console.log('Ending tax-def:', '$' + Math.round(path.endingTaxDeferred).toLocaleString());
console.log('Ending tax-free:', '$' + Math.round(path.endingTaxFree).toLocaleString());
console.log('Ending taxable:', '$' + Math.round(path.endingTaxable).toLocaleString());
console.log('Depletion:', path.yearsUntilDepletion);

console.log('\n=== FIRST 5 YEARS ===');
for (const y of path.years.slice(0, 5)) {
  console.log(`age ${y.age} (${y.year}): wages=${Math.round(y.wages)}, ss=${Math.round(y.ssGross)}, rmd=${Math.round(y.rmd)}, conv=${Math.round(y.conversion)}, wd-def=${Math.round(y.withdrawal.taxDeferred)}, wd-tax=${Math.round(y.withdrawal.taxable)}, tax=${Math.round(y.totalTax)}, mr=${(y.marginalRate*100).toFixed(0)}%, balDef=${Math.round(y.close.taxDeferred)}, balFree=${Math.round(y.close.taxFree)}`);
}

console.log('\n=== AT RETIREMENT (age 65-72) — IRMAA tier shown ===');
for (const y of path.years.filter(y => y.age >= 65 && y.age <= 75)) {
  console.log(`age ${y.age}: ss=${Math.round(y.ssGross)}, rmd=${Math.round(y.rmd)}, conv=${Math.round(y.conversion)}, tax=${Math.round(y.totalTax)}, mr=${(y.marginalRate*100).toFixed(0)}%, magi=${Math.round(y.magi)}, irmaa=${Math.round(y.irmaaPartB+y.irmaaPartD)} (${y.irmaaTierLabel})`);
}

console.log('\n=== COMPARISON (with strategy vs no-conversion baseline) ===');
const cmp = compare(scenario, rules, { startYear: 2026 });
console.log(`Lifetime tax NPV: with=$${Math.round(cmp.withStrategy.lifetimeTaxNPV).toLocaleString()} | without=$${Math.round(cmp.withoutStrategy.lifetimeTaxNPV).toLocaleString()} | Δ=$${Math.round(cmp.delta.lifetimeTaxNPV).toLocaleString()}`);
console.log(`Terminal real NW:  with=$${Math.round(cmp.withStrategy.endingTotalBalanceReal).toLocaleString()} | without=$${Math.round(cmp.withoutStrategy.endingTotalBalanceReal).toLocaleString()} | Δ=$${Math.round(cmp.delta.endingTotalBalanceReal).toLocaleString()}`);
console.log(`Lifetime IRMAA:    with=$${Math.round(cmp.withStrategy.lifetimeIRMAA).toLocaleString()} | without=$${Math.round(cmp.withoutStrategy.lifetimeIRMAA).toLocaleString()} | Δ=$${Math.round(cmp.delta.lifetimeIRMAA).toLocaleString()}`);
console.log(`Total RMD:         with=$${Math.round(cmp.withStrategy.totalRMD).toLocaleString()} | without=$${Math.round(cmp.withoutStrategy.totalRMD).toLocaleString()} | Δ=$${Math.round(cmp.delta.totalRMD).toLocaleString()}`);
