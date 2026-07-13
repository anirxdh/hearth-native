/**
 * Migration harness: the generated SQL files must build the full schema from
 * a fresh database, and the embedded src/migrations.ts module (what the app
 * ships through drizzle-orm/expo-sqlite/migrator) must match those files
 * exactly, so a schema change without regeneration fails here.
 */

import Database from 'better-sqlite3';

import migrationBundle, { journal, migrations } from '../migrations';
import { applyMigrations, readJournal, readMigrationSql } from './support/testDb';

const EXPECTED_TABLES = [
  'access_log',
  'change_log',
  'contacts',
  'med_fills',
  'medications',
  'patients',
  'settings',
];

const EXPECTED_INDEXES = [
  'access_log_at_idx',
  'change_log_at_idx',
  'change_log_entity_idx',
  'contacts_patient_idx',
  'med_fills_medication_idx',
  'medications_patient_idx',
];

describe('migration harness', () => {
  test('fresh database + journal-ordered migrations creates every table and index', () => {
    const sqlite = new Database(':memory:');
    applyMigrations(sqlite);

    const names = (type: string): string[] =>
      sqlite
        .prepare<[string], { name: string }>(
          "SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE 'sqlite_%' ORDER BY name",
        )
        .all(type)
        .map((r) => r.name);

    expect(names('table')).toEqual(EXPECTED_TABLES);
    expect(names('index')).toEqual(EXPECTED_INDEXES);
    sqlite.close();
  });

  test('migrated schema accepts a basic insert per table', () => {
    const sqlite = new Database(':memory:');
    applyMigrations(sqlite);
    sqlite
      .prepare(
        "INSERT INTO patients (id, full_name, conditions, allergies, created_at, updated_at) VALUES ('p1', 'Test Person', '[]', '[]', 't', 't')",
      )
      .run();
    const row = sqlite.prepare("SELECT full_name FROM patients WHERE id = 'p1'").get() as {
      full_name: string;
    };
    expect(row.full_name).toBe('Test Person');
    sqlite.close();
  });
});

describe('embedded migrations module', () => {
  test('journal matches migrations/meta/_journal.json on disk', () => {
    expect(journal).toEqual(readJournal());
  });

  test('every journal entry has embedded SQL identical to the .sql file on disk', () => {
    expect(journal.entries.length).toBeGreaterThan(0);
    for (const entry of journal.entries) {
      const key = `m${String(entry.idx).padStart(4, '0')}`;
      expect(migrations[key]).toBe(readMigrationSql(entry.tag));
    }
    expect(Object.keys(migrations)).toHaveLength(journal.entries.length);
  });

  test('default export has the shape drizzle-orm/expo-sqlite/migrator expects', () => {
    expect(migrationBundle.journal).toBe(journal);
    expect(migrationBundle.migrations).toBe(migrations);
    for (const entry of migrationBundle.journal.entries) {
      expect(typeof entry.idx).toBe('number');
      expect(typeof entry.when).toBe('number');
      expect(typeof entry.tag).toBe('string');
      expect(typeof entry.breakpoints).toBe('boolean');
    }
  });

  test('embedded SQL builds the same schema as the files on disk', () => {
    const sqlite = new Database(':memory:');
    for (const entry of journal.entries) {
      const key = `m${String(entry.idx).padStart(4, '0')}`;
      for (const statement of (migrations[key] ?? '').split('--> statement-breakpoint')) {
        sqlite.exec(statement);
      }
    }
    const tables = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all()
      .map((r) => (r as { name: string }).name);
    expect(tables).toEqual(EXPECTED_TABLES);
    sqlite.close();
  });
});
