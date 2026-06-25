import type { TaxRules, ScenarioInputs as TaxInputs } from '../tax-core/types/taxRules';
import { interpret } from '../tax-core/interpreter';
import type { ScenarioInputs, AccountType } from '../types/scenario';
import type { YearState, AccountBalances, WithdrawalBreakdown } from '../types/yearState';
import { calcRMD } from './rmd';
import { annualSSForYear, taxableSSPortion } from './socialSecurity';
import { projectRules } from './projectRules';
import { resolveConversion } from './conversionStrategy';
import { irmaaSurcharge } from './irmaa';

interface SimContext {
  baseRules: TaxRules;
  baseYear: number;          // calendar year of the rules' tax_year (e.g. 2025)
  startYear: number;         // calendar year of scenario.currentAge (e.g. 2026)
}

export interface YearReturns {
  taxDeferred: number;
  taxFree: number;
  taxable: number;
}

const ZERO_WD: WithdrawalBreakdown = { taxDeferred: 0, taxFree: 0, taxable: 0 };

// Build the interpreter scenario for this year. All ordinary income lands in wages_income.
function buildTaxInputs(
  scenario: ScenarioInputs,
  ordinaryIncome: number,
  realizedGains: number,
  state: string,
  age: number,
): TaxInputs {
  return {
    filing_status: scenario.filingStatus,
    age,
    wages_income: ordinaryIncome,
    capital_gains: realizedGains,
    state,
  };
}

// Withdraw `amount` from one account, returning actual withdrawn and updated balance/basis.
function drawFrom(
  account: AccountType,
  amount: number,
  bal: AccountBalances,
): { drawn: number; realized: number; newBal: AccountBalances } {
  if (amount <= 0) return { drawn: 0, realized: 0, newBal: bal };
  let drawn = 0;
  let realized = 0;
  const newBal = { ...bal };
  if (account === 'taxable') {
    drawn = Math.min(amount, newBal.taxable);
    if (newBal.taxable > 0) {
      // FIFO is overkill — use proportional basis.
      const basisFraction = newBal.basis / newBal.taxable;
      realized = drawn * (1 - basisFraction);
      newBal.basis = Math.max(0, newBal.basis - drawn * basisFraction);
    }
    newBal.taxable -= drawn;
  } else if (account === 'taxDeferred') {
    drawn = Math.min(amount, newBal.taxDeferred);
    newBal.taxDeferred -= drawn;
  } else {
    drawn = Math.min(amount, newBal.taxFree);
    newBal.taxFree -= drawn;
  }
  return { drawn, realized, newBal };
}

export function simulateYear(
  prev: YearState | null,
  scenario: ScenarioInputs,
  ctx: SimContext,
  overrideReturns?: YearReturns,
  magiLookback?: number, // MAGI from 2 years prior, used for IRMAA tier lookup
): YearState {
  const age = prev == null ? scenario.currentAge : prev.age + 1;
  const spouseAge = scenario.spouseAge > 0 ? scenario.spouseAge + (age - scenario.currentAge) : null;
  const year = ctx.startYear + (age - scenario.currentAge);
  const yearsSinceBase = age - scenario.currentAge;
  const inflationFactor = Math.pow(1 + scenario.inflationRate, yearsSinceBase);

  const open: AccountBalances = prev == null
    ? { taxDeferred: scenario.taxDeferred, taxFree: scenario.taxFree, taxable: scenario.taxable, basis: scenario.taxableBasis }
    : { ...prev.close };

  // Project the tax rules to this calendar year (handles TCJA sunset + inflation of brackets)
  const rules = projectRules(ctx.baseRules, year, scenario.inflationRate, scenario.taxLawMode);
  const fs = scenario.filingStatus;
  const isWorking = age < scenario.retireAge;
  const state = isWorking ? scenario.currentState : scenario.retirementState;

  // ── Mandatory inflows ─────────────────────────────────────────────────────
  const wages = isWorking ? scenario.currentWages * inflationFactor : 0;
  const pension = age >= scenario.pensionStartAge ? scenario.pensionAnnual * inflationFactor : 0;
  const ssPrimary = annualSSForYear(scenario.ssMonthlyAtFRA, scenario.ssClaimAge, age, yearsSinceBase, scenario.ssCOLA);
  const ssSpouse = spouseAge != null
    ? annualSSForYear(scenario.spouseSSMonthlyAtFRA, scenario.spouseSSClaimAge, spouseAge, yearsSinceBase, scenario.ssCOLA)
    : 0;
  const ssGross = ssPrimary + ssSpouse;
  const rmd = calcRMD(open.taxDeferred, age);

  // ── SS taxable portion (depends on other ordinary income, so iterate once) ──
  let ssTaxable = taxableSSPortion(ssGross, wages + pension + rmd, 0, fs);

  // ── Conversion (depends on ordinary income BEFORE conversion) ─────────────
  // Estimate ordinary + taxable income to feed the strategy resolver
  const stdDed = rules.federal.standard_deduction[fs] ?? 0;
  const ordinaryBeforeConversion = wages + pension + ssTaxable + rmd;
  const taxableIncomeBeforeConversion = Math.max(0, ordinaryBeforeConversion - stdDed);
  const conversion = resolveConversion(
    scenario.strategy,
    age,
    ordinaryBeforeConversion,
    taxableIncomeBeforeConversion,
    rules,
    fs,
    Math.max(0, open.taxDeferred - rmd),
  );

  // ── Cash flow: solve for discretionary withdrawal ─────────────────────────
  const spendingNeeded = scenario.annualSpending * inflationFactor;

  // First pass: tax with no discretionary withdrawal
  let ordinary = wages + pension + ssTaxable + rmd + conversion;
  let realized = 0;
  let workingBal: AccountBalances = { ...open };
  // Apply conversion to balances now (it doesn't generate cash)
  workingBal.taxDeferred -= conversion;
  workingBal.taxFree += conversion;
  // Apply RMD to balances (cash leaves taxDeferred)
  workingBal.taxDeferred -= rmd;

  let taxInputs = buildTaxInputs(scenario, ordinary, realized, state, age);
  let taxResult = interpret(rules, taxInputs);

  // ── IRMAA (Medicare surcharge) — based on MAGI from 2 years prior ─────────
  // IRMAA tier depends on Y-2 MAGI; it's independent of this year's tax calc,
  // but it IS a cash outflow, so it must be added to `needed` below.
  const irmaa = (scenario.includeIRMAA && magiLookback != null && magiLookback >= 0)
    ? irmaaSurcharge(magiLookback, fs, year, scenario.inflationRate, age, spouseAge)
    : { tier: 0, tierLabel: scenario.includeIRMAA ? 'Pre-Medicare' : 'IRMAA off', partBAnnual: 0, partDAnnual: 0, totalAnnual: 0, payers: 0, magiUsed: magiLookback ?? 0 };

  let cashIn = wages + pension + ssGross + rmd;
  let needed = spendingNeeded + taxResult.totalTax + irmaa.totalAnnual - cashIn;

  // Discretionary withdrawals per scenario.withdrawalOrder
  const wd: WithdrawalBreakdown = { ...ZERO_WD };
  let shortfall = 0;

  if (needed > 0) {
    for (const acc of scenario.withdrawalOrder) {
      if (needed <= 0) break;
      // Gross up estimate based on marginal rate at this point
      let grossNeeded: number;
      if (acc === 'taxDeferred') {
        const mr = taxResult.marginalRate || 0.22;
        grossNeeded = needed / Math.max(0.01, 1 - mr);
      } else if (acc === 'taxable') {
        const basisFrac = workingBal.taxable > 0 ? workingBal.basis / workingBal.taxable : 1;
        const effCG = 0.15 * (1 - basisFrac); // approximate cap-gains rate on the gain portion
        grossNeeded = needed / Math.max(0.5, 1 - effCG);
      } else {
        grossNeeded = needed;
      }
      const { drawn, realized: rg, newBal } = drawFrom(acc, grossNeeded, workingBal);
      workingBal = newBal;
      wd[acc] += drawn;
      realized += rg;
      if (acc === 'taxDeferred') ordinary += drawn;
      // Recompute tax with updated income
      taxInputs = buildTaxInputs(scenario, ordinary, realized, state, age);
      taxResult = interpret(rules, taxInputs);
      cashIn = wages + pension + ssGross + rmd + wd.taxable + wd.taxDeferred + wd.taxFree;
      needed = spendingNeeded + taxResult.totalTax + irmaa.totalAnnual - cashIn;
    }
    if (needed > 0) shortfall = needed;
  }

  // Re-iterate SS taxable in case discretionary tax-deferred wd changed provisional income
  const newSSTaxable = taxableSSPortion(ssGross, wages + pension + rmd + wd.taxDeferred, 0, fs);
  if (Math.abs(newSSTaxable - ssTaxable) > 1) {
    ssTaxable = newSSTaxable;
    ordinary = wages + pension + ssTaxable + rmd + conversion + wd.taxDeferred;
    taxInputs = buildTaxInputs(scenario, ordinary, realized, state, age);
    taxResult = interpret(rules, taxInputs);
  }

  // ── Apply growth at year-end ──────────────────────────────────────────────
  const r = overrideReturns ?? {
    taxDeferred: scenario.returnTaxDeferred,
    taxFree: scenario.returnTaxFree,
    taxable: scenario.returnTaxable,
  };
  const close: AccountBalances = {
    taxDeferred: workingBal.taxDeferred * (1 + r.taxDeferred),
    taxFree: workingBal.taxFree * (1 + r.taxFree),
    taxable: workingBal.taxable * (1 + r.taxable),
    basis: workingBal.basis, // simplification: don't grow basis (reinvested gains become unrealized)
  };

  return {
    year,
    age,
    spouseAge,
    open,
    wages,
    pension,
    ssGross,
    ssTaxable,
    rmd,
    conversion,
    withdrawal: wd,
    realizedGains: realized,
    agi: taxResult.grossIncome, // proxy — interpreter doesn't return AGI separately
    magi: taxResult.magi,
    taxableIncome: taxResult.taxableIncome,
    federalTax: taxResult.federalTax + (taxResult.surtaxes['niit'] ?? 0),
    stateTax: taxResult.stateTax + taxResult.subJurisdictionTax,
    irmaaPartB: irmaa.partBAnnual,
    irmaaPartD: irmaa.partDAnnual,
    irmaaTier: irmaa.tier,
    irmaaTierLabel: irmaa.tierLabel,
    irmaaMagiUsed: irmaa.magiUsed,
    totalTax: taxResult.totalTax + irmaa.totalAnnual,
    marginalRate: taxResult.marginalRate,
    effectiveRate: taxResult.effectiveTotalRate,
    spendingNeeded,
    spendingShortfall: shortfall,
    close,
    inflationFactor,
  };
}
