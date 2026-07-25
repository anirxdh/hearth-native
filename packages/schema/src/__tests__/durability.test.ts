/**
 * Migration safety: simulates the app's copy-restore flow around a schema
 * migration. The app copies the database file before migrating; a failing
 * migration wrapped in a transaction must roll back cleanly, and the backup
 * copy must remain a fully readable database either way.
 */

import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Database from 'better-sqlite3';

import { seedDemoFamily } from '../seed';
import { openMigratedDb } from './support/testDb';

const TODAY = '2026-07-12';

describe('migration safety (copy-restore)', () => {
  let dir: string;
  let dbPath: string;
  let backupPath: string;

  const counts = (sqlite: Database.Database) => ({
    patients: (sqlite.prepare('SELECT COUNT(*) AS n FROM patients').get() as { n: number }).n,
    fills: (sqlite.prepare('SELECT COUNT(*) AS n FROM med_fills').get() as { n: number }).n,
    changes: (sqlite.prepare('SELECT COUNT(*) AS n FROM change_log').get() as { n: number }).n,
  });

  let seededCounts: ReturnType<typeof counts>;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'rua-durability-'));
    dbPath = join(dir, 'rua.db');
    backupPath = join(dir, 'rua.backup.db');

    const { sqlite, db } = openMigratedDb(dbPath);
    await seedDemoFamily(db, TODAY);
    seededCounts = counts(sqlite);
    sqlite.close();

    copyFileSync(dbPath, backupPath);
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test('a failing migration in a transaction rolls back and leaves data intact', () => {
    const sqlite = new Database(dbPath);
    expect(counts(sqlite)).toEqual(seededCounts);

    const badMigration = sqlite.transaction(() => {
      sqlite.exec('ALTER TABLE patients ADD COLUMN demo_flag text');
      sqlite.exec("UPDATE patients SET demo_flag = 'x'");
      // Deliberate failure partway through the migration.
      sqlite.exec('INSERT INTO table_that_does_not_exist VALUES (1)');
    });

    expect(() => badMigration()).toThrow(/no such table/);

    // The transaction rolled back: no data lost, no half-applied DDL.
    expect(counts(sqlite)).toEqual(seededCounts);
    const columns = sqlite
      .prepare('PRAGMA table_info(patients)')
      .all()
      .map((c) => (c as { name: string }).name);
    expect(columns).not.toContain('demo_flag');
    sqlite.close();
  });

  test('the pre-migration backup copy is a complete, readable database', () => {
    const backup = new Database(backupPath, { readonly: true });
    expect(counts(backup)).toEqual(seededCounts);
    const robert = backup
      .prepare("SELECT allergies FROM patients WHERE full_name = 'Robert Alvarez'")
      .get() as { allergies: string };
    expect(JSON.parse(robert.allergies)).toEqual([
      { name: 'Penicillin', reaction: 'Anaphylaxis', severe: true },
    ]);
    backup.close();
  });

  test('restoring the backup over the live file recovers the seeded state', () => {
    // Simulate a wrecked live db after a failed migration attempt.
    const wrecked = new Database(dbPath);
    wrecked.exec('DELETE FROM med_fills');
    expect(counts(wrecked).fills).toBe(0);
    wrecked.close();

    copyFileSync(backupPath, dbPath);

    const restored = new Database(dbPath);
    expect(counts(restored)).toEqual(seededCounts);
    restored.close();
  });
});
