import type { TaxRules } from '../tax-core/types/taxRules';
import type { ScenarioInputs } from '../types/scenario';
import { simulatePath, type ReturnPath } from './simulatePath';
import {
  makeRNG,
  sampleAssetReturns,
  portfolioReturn,
  type MonteCarloConfig,
} from './returns';

export interface PercentileBand {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  mean: number;
}

export interface AgeBand {
  age: number;
  bands: PercentileBand;
}

export interface MonteCarloResult {
  runs: number;
  totalBalanceByAge: AgeBand[];
  taxFreeByAge: AgeBand[];
  taxDeferredByAge: AgeBand[];
  taxableByAge: AgeBand[];
  marginalRateByAge: AgeBand[];

  lifetimeTax: PercentileBand;
  endingTotalBalance: PercentileBand;
  endingTaxFree: PercentileBand;
  probDepletion: number; // 0..1
  meanDepletionAge: number | null;

  // Strategy-vs-baseline comparison (same return path, both arms)
  probStrategyBeatsBaseline: number;     // 0..1 — fraction of paths where strategy > no-conversion on terminal real NW
  endingBalanceDelta: PercentileBand;    // (strategy - baseline) on terminal real NW, in today's $
  lifetimeTaxDelta: PercentileBand;      // (strategy - baseline) on lifetime tax NPV, in today's $
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function bandOf(values: number[]): PercentileBand {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
  return {
    p10: percentile(sorted, 0.1),
    p25: percentile(sorted, 0.25),
    p50: percentile(sorted, 0.5),
    p75: percentile(sorted, 0.75),
    p90: percentile(sorted, 0.9),
    mean,
  };
}

export function runMonteCarlo(
  scenario: ScenarioInputs,
  rules: TaxRules,
  mcConfig: MonteCarloConfig,
  onProgress?: (pct: number) => void,
  startYear?: number,
): MonteCarloResult {
  const horizon = Math.max(1, scenario.planUntilAge - scenario.currentAge + 1);
  const rng = makeRNG(mcConfig.seed);

  // For percentile bands per age, we collect each run's per-year total balance.
  // Storing N x H matrices in memory — for 1000 runs * 40 years that's 40k numbers per series → fine.
  const totalBal: number[][] = Array.from({ length: horizon }, () => []);
  const taxFree: number[][] = Array.from({ length: horizon }, () => []);
  const taxDef: number[][] = Array.from({ length: horizon }, () => []);
  const taxable: number[][] = Array.from({ length: horizon }, () => []);
  const mr: number[][] = Array.from({ length: horizon }, () => []);

  const lifetimeTaxes: number[] = [];
  const endingBalances: number[] = [];
  const endingTaxFrees: number[] = [];
  const depletionAges: (number | null)[] = [];

  // Strategy-vs-baseline tracking
  const endingBalanceDeltas: number[] = [];
  const lifetimeTaxDeltas: number[] = [];
  let strategyWins = 0;

  for (let run = 0; run < mcConfig.runs; run++) {
    // Sample a fresh return path
    const td: number[] = new Array(horizon);
    const tf: number[] = new Array(horizon);
    const tx: number[] = new Array(horizon);
    for (let i = 0; i < horizon; i++) {
      const sampled = sampleAssetReturns(rng, mcConfig.returnModel);
      td[i] = portfolioReturn(mcConfig.allocation.taxDeferred, sampled);
      tf[i] = portfolioReturn(mcConfig.allocation.taxFree, sampled);
      tx[i] = portfolioReturn(mcConfig.allocation.taxable, sampled);
    }
    const returnPath: ReturnPath = { taxDeferred: td, taxFree: tf, taxable: tx };
    const path = simulatePath(scenario, rules, { startYear, returnPath });
    // Same return path, baseline arm (no conversion)
    const baselinePath = simulatePath(scenario, rules, {
      startYear, returnPath, strategyOverride: { mode: 'none' },
    });

    for (let i = 0; i < horizon; i++) {
      const y = path.years[i];
      totalBal[i].push(y.close.taxDeferred + y.close.taxFree + y.close.taxable);
      taxFree[i].push(y.close.taxFree);
      taxDef[i].push(y.close.taxDeferred);
      taxable[i].push(y.close.taxable);
      mr[i].push(y.marginalRate);
    }
    lifetimeTaxes.push(path.lifetimeTax);
    endingBalances.push(path.endingTotalBalance);
    endingTaxFrees.push(path.endingTaxFree);
    depletionAges.push(path.yearsUntilDepletion != null ? scenario.currentAge + path.yearsUntilDepletion : null);

    const endDelta = path.endingTotalBalanceReal - baselinePath.endingTotalBalanceReal;
    endingBalanceDeltas.push(endDelta);
    lifetimeTaxDeltas.push(path.lifetimeTaxNPV - baselinePath.lifetimeTaxNPV);
    if (endDelta > 0) strategyWins++;

    if (onProgress && (run & 31) === 0) onProgress(run / mcConfig.runs);
  }

  const ages = Array.from({ length: horizon }, (_, i) => scenario.currentAge + i);
  const totalBalanceByAge: AgeBand[] = ages.map((age, i) => ({ age, bands: bandOf(totalBal[i]) }));
  const taxFreeByAge: AgeBand[] = ages.map((age, i) => ({ age, bands: bandOf(taxFree[i]) }));
  const taxDeferredByAge: AgeBand[] = ages.map((age, i) => ({ age, bands: bandOf(taxDef[i]) }));
  const taxableByAge: AgeBand[] = ages.map((age, i) => ({ age, bands: bandOf(taxable[i]) }));
  const marginalRateByAge: AgeBand[] = ages.map((age, i) => ({ age, bands: bandOf(mr[i]) }));

  const depletions = depletionAges.filter((d): d is number => d != null);
  const probDepletion = depletions.length / mcConfig.runs;
  const meanDepletionAge = depletions.length > 0
    ? depletions.reduce((a, b) => a + b, 0) / depletions.length
    : null;

  if (onProgress) onProgress(1);

  return {
    runs: mcConfig.runs,
    totalBalanceByAge,
    taxFreeByAge,
    taxDeferredByAge,
    taxableByAge,
    marginalRateByAge,
    lifetimeTax: bandOf(lifetimeTaxes),
    endingTotalBalance: bandOf(endingBalances),
    endingTaxFree: bandOf(endingTaxFrees),
    probDepletion,
    meanDepletionAge,
    probStrategyBeatsBaseline: strategyWins / Math.max(1, mcConfig.runs),
    endingBalanceDelta: bandOf(endingBalanceDeltas),
    lifetimeTaxDelta: bandOf(lifetimeTaxDeltas),
  };
}
