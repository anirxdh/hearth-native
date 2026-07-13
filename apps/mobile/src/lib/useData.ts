import { useSyncExternalStore, useMemo } from 'react';
import { dataVersion, subscribeData } from './events';

/** Re-runs `read` against SQLite whenever any repo write lands. */
export function useData<T>(read: () => T): T {
  const v = useSyncExternalStore(subscribeData, dataVersion, dataVersion);
  return useMemo(read, [v]); // eslint-disable-line react-hooks/exhaustive-deps
}
