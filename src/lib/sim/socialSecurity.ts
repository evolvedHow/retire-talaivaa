import type { FilingStatus } from '../tax-core/types/taxRules';

// Provisional-income thresholds for the taxable-SS calculation.
// These are NOT inflation-adjusted in current law (frozen since 1993).
const TIER1 = { single: 25000, married_filing_jointly: 32000, head_of_household: 25000, married_filing_separately: 0 };
const TIER2 = { single: 34000, married_filing_jointly: 44000, head_of_household: 34000, married_filing_separately: 0 };

// Returns the taxable portion of gross SS benefits given AGI-excluding-SS and other income.
export function taxableSSPortion(
  ssGross: number,
  agiExcludingSS: number,
  taxExemptInterest: number,
  filingStatus: FilingStatus,
): number {
  if (ssGross <= 0) return 0;
  const provisional = agiExcludingSS + taxExemptInterest + 0.5 * ssGross;
  const t1 = TIER1[filingStatus];
  const t2 = TIER2[filingStatus];
  if (provisional <= t1) return 0;
  if (provisional <= t2) {
    return Math.min(0.5 * ssGross, 0.5 * (provisional - t1));
  }
  // Above tier 2: lesser of 85% of SS, or 85% of (provisional - t2) + lesser of (50% SS, 50% of (t2-t1))
  const tier1Portion = Math.min(0.5 * ssGross, 0.5 * (t2 - t1));
  return Math.min(0.85 * ssGross, 0.85 * (provisional - t2) + tier1Portion);
}

// Reduce SS by early-claim factor or boost by delayed-credit factor.
// Simple linear approximation around FRA = 67.
// Real rules: 5/9% per month for first 36 mo early, 5/12% for additional; 8%/yr after FRA up to 70.
const FRA = 67;
export function ssAtClaimAge(monthlyAtFRA: number, claimAge: number): number {
  if (claimAge < 62) return 0;
  if (claimAge >= 70) claimAge = 70;
  if (claimAge === FRA) return monthlyAtFRA;
  if (claimAge < FRA) {
    const monthsEarly = (FRA - claimAge) * 12;
    const first36 = Math.min(monthsEarly, 36);
    const rest = Math.max(0, monthsEarly - 36);
    const reduction = first36 * (5 / 9 / 100) + rest * (5 / 12 / 100);
    return monthlyAtFRA * Math.max(0, 1 - reduction);
  }
  // delayed retirement credits: 8% per year (2/3 of 1% per month)
  const monthsLate = (claimAge - FRA) * 12;
  return monthlyAtFRA * (1 + monthsLate * (2 / 3 / 100));
}

export function annualSSForYear(
  monthlyAtFRA: number,
  claimAge: number,
  age: number,
  yearsSinceBase: number,
  ssCOLA: number,
): number {
  if (age < claimAge) return 0;
  const monthly = ssAtClaimAge(monthlyAtFRA, claimAge);
  // COLA compounds from the year of claiming forward. Simplification: compound from base year.
  return monthly * 12 * Math.pow(1 + ssCOLA, yearsSinceBase);
}
