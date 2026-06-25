import { writable } from 'svelte/store';
import jsYaml from 'js-yaml';
import type { TaxRules } from '../tax-core/types/taxRules';

export const rulesStore = writable<TaxRules | null>(null);
export const rulesError = writable<string | null>(null);

export async function loadRules(yamlPath = 'tax-configs/tax-2025.yml'): Promise<void> {
  try {
    const base = import.meta.env.BASE_URL ?? '/';
    const url = (base.endsWith('/') ? base : base + '/') + yamlPath;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    const text = await res.text();
    const parsed = jsYaml.load(text) as TaxRules;
    rulesStore.set(parsed);
    rulesError.set(null);
  } catch (e) {
    rulesError.set(e instanceof Error ? e.message : String(e));
  }
}
