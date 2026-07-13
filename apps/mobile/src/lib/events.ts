/**
 * Minimal data-change signal. Every repo write appends to the change log,
 * and logChange() bumps this version; screens subscribe via
 * useSyncExternalStore and re-read from SQLite. The DB row stays the single
 * source of truth - nothing is mirrored into JS state.
 */
type Listener = () => void;

let version = 0;
const listeners = new Set<Listener>();

export function bumpDataVersion(): void {
  version++;
  for (const l of listeners) l();
}

export function subscribeData(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function dataVersion(): number {
  return version;
}
