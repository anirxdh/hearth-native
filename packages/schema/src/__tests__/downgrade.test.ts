/**
 * Downgrade refusal: what happens when an OLDER app bundle opens a NEWER
 * database (e.g. a phone restored from a backup made by a future version,
 * or a TestFlight rollback after a migration shipped).
 *
 * Drizzle's sqlite migrator only ever applies bundled migrations whose
 * journal timestamp ("when"/folderMillis) is strictly newer than the newest
 * row in the __drizzle_migrations bookkeeping table. When the database is
 * ahead of the bundle, every bundled migration compares older, so the run
 * is a clean no-op: nothing is applied, nothing is dropped, no bookkeeping
 * row is touched. That is the safe behavior for a local-first medical
 * record (never destroy data the newer schema wrote), so this suite PINS
 * it. If a drizzle upgrade ever changes the comparison to delete or replay
 * migrations, these tests fail before the app ships it. The app-side
 * migrateSafely (apps/mobile/src/db/client.ts) additionally snapshots the
 * DB file and restores it if migrate() ever throws, so even a future
 * regression to "throw" surfaces as the recoverable 'migration-failed'
 * boot state rather than data loss.
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { MIGRATIONS_DIR } from './support/testDb';

/** Far-future journal timestamp, standing in for a migration this bundle does not know about. */
const FUTURE_MILLIS = 4102444800000; // 2100-01-01T00:00:00Z

function objectNames(sqlite: Database.Database, kind: 'table' | 'index'): string[] {
  return sqlite
    .prepare<[string], { name: string }>(
      "SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all(kind)
    .map((r) => r.name);
}

describe('migration harness refuses to downgrade a newer database', () => {
  test('a database ahead of the bundle is left untouched: no-op, nothing deleted', () => {
    const sqlite = new Database(':memory:');
    const db = drizzle(sqlite);

    // A device on the CURRENT bundle: all migrations applied and recorded.
    migrate(db, { migrationsFolder: MIGRATIONS_DIR });
    const appliedBefore = sqlite
      .prepare('SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at')
      .all() as { hash: string; created_at: number }[];
    expect(appliedBefore.length).toBeGreaterThan(0);

    // Real data written after migrating, which a destructive rerun would lose.
    sqlite
      .prepare(
        "INSERT INTO patients (id, full_name, conditions, allergies, created_at, updated_at) VALUES ('p1', 'Downgrade Canary', '[]', '[]', 't', 't')",
      )
      .run();

    // Simulate a FUTURE app version having migrated this database: one extra
    // bookkeeping row with a timestamp newer than anything in this bundle.
    sqlite
      .prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)')
      .run('hash-of-a-migration-this-bundle-does-not-have', FUTURE_MILLIS);

    const tablesBefore = objectNames(sqlite, 'table');
    const indexesBefore = objectNames(sqlite, 'index');

    // The OLDER bundle boots against the newer database. Pinned behavior:
    // it must not throw, and it must change nothing.
    expect(() => migrate(db, { migrationsFolder: MIGRATIONS_DIR })).not.toThrow();

    expect(objectNames(sqlite, 'table')).toEqual(tablesBefore);
    expect(objectNames(sqlite, 'index')).toEqual(indexesBefore);

    const appliedAfter = sqlite
      .prepare('SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at')
      .all() as { hash: string; created_at: number }[];
    // No bundled migration re-applied, the future row not deleted.
    expect(appliedAfter).toEqual([
      ...appliedBefore,
      { hash: 'hash-of-a-migration-this-bundle-does-not-have', created_at: FUTURE_MILLIS },
    ]);

    const canary = sqlite.prepare("SELECT full_name FROM patients WHERE id = 'p1'").get() as {
      full_name: string;
    };
    expect(canary.full_name).toBe('Downgrade Canary');
    sqlite.close();
  });

  test('rerunning the same bundle against an up-to-date database is also a no-op', () => {
    // The everyday boot path: same bundle, already-migrated database. Pinned
    // alongside the downgrade case so the "only strictly newer timestamps
    // apply" rule is covered from both sides.
    const sqlite = new Database(':memory:');
    const db = drizzle(sqlite);

    migrate(db, { migrationsFolder: MIGRATIONS_DIR });
    const appliedBefore = sqlite
      .prepare('SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at')
      .all();

    expect(() => migrate(db, { migrationsFolder: MIGRATIONS_DIR })).not.toThrow();

    const appliedAfter = sqlite
      .prepare('SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at')
      .all();
    expect(appliedAfter).toEqual(appliedBefore);
    sqlite.close();
  });
});
