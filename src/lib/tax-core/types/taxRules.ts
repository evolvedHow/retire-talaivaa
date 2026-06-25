// ─── Filing Statuses ─────────────────────────────────────────────────────────

export type FilingStatus = 'single' | 'married_filing_jointly' | 'head_of_household' | 'married_filing_separately';

// ─── Shared Primitives ────────────────────────────────────────────────────────

export interface Bracket {
  floor: number;
  ceiling: number | null;
  rate: number;
}

export interface PhaseOut {
  threshold: number;
  rate: number;
}

export interface PhaseOutRange {
  floor: number;
  ceiling: number;
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

export interface TaxMeta {
  tax_year: number;
  label: string;
  description: string;
  last_updated: string;
}

// ─── Federal ──────────────────────────────────────────────────────────────────

export type ByFilingStatus<T> = Partial<Record<FilingStatus, T>>;

export interface SeniorBonus {
  amount: number;
  phase_out_threshold: number;
  phase_out_rate: number;
}

export interface SaltRules {
  cap: ByFilingStatus<number>;
  phase_out: ByFilingStatus<PhaseOut>;
}

export interface MortgageInterestRules {
  cap: number | null;
}

export interface CharityRules {
  cap_pct_agi: number | null;
}

export interface ItemizedDeductions {
  salt: SaltRules;
  mortgage_interest: MortgageInterestRules;
  charity: CharityRules;
}

export interface IraRules {
  limit: number;
  limit_50_plus: number;
  phase_out: ByFilingStatus<PhaseOutRange>;
}

export interface ChildTaxCreditPhaseOut {
  threshold: number;
  rate_per_1000: number;
}

export interface ChildTaxCreditRules {
  amount_per_child: number;
  phase_out: ByFilingStatus<ChildTaxCreditPhaseOut>;
}

export interface NiitRules {
  rate: number;
  threshold: ByFilingStatus<number>;
  base: string; // 'lesser_of_net_investment_income_or_magi_excess'
}

export interface AmtWarning {
  trigger_if_any_present: string[];
}

export interface FederalRules {
  standard_deduction: ByFilingStatus<number>;
  senior_bonus: ByFilingStatus<SeniorBonus>;
  brackets: ByFilingStatus<Bracket[]>;
  itemized_deductions: ItemizedDeductions;
  ira: IraRules;
  capital_gains: ByFilingStatus<Bracket[]>;
  credits: {
    child_tax_credit: ChildTaxCreditRules;
  };
  surtaxes: {
    niit: NiitRules;
  };
  warnings: {
    amt: AmtWarning;
  };
}

// ─── Levers ───────────────────────────────────────────────────────────────────

export type LeverType = 'slider' | 'integer' | 'toggle' | 'dropdown';

export interface Lever {
  id: string;
  label: string;
  type: LeverType;
  min?: number;
  max?: number;
  step?: number;
  default: number | string | boolean;
  options?: string[];
  help?: string;
}

// ─── States ───────────────────────────────────────────────────────────────────

export interface SubJurisdiction {
  trigger_lever?: string;
  brackets: ByFilingStatus<Bracket[]>;
}

export interface StateRules {
  brackets?: ByFilingStatus<Bracket[]>;
  flat_rate?: number;
  note?: string;
  sub_jurisdictions?: Record<string, SubJurisdiction>;
}

// ─── Root TaxRules ────────────────────────────────────────────────────────────

export interface TaxRules {
  meta: TaxMeta;
  federal: FederalRules;
  levers: Lever[];
  states: Record<string, StateRules>;
}

// ─── Scenario Inputs ──────────────────────────────────────────────────────────

export type ScenarioInputs = Record<string, number | string | boolean>;

// ─── Tax Result ───────────────────────────────────────────────────────────────

export interface BracketBreakdown {
  bracket: string;
  rate: number;
  income: number;
  tax: number;
}

export interface DeductionBreakdown {
  salt?: number;
  salt_cap_applied?: number;
  mortgage_interest?: number;
  charity?: number;
  ira?: number;
  total_itemized: number;
}

export interface TaxResult {
  grossIncome: number;
  magi: number;
  taxableIncome: number;
  deductionType: 'standard' | 'itemized';
  deductionAmount: number;
  standardDeduction: number;
  deductionBreakdown: DeductionBreakdown;
  federalTax: number;
  federalBracketBreakdown: BracketBreakdown[];
  capitalGainsTax: number;
  capitalGainsBracketBreakdown: BracketBreakdown[];
  credits: Record<string, number>;
  surtaxes: Record<string, number>;
  warnings: string[];
  stateTax: number;
  subJurisdictionTax: number;
  totalTax: number;
  effectiveFederalRate: number;
  effectiveTotalRate: number;
  marginalRate: number;
  seTax: number;        // self-employment tax on business income (not in totalTax)
  // Withholding vs. liability
  federalWithheld: number;
  stateWithheld: number;
  federalOwed: number;  // positive = you owe, negative = refund
  stateOwed: number;
}
