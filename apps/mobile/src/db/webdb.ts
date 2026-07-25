/**
 * Native placeholder: the web database only exists on the web test surface.
 * Metro resolves webdb.web.ts on web; this file keeps native bundles clean.
 */
import type { RuaDb } from './client';

export type WebRaw = {
  execSync(sql: string): void;
  getAllSync<T>(sql: string): T[];
  closeSync(): void;
};

export async function openWebDb(): Promise<{ db: RuaDb; raw: WebRaw }> {
  throw new Error('openWebDb is only available on web');
}
