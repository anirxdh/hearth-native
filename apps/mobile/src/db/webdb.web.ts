/**
 * WEB TEST SURFACE ONLY. sql.js (pure-wasm SQLite) runs synchronously on the
 * main thread, so drizzle and the entire repo layer work unchanged - which is
 * the whole point: Playwright exercises the same queries the iPhone runs.
 * In-memory per tab, unencrypted, never for real PHI; every E2E spec seeds
 * its own data. The iOS product path (SQLCipher + Keychain) is db/client.ts.
 */
import initSqlJs, { type Database } from 'sql.js';
import { drizzle } from 'drizzle-orm/sql-js';
import * as schema from '@rua/schema';
import { migrationBundle } from '@rua/schema';
import type { RuaDb } from './client';
import type { WebRaw } from './webdb';

export async function openWebDb(): Promise<{ db: RuaDb; raw: WebRaw }> {
  const SQL = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' });
  const sqlite: Database = new SQL.Database();
  sqlite.exec('PRAGMA foreign_keys = ON;');

  const db = drizzle(sqlite, { schema });
  // Fresh in-memory DB per load: apply every bundled migration in journal
  // order (drizzle's sql-js migrator wants a filesystem folder; the expo
  // bundle format is { journal, migrations } keyed by tag).
  const bundle = migrationBundle as unknown as {
    journal: { entries: { idx: number; tag: string }[] };
    migrations: Record<string, string>;
  };
  for (const entry of bundle.journal.entries) {
    // the generated bundle keys migrations m0000, m0001... by journal idx
    const sql = bundle.migrations[`m${String(entry.idx).padStart(4, '0')}`];
    if (!sql) throw new Error(`missing bundled migration ${entry.tag}`);
    for (const stmt of sql.split('--> statement-breakpoint')) {
      const trimmed = stmt.trim();
      if (trimmed) sqlite.exec(trimmed);
    }
  }

  const raw: WebRaw = {
    execSync: (q) => {
      sqlite.exec(q);
    },
    getAllSync: <T,>(q: string): T[] => {
      const res = sqlite.exec(q);
      if (res.length === 0) return [];
      const { columns, values } = res[0]!;
      return values.map(
        (row) => Object.fromEntries(row.map((v, i) => [columns[i]!, v])) as T,
      );
    },
    closeSync: () => {
      sqlite.close();
    },
  };

  // Structurally identical query surface; the driver difference is deliberate.
  return { db: db as unknown as RuaDb, raw };
}
