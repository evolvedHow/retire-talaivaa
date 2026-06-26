import type { TaxRules } from '../tax-core/types/taxRules';
import type { ScenarioInputs, ConversionStrategy } from '../types/scenario';
import { simulatePath, type SimulatePathOptions } from './simulatePath';

export interface SweepPoint {
  amount: number;            // X-axis value: the conversion lever's $ value at this point
  lifetimeTaxNPV: number;    // metric: lower is better
  terminalNWReal: number;    // metric: higher is better
  totalConverted: number;
  lifetimeIRMAA: number;
}

export interface SweepResult {
  mode: ConversionStrategy['mode'];
  points: SweepPoint[];
  currentValue: number;          // user's current slider value (may not be exactly on a swept point)
  optimumByNW: SweepPoint;        // point with highest terminalNWReal
  optimumByTax: SweepPoint;       // point with lowest lifetimeTaxNPV
  // "Good band" — points within `bandPct` of the NW optimum.
  goodBandNW: { lo: number; hi: number };
  bandPct: number;
}

// Build a scenario with the lever set to `amount`. Returns null if the
// strategy doesn't expose a $-amount lever ('none', 'custom').
function scenarioWithAmount(scenario: ScenarioInputs, amount: number): ScenarioInputs | null {
  const s = scenario.strategy;
  if (s.mode === 'fixed-annual') {
    return { ...scenario, strategy: { ...s, amount } };
  }
  if (s.mode === 'fill-bracket') {
    return { ...scenario, strategy: { ...s, annualCap: amount } };
  }
  return null; // 'none' / 'custom' — no sweep
}

function currentLeverValue(strategy: ConversionStrategy): number {
  if (strategy.mode === 'fixed-annual') return strategy.amount;
  if (strategy.mode === 'fill-bracket') return strategy.annualCap;
  return 0;
}

export interface SweepOptions {
  min?: number;     // default 0
  max?: number;     // default 300_000
  steps?: number;   // default 31 (so 0, 10k, 20k, ..., 300k)
  bandPct?: number; // default 0.01 — "good band" = within 1% of optimum NW
  pathOpts?: SimulatePathOptions;
}

export function sweepConversion(
  scenario: ScenarioInputs,
  rules: TaxRules,
  opts: SweepOptions = {},
): SweepResult | null {
  const mode = scenario.strategy.mode;
  if (mode === 'none' || mode === 'custom') return null;

  // For fill-bracket: annualCap=0 is a special "no cap" sentinel (= max
  // conversion, fill to bracket top). It's NOT the same as "cap at $0",
  // and including it in the sweep makes the optimum show up as "0k/yr"
  // even though it really means "go aggressive". Skip it; sweep meaningful
  // cap values instead. The user can still set cap=0 manually in the inputs.
  const isFillBracket = mode === 'fill-bracket';
  const min = opts.min ?? (isFillBracket ? 10_000 : 0);
  const max = opts.max ?? (isFillBracket ? 500_000 : 300_000);
  const steps = opts.steps ?? 31;
  const bandPct = opts.bandPct ?? 0.01;
  const stepSize = (max - min) / Math.max(1, steps - 1);

  const points: SweepPoint[] = [];
  for (let i = 0; i < steps; i++) {
    const amount = Math.round(min + i * stepSize);
    const swept = scenarioWithAmount(scenario, amount);
    if (!swept) continue;
    const path = simulatePath(swept, rules, opts.pathOpts);
    points.push({
      amount,
      lifetimeTaxNPV: path.lifetimeTaxNPV,
      terminalNWReal: path.endingTotalBalanceReal,
      totalConverted: path.totalConverted,
      lifetimeIRMAA: path.lifetimeIRMAA,
    });
  }

  if (points.length === 0) return null;

  const optimumByNW = points.reduce((best, p) => p.terminalNWReal > best.terminalNWReal ? p : best, points[0]);
  const optimumByTax = points.reduce((best, p) => p.lifetimeTaxNPV < best.lifetimeTaxNPV ? p : best, points[0]);

  const threshold = optimumByNW.terminalNWReal * (1 - bandPct);
  const goodPts = points.filter(p => p.terminalNWReal >= threshold);
  const goodBandNW = goodPts.length > 0
    ? { lo: Math.min(...goodPts.map(p => p.amount)), hi: Math.max(...goodPts.map(p => p.amount)) }
    : { lo: optimumByNW.amount, hi: optimumByNW.amount };

  return {
    mode,
    points,
    currentValue: currentLeverValue(scenario.strategy),
    optimumByNW,
    optimumByTax,
    goodBandNW,
    bandPct,
  };
}
