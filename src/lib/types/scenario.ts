import type { FilingStatus } from '../tax-core/types/taxRules';

export type AccountType = 'taxDeferred' | 'taxFree' | 'taxable';

export type ConversionStrategy =
  | { mode: 'none' }
  | {
      mode: 'fill-bracket';
      targetMarginalRate: number; // e.g. 0.12, 0.22, 0.24
      startAge: number;
      endAge: number;
      // Dollar cap on the auto-fill amount per year. 0 = no cap
      // (fill all the way to the bracket top). Otherwise the converted
      // amount is min(bracketFill, annualCap).
      annualCap: number;
    }
  | {
      mode: 'fixed-annual';
      amount: number;          // base amount per year (the "overall lever")
      startAge: number;
      endAge: number;
      // Per-year override: age -> exact dollar amount for that year.
      // Missing ages use the base `amount`. Use this to bump specific
      // years up or down without changing the base.
      perAgeOverride?: Record<number, number>;
    }
  | {
      mode: 'custom';
      perAge: Record<number, number>; // age -> dollar conversion that year
    };

export type TaxLawMode = 'freeze-current' | 'tcja-sunset';

export interface ScenarioInputs {
  // Household
  currentAge: number;
  spouseAge: number;  // 0 = no spouse
  filingStatus: FilingStatus;
  currentState: string;       // for today's tax (working years)
  retirementState: string;    // post-retire-age tax state

  // Today's snapshot — current calendar year inputs
  currentWages: number;       // wage income while working
  taxDeferred: number;        // Trad IRA + 401k pre-tax balance
  taxFree: number;            // Roth balance
  taxable: number;            // brokerage balance
  taxableBasis: number;       // cost basis in taxable (FIFO realized gains)

  // Income events
  retireAge: number;          // wages stop after this age
  ssMonthlyAtFRA: number;     // primary's monthly SS at full retirement age
  ssClaimAge: number;         // when primary claims (62–70)
  spouseSSMonthlyAtFRA: number;
  spouseSSClaimAge: number;
  pensionAnnual: number;
  pensionStartAge: number;

  // Spending plan (today's dollars)
  annualSpending: number;
  inflationRate: number;      // e.g. 0.025
  ssCOLA: number;             // e.g. 0.025 — defaults to inflationRate in UI

  // Expected per-account returns (Phase 1 = deterministic constants)
  returnTaxDeferred: number;
  returnTaxFree: number;
  returnTaxable: number;

  // Discretionary withdrawal ordering when cash needed
  withdrawalOrder: AccountType[]; // default ['taxable','taxDeferred','taxFree']

  // Roth conversion strategy
  strategy: ConversionStrategy;

  // Simulation horizon
  planUntilAge: number;       // e.g. 95

  // Tax law projection mode
  taxLawMode: TaxLawMode;

  // IRMAA modeling toggle (Medicare Part B + D surcharges, age 65+, Y-2 MAGI lookback)
  includeIRMAA: boolean;

  // Discount rate for lifetime-tax NPV (real, today's $)
  discountRate: number;       // e.g. 0.03
}

export function defaultScenario(): ScenarioInputs {
  return {
    currentAge: 55,
    spouseAge: 53,
    filingStatus: 'married_filing_jointly',
    currentState: 'GA',
    retirementState: 'GA',

    currentWages: 180000,
    taxDeferred: 800000,
    taxFree: 100000,
    taxable: 200000,
    taxableBasis: 150000,

    retireAge: 65,
    ssMonthlyAtFRA: 3200,
    ssClaimAge: 67,
    spouseSSMonthlyAtFRA: 2200,
    spouseSSClaimAge: 67,
    pensionAnnual: 0,
    pensionStartAge: 65,

    annualSpending: 90000,
    inflationRate: 0.025,
    ssCOLA: 0.025,

    returnTaxDeferred: 0.06,
    returnTaxFree: 0.07,
    returnTaxable: 0.06,

    withdrawalOrder: ['taxable', 'taxDeferred', 'taxFree'],

    strategy: { mode: 'fill-bracket', targetMarginalRate: 0.24, startAge: 65, endAge: 72, annualCap: 0 },

    planUntilAge: 95,
    taxLawMode: 'freeze-current',
    includeIRMAA: true,
    discountRate: 0.03,
  };
}
