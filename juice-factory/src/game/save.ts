// Saving to and loading from localStorage.

import { migrate, normalize, type State, type StateV1 } from './state';

const SAVE_KEY = 'juice-factory-v2';
const OLD_KEY = 'juice-factory-v1';

function readKey<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export type Loaded = { state: State; migrated: boolean } | null;

/** The saved game, a converted v1 save (`migrated: true`), or null for a new player. */
export function load(): Loaded {
  const cur = readKey<Partial<State>>(SAVE_KEY);
  if (cur) return { state: normalize(cur), migrated: false };
  const old = readKey<StateV1>(OLD_KEY);
  if (old) return { state: migrate(old), migrated: true };
  return null;
}

/** Returns false if the browser blocked storage. */
export function save(s: State, now = Date.now()): boolean {
  s.last = now;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}
