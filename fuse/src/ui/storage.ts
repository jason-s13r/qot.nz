// Progress saved in localStorage: furthest day, best scores, and the sound setting.

const SAVE_KEY = 'fuse0xac.v1';

export interface Saved {
  /** Furthest campaign day unlocked. */
  reached?: number;
  /** Finished the week, which unlocks endless mode. */
  finished?: boolean;
  /** Best campaign score. */
  best?: number;
  /** Most packets handled in one endless run. */
  bestEndless?: number;
  muted?: boolean;
}

export function load(): Saved {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null') || {};
  } catch {
    return {};
  }
}

/** Merges `changes` into the saved progress. */
export function save(changes: Saved) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...load(), ...changes }));
  } catch {
    // storage unavailable: progress lasts until the tab closes
  }
}
