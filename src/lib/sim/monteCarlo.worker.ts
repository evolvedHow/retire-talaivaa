import type { TaxRules } from '../tax-core/types/taxRules';
import type { ScenarioInputs } from '../types/scenario';
import { runMonteCarlo, type MonteCarloResult } from './monteCarlo';
import type { MonteCarloConfig } from './returns';

export type WorkerInput = {
  scenario: ScenarioInputs;
  rules: TaxRules;
  mcConfig: MonteCarloConfig;
  startYear?: number;
};

export type WorkerProgress = { type: 'progress'; pct: number };
export type WorkerDone = { type: 'done'; result: MonteCarloResult };
export type WorkerError = { type: 'error'; message: string };
export type WorkerOutput = WorkerProgress | WorkerDone | WorkerError;

self.onmessage = (e: MessageEvent<WorkerInput>) => {
  try {
    const { scenario, rules, mcConfig, startYear } = e.data;
    let lastPosted = -1;
    const result = runMonteCarlo(
      scenario,
      rules,
      mcConfig,
      (pct) => {
        // Throttle progress messages — once per 5% bucket
        const bucket = Math.floor(pct * 20);
        if (bucket !== lastPosted) {
          lastPosted = bucket;
          (self as unknown as Worker).postMessage({ type: 'progress', pct } satisfies WorkerProgress);
        }
      },
      startYear,
    );
    (self as unknown as Worker).postMessage({ type: 'done', result } satisfies WorkerDone);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    (self as unknown as Worker).postMessage({ type: 'error', message } satisfies WorkerError);
  }
};
