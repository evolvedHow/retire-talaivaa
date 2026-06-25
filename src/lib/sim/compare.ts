import type { TaxRules } from '../tax-core/types/taxRules';
import type { ScenarioInputs } from '../types/scenario';
import type { SimulationPath } from '../types/path';
import { simulatePath, type SimulatePathOptions } from './simulatePath';

export interface ComparisonDelta {
  // Lifetime totals (with - without)
  lifetimeTax: number;          // nominal
  lifetimeTaxNPV: number;       // real, discounted
  lifetimeIRMAA: number;
  totalRMD: number;             // typically negative (conversions reduce RMDs)
  endingTotalBalance: number;
  endingTotalBalanceReal: number;
  endingTaxFree: number;
  endingTaxDeferred: number;
}

export interface ComparisonResult {
  withStrategy: SimulationPath;
  withoutStrategy: SimulationPath;
  delta: ComparisonDelta;

  // Year-by-year diff useful for the conversion-window chart overlays
  perYear: Array<{
    age: number;
    conversion: number;
    marginalRateWith: number;
    marginalRateWithout: number;
    rmdWith: number;
    rmdWithout: number;
    irmaaTierWith: number;
    irmaaTierWithout: number;
    irmaaTotalWith: number;
    irmaaTotalWithout: number;
    magiWith: number;
    magiWithout: number;
  }>;
}

export function compare(
  scenario: ScenarioInputs,
  rules: TaxRules,
  opts: SimulatePathOptions = {},
): ComparisonResult {
  const withStrategy = simulatePath(scenario, rules, opts);
  const withoutStrategy = simulatePath(scenario, rules, {
    ...opts,
    strategyOverride: { mode: 'none' },
  });

  const delta: ComparisonDelta = {
    lifetimeTax: withStrategy.lifetimeTax - withoutStrategy.lifetimeTax,
    lifetimeTaxNPV: withStrategy.lifetimeTaxNPV - withoutStrategy.lifetimeTaxNPV,
    lifetimeIRMAA: withStrategy.lifetimeIRMAA - withoutStrategy.lifetimeIRMAA,
    totalRMD: withStrategy.totalRMD - withoutStrategy.totalRMD,
    endingTotalBalance: withStrategy.endingTotalBalance - withoutStrategy.endingTotalBalance,
    endingTotalBalanceReal: withStrategy.endingTotalBalanceReal - withoutStrategy.endingTotalBalanceReal,
    endingTaxFree: withStrategy.endingTaxFree - withoutStrategy.endingTaxFree,
    endingTaxDeferred: withStrategy.endingTaxDeferred - withoutStrategy.endingTaxDeferred,
  };

  const perYear = withStrategy.years.map((yw, i) => {
    const yo = withoutStrategy.years[i];
    return {
      age: yw.age,
      conversion: yw.conversion,
      marginalRateWith: yw.marginalRate,
      marginalRateWithout: yo.marginalRate,
      rmdWith: yw.rmd,
      rmdWithout: yo.rmd,
      irmaaTierWith: yw.irmaaTier,
      irmaaTierWithout: yo.irmaaTier,
      irmaaTotalWith: yw.irmaaPartB + yw.irmaaPartD,
      irmaaTotalWithout: yo.irmaaPartB + yo.irmaaPartD,
      magiWith: yw.magi,
      magiWithout: yo.magi,
    };
  });

  return { withStrategy, withoutStrategy, delta, perYear };
}
