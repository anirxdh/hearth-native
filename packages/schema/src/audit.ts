/**
 * Append-only audit helpers. logChange records consequential writes,
 * logAccess records sensitive reads. Both work against any drizzle SQLite
 * driver (expo-sqlite in the app, better-sqlite3 in tests).
 */

import { uuidv7 } from '@hearth/core';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import { accessLog, changeLog } from './schema';

/** Driver-agnostic drizzle SQLite database (expo-sqlite or better-sqlite3). */
export type HearthDatabase = BaseSQLiteDatabase<'sync' | 'async', unknown, Record<string, unknown>>;

type NewChangeLogRow = typeof changeLog.$inferInsert;
type NewAccessLogRow = typeof accessLog.$inferInsert;

/** id and at are generated when omitted; pass at explicitly for determinism. */
export type ChangeLogInput = Omit<NewChangeLogRow, 'id' | 'at'> & { id?: string; at?: string };
export type AccessLogInput = Omit<NewAccessLogRow, 'id' | 'at'> & { id?: string; at?: string };

export async function logChange(db: HearthDatabase, entry: ChangeLogInput): Promise<string> {
  const at = entry.at ?? new Date().toISOString();
  const id = entry.id ?? uuidv7(Date.parse(at));
  await db.insert(changeLog).values({ ...entry, id, at });
  return id;
}

export async function logAccess(db: HearthDatabase, entry: AccessLogInput): Promise<string> {
  const at = entry.at ?? new Date().toISOString();
  const id = entry.id ?? uuidv7(Date.parse(at));
  await db.insert(accessLog).values({ ...entry, id, at });
  return id;
}
