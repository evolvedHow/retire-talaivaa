import type { TaxRules } from '../tax-core/types/taxRules';
import type { ScenarioInputs } from '../types/scenario';
import type { SimulationPath } from '../types/path';
import type { YearState } from '../types/yearState';
import { simulateYear, type YearReturns } from './simulateYear';

export interface ReturnPath {
  taxDeferred: number[];
  taxFree: number[];
  taxable: number[];
}

export interface SimulatePathOptions {
  startYear?: number; // calendar year that maps to scenario.currentAge — default = current year
  returnPath?: ReturnPath;
  // Override the conversion strategy without mutating the scenario object.
  // Used by compare.ts to run a 'no conversion' counterfactual against the same scenario.
  strategyOverride?: ScenarioInputs['strategy'];
}

// Synthesize a pre-sim MAGI for IRMAA's Y-2 lookback in the first 2 simulation years.
// Rough proxy: wages + a sliver of taxable-account yield. Only matters for users who
// hit Medicare within the first 2 years of the sim window.
function synthesizePreSimMAGI(scenario: ScenarioInputs): number {
  return scenario.currentWages + scenario.taxable * 0.02;
}

export function simulatePath(
  scenario: ScenarioInputs,
  rules: TaxRules,
  opts: SimulatePathOptions = {},
): SimulationPath {
  const startYear = opts.startYear ?? new Date().getFullYear();
  const ctx = { baseRules: rules, baseYear: rules.meta.tax_year, startYear };

  const effectiveScenario = opts.strategyOverride != null
    ? { ...scenario, strategy: opts.strategyOverride }
    : scenario;

  const years: YearState[] = [];
  let prev: YearState | null = null;
  const horizon = Math.max(1, effectiveScenario.planUntilAge - effectiveScenario.currentAge + 1);

  const seedMAGI = synthesizePreSimMAGI(effectiveScenario);
  const magiHistory: number[] = []; // index = sim year (0-based)

  for (let i = 0; i < horizon; i++) {
    let overrideReturns: YearReturns | undefined;
    if (opts.returnPath) {
      overrideReturns = {
        taxDeferred: opts.returnPath.taxDeferred[i] ?? effectiveScenario.returnTaxDeferred,
        taxFree: opts.returnPath.taxFree[i] ?? effectiveScenario.returnTaxFree,
        taxable: opts.returnPath.taxable[i] ?? effectiveScenario.returnTaxable,
      };
    }
    const magiLookback = i >= 2 ? magiHistory[i - 2] : seedMAGI;
    const ys = simulateYear(prev, effectiveScenario, ctx, overrideReturns, magiLookback);
    years.push(ys);
    magiHistory.push(ys.magi);
    prev = ys;
  }

  // ── Aggregates ────────────────────────────────────────────────────────────
  let lifetimeFederalTax = 0;
  let lifetimeStateTax = 0;
  let lifetimeIRMAA = 0;
  let lifetimeTax = 0;
  let lifetimeTaxNPV = 0;
  let totalConverted = 0;
  let totalRMD = 0;
  let largestSingleYearTax = 0;
  let largestSingleYearTaxAge = effectiveScenario.currentAge;
  let yearsUntilDepletion: number | null = null;

  const discount = effectiveScenario.discountRate ?? 0;

  for (let i = 0; i < years.length; i++) {
    const y = years[i];
    lifetimeFederalTax += y.federalTax;
    lifetimeStateTax += y.stateTax;
    lifetimeIRMAA += y.irmaaPartB + y.irmaaPartD;
    lifetimeTax += y.totalTax;
    // NPV in *real* (today's) dollars: deflate nominal back via inflationFactor, then discount.
    const realTax = y.totalTax / y.inflationFactor;
    lifetimeTaxNPV += realTax / Math.pow(1 + discount, i);
    totalConverted += y.conversion;
    totalRMD += y.rmd;
    if (y.totalTax > largestSingleYearTax) {
      largestSingleYearTax = y.totalTax;
      largestSingleYearTaxAge = y.age;
    }
    const totalBal = y.close.taxDeferred + y.close.taxFree + y.close.taxable;
    if (yearsUntilDepletion == null && totalBal < 1000 && y.spendingShortfall > 0) {
      yearsUntilDepletion = y.age - effectiveScenario.currentAge;
    }
  }

  const last = years[years.length - 1];
  const endingTotalBalance = last.close.taxDeferred + last.close.taxFree + last.close.taxable;
  return {
    inputs: effectiveScenario,
    years,
    lifetimeFederalTax,
    lifetimeStateTax,
    lifetimeIRMAA,
    lifetimeTax,
    lifetimeTaxNPV,
    totalConverted,
    totalRMD,
    endingTaxDeferred: last.close.taxDeferred,
    endingTaxFree: last.close.taxFree,
    endingTaxable: last.close.taxable,
    endingTotalBalance,
    endingTotalBalanceReal: endingTotalBalance / last.inflationFactor,
    yearsUntilDepletion,
    largestSingleYearTax,
    largestSingleYearTaxAge,
  };
}
