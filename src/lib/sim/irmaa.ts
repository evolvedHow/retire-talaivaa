// IRMAA — Income Related Monthly Adjustment Amount.
// Medicare Part B + Part D surcharges that kick in at age 65, using MAGI from
// 2 calendar years prior. Tiers in 2025 (CMS announcement, Nov 2024) below.
//
// Per-person, per-month. A couple on Medicare pays both; we model that here.
// Thresholds are stored in 2025 dollars and inflated by inflationRate to target year.
// Surcharge dollar amounts are also inflated (CMS adjusts these annually based on
// program costs, but CPI is a reasonable long-run proxy for sim purposes).

import type { FilingStatus } from '../tax-core/types/taxRules';

export interface IrmaaTier {
  // Upper bound on MAGI (single thresholds; MFJ doubles by convention here).
  // Last tier has null = unbounded.
  singleMagiCeiling: number | null;
  // Per-person per-month additional Part B premium (above the base premium)
  partBMonthly: number;
  // Per-person per-month Part D IRMAA add-on
  partDMonthly: number;
  // Display label for the tier
  label: string;
}

// 2025 official IRMAA tiers (CMS, based on 2023 MAGI).
// Single thresholds; MFJ ≈ 2x except top tier ($500k → $750k).
// Source: https://www.cms.gov/newsroom/fact-sheets/2025-medicare-parts-b-premiums-and-deductibles
export const IRMAA_TIERS_2025: IrmaaTier[] = [
  { singleMagiCeiling: 106000,  partBMonthly: 0,      partDMonthly: 0,     label: 'No IRMAA' },
  { singleMagiCeiling: 133000,  partBMonthly: 74.00,  partDMonthly: 13.70, label: 'Tier 1' },
  { singleMagiCeiling: 167000,  partBMonthly: 185.00, partDMonthly: 35.30, label: 'Tier 2' },
  { singleMagiCeiling: 200000,  partBMonthly: 295.90, partDMonthly: 57.00, label: 'Tier 3' },
  { singleMagiCeiling: 500000,  partBMonthly: 406.90, partDMonthly: 78.60, label: 'Tier 4' },
  { singleMagiCeiling: null,    partBMonthly: 443.90, partDMonthly: 85.80, label: 'Tier 5 (max)' },
];

// MFJ uses 2x the single threshold for tiers 0-4, and a hard $750k for top.
const MFJ_TOP_TIER_THRESHOLD = 750000;

const IRMAA_BASE_YEAR = 2025;
const MEDICARE_ELIGIBLE_AGE = 65;

function magiCeilingForFiling(tier: IrmaaTier, fs: FilingStatus): number | null {
  if (tier.singleMagiCeiling == null) return null;
  if (fs === 'married_filing_jointly') {
    // top non-null tier uses MFJ-specific top threshold
    return tier.singleMagiCeiling === 500000 ? MFJ_TOP_TIER_THRESHOLD : tier.singleMagiCeiling * 2;
  }
  if (fs === 'married_filing_separately') {
    // MFS has only 3 effective tiers in practice; we approximate by using single thresholds.
    // Real MFS rule: ≤ $106k no surcharge; $106k–$394k tier 4; > $394k tier 5.
    return tier.singleMagiCeiling;
  }
  // single and head_of_household use single thresholds
  return tier.singleMagiCeiling;
}

export interface IrmaaResult {
  tier: number;          // 0..5
  tierLabel: string;
  partBAnnual: number;   // total household annual Part B IRMAA (both spouses if applicable)
  partDAnnual: number;   // total household annual Part D IRMAA
  totalAnnual: number;   // partB + partD
  payers: number;        // 1 or 2 people on Medicare this year
  magiUsed: number;      // the MAGI value used (2 years prior in real Medicare; passed in here)
}

/**
 * Compute annual IRMAA surcharge for a household in a given calendar year.
 *
 * @param magi          MAGI to look up (caller is responsible for using Y-2 MAGI per Medicare rules)
 * @param fs            filing status for threshold lookup
 * @param targetYear    calendar year these IRMAA rates apply to (used to inflate brackets)
 * @param inflationRate annual inflation for threshold + surcharge projection
 * @param primaryAge    primary's age in targetYear (>= 65 → pays IRMAA)
 * @param spouseAge     spouse's age, or null if single
 */
export function irmaaSurcharge(
  magi: number,
  fs: FilingStatus,
  targetYear: number,
  inflationRate: number,
  primaryAge: number,
  spouseAge: number | null,
): IrmaaResult {
  const yearsFromBase = Math.max(0, targetYear - IRMAA_BASE_YEAR);
  const factor = Math.pow(1 + inflationRate, yearsFromBase);

  // How many spouses are on Medicare this year?
  let payers = 0;
  if (primaryAge >= MEDICARE_ELIGIBLE_AGE) payers++;
  if (spouseAge != null && spouseAge >= MEDICARE_ELIGIBLE_AGE) payers++;

  if (payers === 0) {
    return { tier: 0, tierLabel: 'Pre-Medicare', partBAnnual: 0, partDAnnual: 0, totalAnnual: 0, payers: 0, magiUsed: magi };
  }

  // Find the tier whose ceiling MAGI > magi
  let tierIdx = IRMAA_TIERS_2025.length - 1;
  for (let i = 0; i < IRMAA_TIERS_2025.length; i++) {
    const t = IRMAA_TIERS_2025[i];
    const ceil = magiCeilingForFiling(t, fs);
    const projectedCeil = ceil == null ? Infinity : ceil * factor;
    if (magi <= projectedCeil) { tierIdx = i; break; }
  }

  const tier = IRMAA_TIERS_2025[tierIdx];
  const partBMonthly = tier.partBMonthly * factor;
  const partDMonthly = tier.partDMonthly * factor;
  const partBAnnual = partBMonthly * 12 * payers;
  const partDAnnual = partDMonthly * 12 * payers;

  return {
    tier: tierIdx,
    tierLabel: tier.label,
    partBAnnual,
    partDAnnual,
    totalAnnual: partBAnnual + partDAnnual,
    payers,
    magiUsed: magi,
  };
}

// Sentinel for "use synthesized pre-sim MAGI" — see simulatePath.
export const PRE_SIM_MAGI_SENTINEL = -1;
