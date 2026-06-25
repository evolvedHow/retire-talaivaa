import { writable, get, derived } from 'svelte/store';
import { defaultScenario, type ScenarioInputs } from '../types/scenario';
import { scenarioStore } from './scenario';

const STORAGE_KEY = 'rta:profiles:v1';
const ACTIVE_KEY = 'rta:active-profile:v1';

export interface Profile {
  name: string;
  scenario: ScenarioInputs;
  createdAt: number;
  updatedAt: number;
}

interface ProfileStoreState {
  profiles: Record<string, Profile>; // keyed by name (case-sensitive)
  activeName: string | null;
}

function seededProfiles(): Record<string, Profile> {
  const now = Date.now();
  const base = defaultScenario();
  const profiles: Record<string, Profile> = {};

  profiles['Default'] = {
    name: 'Default',
    scenario: { ...base },
    createdAt: now, updatedAt: now,
  };

  profiles['Aggressive 24% fill'] = {
    name: 'Aggressive 24% fill',
    scenario: {
      ...base,
      strategy: { mode: 'fill-bracket', targetMarginalRate: 0.24, startAge: base.retireAge, endAge: 72 },
    },
    createdAt: now, updatedAt: now,
  };

  profiles['No conversion'] = {
    name: 'No conversion',
    scenario: { ...base, strategy: { mode: 'none' } },
    createdAt: now, updatedAt: now,
  };

  return profiles;
}

function loadFromStorage(): ProfileStoreState {
  if (typeof localStorage === 'undefined') {
    return { profiles: seededProfiles(), activeName: 'Default' };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const active = localStorage.getItem(ACTIVE_KEY);
    if (!raw) {
      const seeded = seededProfiles();
      saveToStorage({ profiles: seeded, activeName: 'Default' });
      return { profiles: seeded, activeName: 'Default' };
    }
    const profiles = JSON.parse(raw) as Record<string, Profile>;
    return { profiles, activeName: active };
  } catch {
    return { profiles: seededProfiles(), activeName: 'Default' };
  }
}

function saveToStorage(state: ProfileStoreState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.profiles));
    if (state.activeName) localStorage.setItem(ACTIVE_KEY, state.activeName);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch (e) {
    console.error('profiles: localStorage write failed', e);
  }
}

const initial = loadFromStorage();
export const profilesStore = writable<ProfileStoreState>(initial);
profilesStore.subscribe(saveToStorage);

// On boot, load the active profile's scenario into scenarioStore.
if (initial.activeName && initial.profiles[initial.activeName]) {
  scenarioStore.set(initial.profiles[initial.activeName].scenario);
}

// "Dirty" = current scenarioStore diverges from the saved active profile.
function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export const dirtyStore = derived(
  [profilesStore, scenarioStore],
  ([$p, $s]) => {
    if (!$p.activeName) return true;
    const saved = $p.profiles[$p.activeName];
    if (!saved) return true;
    return !deepEqual(saved.scenario, $s);
  },
);

export function loadProfile(name: string): void {
  const state = get(profilesStore);
  const p = state.profiles[name];
  if (!p) return;
  scenarioStore.set({ ...p.scenario });
  profilesStore.update(s => ({ ...s, activeName: name }));
}

export function saveActive(): void {
  const state = get(profilesStore);
  if (!state.activeName) return;
  const scenario = get(scenarioStore);
  profilesStore.update(s => {
    const prev = s.profiles[s.activeName!];
    const updated: Profile = {
      name: s.activeName!,
      scenario: { ...scenario },
      createdAt: prev?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };
    return { ...s, profiles: { ...s.profiles, [s.activeName!]: updated } };
  });
}

export function saveAs(name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  const scenario = get(scenarioStore);
  const now = Date.now();
  profilesStore.update(s => ({
    ...s,
    activeName: trimmed,
    profiles: {
      ...s.profiles,
      [trimmed]: { name: trimmed, scenario: { ...scenario }, createdAt: now, updatedAt: now },
    },
  }));
}

export function deleteProfile(name: string): void {
  profilesStore.update(s => {
    const next = { ...s.profiles };
    delete next[name];
    const remaining = Object.keys(next);
    const newActive = s.activeName === name
      ? (remaining[0] ?? null)
      : s.activeName;
    if (newActive && next[newActive]) {
      scenarioStore.set({ ...next[newActive].scenario });
    }
    return { ...s, profiles: next, activeName: newActive };
  });
}

export function exportProfilesJSON(): string {
  const state = get(profilesStore);
  return JSON.stringify({ version: 1, profiles: state.profiles }, null, 2);
}

export function importProfilesJSON(json: string, mode: 'merge' | 'replace' = 'merge'): { added: number; replaced: number; error?: string } {
  try {
    const parsed = JSON.parse(json) as { version?: number; profiles: Record<string, Profile> };
    if (!parsed.profiles || typeof parsed.profiles !== 'object') {
      return { added: 0, replaced: 0, error: 'Invalid JSON: missing profiles object' };
    }
    let added = 0, replaced = 0;
    profilesStore.update(s => {
      const next: Record<string, Profile> = mode === 'replace' ? {} : { ...s.profiles };
      for (const [name, p] of Object.entries(parsed.profiles)) {
        if (next[name]) replaced++; else added++;
        next[name] = p;
      }
      const activeName = s.activeName && next[s.activeName] ? s.activeName : Object.keys(next)[0] ?? null;
      return { ...s, profiles: next, activeName };
    });
    return { added, replaced };
  } catch (e) {
    return { added: 0, replaced: 0, error: e instanceof Error ? e.message : String(e) };
  }
}
