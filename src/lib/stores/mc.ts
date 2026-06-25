import { writable, get } from 'svelte/store';
import { defaultMCConfig, type MonteCarloConfig } from '../sim/returns';
import type { MonteCarloResult } from '../sim/monteCarlo';
import type {
  WorkerInput,
  WorkerOutput,
} from '../sim/monteCarlo.worker';
import { rulesStore } from './rules';
import { scenarioStore } from './scenario';

export const mcConfigStore = writable<MonteCarloConfig>(defaultMCConfig());
export const mcResultStore = writable<MonteCarloResult | null>(null);
export const mcRunningStore = writable<{ running: boolean; pct: number; error: string | null }>({
  running: false,
  pct: 0,
  error: null,
});

let activeWorker: Worker | null = null;

export function runMC(): void {
  const rules = get(rulesStore);
  const scenario = get(scenarioStore);
  const mcConfig = get(mcConfigStore);
  if (!rules) return;

  // Cancel any in-flight run
  if (activeWorker) {
    activeWorker.terminate();
    activeWorker = null;
  }

  mcRunningStore.set({ running: true, pct: 0, error: null });

  const worker = new Worker(
    new URL('../sim/monteCarlo.worker.ts', import.meta.url),
    { type: 'module' },
  );
  activeWorker = worker;

  worker.onmessage = (e: MessageEvent<WorkerOutput>) => {
    const msg = e.data;
    if (msg.type === 'progress') {
      mcRunningStore.update(s => ({ ...s, pct: msg.pct }));
    } else if (msg.type === 'done') {
      mcResultStore.set(msg.result);
      mcRunningStore.set({ running: false, pct: 1, error: null });
      worker.terminate();
      if (activeWorker === worker) activeWorker = null;
    } else if (msg.type === 'error') {
      mcRunningStore.set({ running: false, pct: 0, error: msg.message });
      worker.terminate();
      if (activeWorker === worker) activeWorker = null;
    }
  };

  worker.onerror = (e) => {
    mcRunningStore.set({ running: false, pct: 0, error: e.message ?? 'Worker error' });
    if (activeWorker === worker) activeWorker = null;
  };

  const input: WorkerInput = { scenario, rules, mcConfig };
  worker.postMessage(input);
}

export function cancelMC(): void {
  if (activeWorker) {
    activeWorker.terminate();
    activeWorker = null;
  }
  mcRunningStore.set({ running: false, pct: 0, error: null });
}
