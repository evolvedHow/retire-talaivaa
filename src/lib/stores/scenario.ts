import { writable } from 'svelte/store';
import { defaultScenario, type ScenarioInputs } from '../types/scenario';

export const scenarioStore = writable<ScenarioInputs>(defaultScenario());

export function resetScenario(): void {
  scenarioStore.set(defaultScenario());
}
