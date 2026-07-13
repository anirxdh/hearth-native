/**
 * Shared test harness: opens a better-sqlite3 database and applies the
 * generated SQL migration files in journal order, the same statements the
 * app replays through drizzle-orm/expo-sqlite/migrator.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import * as schema from '../../schema';

export const MIGRATIONS_DIR = join(__dirname, '..', '..', '..', 'migrations');

export interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
  breakpoints: boolean;
}

export function readJournal(): { entries: JournalEntry[] } {
  return JSON.parse(readFileSync(join(MIGRATIONS_DIR, 'meta', '_journal.json'), 'utf8'));
}

export function readMigrationSql(tag: string): string {
  return readFileSync(join(MIGRATIONS_DIR, `${tag}.sql`), 'utf8');
}

/** Apply every migration file in journal order via raw exec. */
export function applyMigrations(sqlite: Database.Database): void {
  const { entries } = readJournal();
  const ordered = [...entries].sort((a, b) => a.idx - b.idx);
  for (const entry of ordered) {
    for (const statement of readMigrationSql(entry.tag).split('--> statement-breakpoint')) {
      sqlite.exec(statement);
    }
  }
}

export function openMigratedDb(filename = ':memory:') {
  const sqlite = new Database(filename);
  sqlite.pragma('foreign_keys = ON');
  applyMigrations(sqlite);
  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}
