import type { AccountType } from './scenario';

export interface AccountBalances {
  taxDeferred: number;
  taxFree: number;
  taxable: number;
  basis: number; // cost basis tracked on the taxable account
}

export interface WithdrawalBreakdown {
  taxDeferred: number;
  taxFree: number;
  taxable: number;
}

export interface YearState {
  year: number;
  age: number;
  spouseAge: number | null;

  open: AccountBalances; // start-of-year

  // Inflows (all in nominal dollars for that year)
  wages: number;
  pension: number;
  ssGross: number;
  ssTaxable: number;
  rmd: number;
  conversion: number;
  withdrawal: WithdrawalBreakdown;
  realizedGains: number;

  // Tax math (one interpret() call per year)
  agi: number;
  magi: number;
  taxableIncome: number;
  federalTax: number;
  stateTax: number;
  irmaaPartB: number;     // household annual Part B IRMAA surcharge
  irmaaPartD: number;     // household annual Part D IRMAA surcharge
  irmaaTier: number;      // 0..5; 0 = no surcharge or pre-Medicare
  irmaaTierLabel: string; // 'No IRMAA' | 'Tier 1' | ... | 'Pre-Medicare'
  irmaaMagiUsed: number;  // MAGI value used to determine tier (Y-2 in real Medicare)
  totalTax: number;       // federal + state + capital gains + IRMAA (everything you pay)
  marginalRate: number;
  effectiveRate: number;

  // Cash flow
  spendingNeeded: number;     // inflated annualSpending for this year
  spendingShortfall: number;  // > 0 if balances + income < spending after tax

  // Closing (after growth)
  close: AccountBalances;

  // Inflation factor from year 0 (today) — for real-dollar display
  inflationFactor: number;
}

export type { AccountType };
