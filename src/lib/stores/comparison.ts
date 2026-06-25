import { derived } from 'svelte/store';
import { rulesStore } from './rules';
import { scenarioStore } from './scenario';
import { compare, type ComparisonResult } from '../sim/compare';

// The headline view: with-strategy vs no-conversion baseline.
export const comparisonStore = derived(
  [rulesStore, scenarioStore],
  ([$rules, $scenario]): ComparisonResult | null => {
    if (!$rules) return null;
    try {
      return compare($scenario, $rules);
    } catch (e) {
      console.error('compare() failed:', e);
      return null;
    }
  },
);
