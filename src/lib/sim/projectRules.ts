import type { TaxRules, Bracket, ByFilingStatus } from '../tax-core/types/taxRules';
import type { TaxLawMode } from '../types/scenario';

// Project a TaxRules object forward in time:
//  - freeze-current: inflate bracket floors/ceilings + standard deduction by inflationRate
//  - tcja-sunset: same as freeze-current through year 2025; in 2026+, switch ordinary brackets
//    to the pre-TCJA rate schedule (10/15/25/28/33/35/39.6) and roughly halve the standard
//    deduction. Capital gains, NIIT, IRA limits, credits, and state rules stay as-is for
//    Phase 1 (TCJA-era CG brackets are mostly indexed and were already in place pre-TCJA).
//
// `baseYear` is the rules' published tax_year (e.g. 2025). `targetYear` is the year we want.

const PRE_TCJA_2017_BRACKETS: ByFilingStatus<Bracket[]> = {
  single: [
    { floor: 0,       ceiling: 9325,    rate: 0.10 },
    { floor: 9325,    ceiling: 37950,   rate: 0.15 },
    { floor: 37950,   ceiling: 91900,   rate: 0.25 },
    { floor: 91900,   ceiling: 191650,  rate: 0.28 },
    { floor: 191650,  ceiling: 416700,  rate: 0.33 },
    { floor: 416700,  ceiling: 418400,  rate: 0.35 },
    { floor: 418400,  ceiling: null,    rate: 0.396 },
  ],
  married_filing_jointly: [
    { floor: 0,       ceiling: 18650,   rate: 0.10 },
    { floor: 18650,   ceiling: 75900,   rate: 0.15 },
    { floor: 75900,   ceiling: 153100,  rate: 0.25 },
    { floor: 153100,  ceiling: 233350,  rate: 0.28 },
    { floor: 233350,  ceiling: 416700,  rate: 0.33 },
    { floor: 416700,  ceiling: 470700,  rate: 0.35 },
    { floor: 470700,  ceiling: null,    rate: 0.396 },
  ],
  head_of_household: [
    { floor: 0,       ceiling: 13350,   rate: 0.10 },
    { floor: 13350,   ceiling: 50800,   rate: 0.15 },
    { floor: 50800,   ceiling: 131200,  rate: 0.25 },
    { floor: 131200,  ceiling: 212500,  rate: 0.28 },
    { floor: 212500,  ceiling: 416700,  rate: 0.33 },
    { floor: 416700,  ceiling: 444550,  rate: 0.35 },
    { floor: 444550,  ceiling: null,    rate: 0.396 },
  ],
  married_filing_separately: [
    { floor: 0,       ceiling: 9325,    rate: 0.10 },
    { floor: 9325,    ceiling: 37950,   rate: 0.15 },
    { floor: 37950,   ceiling: 76550,   rate: 0.25 },
    { floor: 76550,   ceiling: 116675,  rate: 0.28 },
    { floor: 116675,  ceiling: 208350,  rate: 0.33 },
    { floor: 208350,  ceiling: 235350,  rate: 0.35 },
    { floor: 235350,  ceiling: null,    rate: 0.396 },
  ],
};

const PRE_TCJA_2017_STD_DED: ByFilingStatus<number> = {
  single: 6350,
  married_filing_jointly: 12700,
  head_of_household: 9350,
  married_filing_separately: 6350,
};

const PRE_TCJA_BASE_YEAR = 2017;
const TCJA_SUNSET_YEAR = 2026; // first year the old schedule applies under current sunset law

function inflateBrackets(brackets: Bracket[], factor: number): Bracket[] {
  return brackets.map(b => ({
    floor: Math.round(b.floor * factor),
    ceiling: b.ceiling == null ? null : Math.round(b.ceiling * factor),
    rate: b.rate,
  }));
}

function inflateByFs<T>(
  byFs: ByFilingStatus<T>,
  fn: (v: T) => T,
): ByFilingStatus<T> {
  const out: ByFilingStatus<T> = {};
  for (const [k, v] of Object.entries(byFs)) {
    if (v !== undefined) out[k as keyof typeof byFs] = fn(v);
  }
  return out;
}

export function projectRules(
  base: TaxRules,
  targetYear: number,
  inflationRate: number,
  mode: TaxLawMode,
): TaxRules {
  const baseYear = base.meta.tax_year;

  // Decide which schedule + std-ded to use as the *starting* template for this year
  let bracketsTemplate = base.federal.brackets;
  let stdDedTemplate = base.federal.standard_deduction;
  let templateYear = baseYear;

  if (mode === 'tcja-sunset' && targetYear >= TCJA_SUNSET_YEAR) {
    bracketsTemplate = PRE_TCJA_2017_BRACKETS;
    stdDedTemplate = PRE_TCJA_2017_STD_DED;
    templateYear = PRE_TCJA_BASE_YEAR;
  }

  const yearsToInflate = Math.max(0, targetYear - templateYear);
  const factor = Math.pow(1 + inflationRate, yearsToInflate);

  const projectedBrackets = inflateByFs(bracketsTemplate, (bs: Bracket[]) =>
    inflateBrackets(bs, factor),
  );
  const projectedStdDed = inflateByFs(stdDedTemplate, (v: number) => Math.round(v * factor));
  const projectedCG = inflateByFs(base.federal.capital_gains, (bs: Bracket[]) =>
    inflateBrackets(bs, Math.pow(1 + inflationRate, Math.max(0, targetYear - baseYear))),
  );

  return {
    ...base,
    meta: { ...base.meta, tax_year: targetYear },
    federal: {
      ...base.federal,
      standard_deduction: projectedStdDed,
      brackets: projectedBrackets,
      capital_gains: projectedCG,
    },
  };
}
