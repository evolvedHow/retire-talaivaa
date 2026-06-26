import { derived } from 'svelte/store';
import { rulesStore } from './rules';
import { scenarioStore } from './scenario';
import { sweepConversion, type SweepResult } from '../sim/sweep';

// Derived from rules + scenario. Re-runs whenever inputs change. The sweep
// is ~30 simulatePath calls (~150-400ms locally) — fast enough to be live.
export const sweepStore = derived(
  [rulesStore, scenarioStore],
  ([$rules, $scenario]): SweepResult | null => {
    if (!$rules) return null;
    try {
      return sweepConversion($scenario, $rules);
    } catch (e) {
      console.error('sweep failed:', e);
      return null;
    }
  },
);
