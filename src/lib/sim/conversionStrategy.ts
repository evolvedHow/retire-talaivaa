import type { ConversionStrategy } from '../types/scenario';
import type { TaxRules, FilingStatus, Bracket } from '../tax-core/types/taxRules';

// Given the year's ordinary income BEFORE conversion (wages + pension + taxable SS + RMD + other),
// return the conversion amount that fills up to the top of the target marginal-rate bracket.
function fillBracket(
  _ordinaryIncomeBefore: number,
  taxableIncomeBefore: number,
  targetMarginalRate: number,
  rules: TaxRules,
  fs: FilingStatus,
  taxDeferredAvailable: number,
): number {
  const brackets: Bracket[] = (rules.federal.brackets[fs] ?? []).slice().sort((a, b) => a.floor - b.floor);
  // "Fill to X%" = top off up to the END of the highest bracket whose rate is <= X%.
  // Bracket schedules drift between law modes (e.g. TCJA-sunset has 25% not 24%), so
  // we tolerate the target not matching any rate exactly.
  let target: Bracket | null = null;
  for (const b of brackets) {
    if (b.rate <= targetMarginalRate + 1e-9) target = b;
    else break;
  }
  if (!target) return 0;
  const ceiling = target.ceiling ?? Infinity;
  // Conversion adds 1:1 to taxable income.
  const headroom = ceiling - taxableIncomeBefore;
  if (headroom <= 0) return 0;
  return Math.max(0, Math.min(headroom, taxDeferredAvailable));
}

export function resolveConversion(
  strategy: ConversionStrategy,
  age: number,
  ordinaryIncomeBefore: number,
  taxableIncomeBefore: number,
  rules: TaxRules,
  fs: FilingStatus,
  taxDeferredAvailable: number,
): number {
  switch (strategy.mode) {
    case 'none':
      return 0;
    case 'fixed-annual': {
      if (age < strategy.startAge || age > strategy.endAge) return 0;
      const desired = strategy.perAgeOverride?.[age] ?? strategy.amount;
      return Math.min(Math.max(0, desired), taxDeferredAvailable);
    }
    case 'custom':
      return Math.min(strategy.perAge[age] ?? 0, taxDeferredAvailable);
    case 'fill-bracket':
      if (strategy.startAge != null && age < strategy.startAge) return 0;
      if (strategy.endAge != null && age > strategy.endAge) return 0;
      return fillBracket(
        ordinaryIncomeBefore,
        taxableIncomeBefore,
        strategy.targetMarginalRate,
        rules,
        fs,
        taxDeferredAvailable,
      );
  }
}
