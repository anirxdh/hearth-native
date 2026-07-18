/**
 * App-level reboot. The root layout registers itself here so flows that
 * invalidate the live database handle (the settings "delete everything"
 * wipe) can unmount every screen and boot again cleanly. Without this,
 * screens still mounted under the navigator re-render against the closed
 * handle and throw "Database accessed before bootDatabase() completed".
 */
let handler: (() => void) | null = null;

export function onAppReboot(fn: () => void): () => void {
  handler = fn;
  return () => {
    if (handler === fn) handler = null;
  };
}

export function requestAppReboot(): void {
  handler?.();
}
