import { derived, writable } from 'svelte/store';
import { rulesStore } from './rules';
import { scenarioStore } from './scenario';
import { simulatePath } from '../sim/simulatePath';
import type { SimulationPath } from '../types/path';

export const pathStore = derived(
  [rulesStore, scenarioStore],
  ([$rules, $scenario]): SimulationPath | null => {
    if (!$rules) return null;
    try {
      return simulatePath($scenario, $rules);
    } catch (e) {
      console.error('simulatePath failed:', e);
      return null;
    }
  },
);

export const displayModeStore = writable<'real' | 'nominal'>('real');
