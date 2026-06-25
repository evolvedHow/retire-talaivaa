import type { ScenarioInputs } from './scenario';
import type { YearState } from './yearState';

export interface SimulationPath {
  inputs: ScenarioInputs;
  years: YearState[];

  // Lifetime aggregates (nominal dollars)
  lifetimeFederalTax: number;
  lifetimeStateTax: number;
  lifetimeIRMAA: number;
  lifetimeTax: number;       // includes IRMAA
  lifetimeTaxNPV: number;    // discounted to today's $ at the scenario's discount rate
  totalConverted: number;
  totalRMD: number;

  // Endgame
  endingTaxDeferred: number;
  endingTaxFree: number;
  endingTaxable: number;
  endingTotalBalance: number;
  endingTotalBalanceReal: number; // terminal balance in today's $

  yearsUntilDepletion: number | null; // null if accounts never deplete
  largestSingleYearTax: number;
  largestSingleYearTaxAge: number;
}
