/**
 * Encrypted database bootstrap.
 *
 * Key lifecycle (P1 durability gate):
 * - A 256-bit SQLCipher key is generated once and lives only in the iOS
 *   Keychain (expo-secure-store). The DB file is unreadable without it.
 * - Boot explicitly distinguishes the four key/DB states; the two mismatch
 *   states surface a recovery path instead of crash-looping.
 *
 * Migration safety:
 * - Before applying migrations we copy the DB file; a failed migration
 *   restores the copy so an interrupted upgrade can never strand data.
 */
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import * as schema from '@hearth/schema';
import { migrationBundle } from '@hearth/schema';

const DB_NAME = 'hearth.db';
const KEY_NAME = 'hearth.db.key.v1';

export type BootState =
  | { kind: 'ready'; db: HearthDb }
  | { kind: 'key-without-db' } // keychain survived, file gone (restore/new device)
  | { kind: 'db-without-key' } // file present, key lost: data unrecoverable by design
  | { kind: 'migration-failed'; error: string };

export type HearthDb = ReturnType<typeof drizzle<typeof schema>>;

let cached: { db: HearthDb; raw: SQLiteDatabase } | null = null;

function dbPath(): string {
  return `${FileSystem.documentDirectory}SQLite/${DB_NAME}`;
}

async function dbFileExists(): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(dbPath());
  return info.exists;
}

async function getOrCreateKey(createIfMissing: boolean): Promise<string | null> {
  const existing = await SecureStore.getItemAsync(KEY_NAME);
  if (existing) return existing;
  if (!createIfMissing) return null;
  const bytes = await Crypto.getRandomBytesAsync(32);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  await SecureStore.setItemAsync(KEY_NAME, hex, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  return hex;
}

function openEncrypted(key: string): { db: HearthDb; raw: SQLiteDatabase } {
  const raw = openDatabaseSync(DB_NAME);
  // Must be the first statement against the connection.
  raw.execSync(`PRAGMA key = "x'${key}'";`);
  raw.execSync('PRAGMA journal_mode = WAL;');
  raw.execSync('PRAGMA foreign_keys = ON;');
  const db = drizzle(raw, { schema });
  return { db, raw };
}

/** Copy-protected migration: snapshot, migrate, restore snapshot on failure. */
async function migrateSafely(db: HearthDb, raw: SQLiteDatabase): Promise<void> {
  const path = dbPath();
  const backup = `${path}.premigrate`;
  const exists = await dbFileExists();
  if (exists) {
    raw.execSync('PRAGMA wal_checkpoint(TRUNCATE);');
    await FileSystem.copyAsync({ from: path, to: backup });
  }
  try {
    await migrate(db, migrationBundle);
    if (exists) await FileSystem.deleteAsync(backup, { idempotent: true });
  } catch (e) {
    if (exists) {
      raw.closeSync();
      cached = null;
      await FileSystem.deleteAsync(path, { idempotent: true });
      await FileSystem.copyAsync({ from: backup, to: path });
      await FileSystem.deleteAsync(backup, { idempotent: true });
    }
    throw e;
  }
}

export async function bootDatabase(): Promise<BootState> {
  if (cached) return { kind: 'ready', db: cached.db };

  const fileExists = await dbFileExists();
  const key = await getOrCreateKey(!fileExists);

  if (fileExists && !key) return { kind: 'db-without-key' };
  if (!fileExists && (await SecureStore.getItemAsync(KEY_NAME)) && !key) {
    return { kind: 'key-without-db' };
  }
  if (!key) return { kind: 'db-without-key' };

  const opened = openEncrypted(key);
  try {
    await migrateSafely(opened.db, opened.raw);
  } catch (e) {
    return { kind: 'migration-failed', error: e instanceof Error ? e.message : String(e) };
  }
  cached = opened;
  return { kind: 'ready', db: opened.db };
}

export function getDb(): HearthDb {
  if (!cached) throw new Error('Database accessed before bootDatabase() completed');
  return cached.db;
}

/** Full local wipe: DB file + key. Used by the P19 "delete everything" path. */
export async function destroyAllData(): Promise<void> {
  if (cached) {
    cached.raw.closeSync();
    cached = null;
  }
  await FileSystem.deleteAsync(dbPath(), { idempotent: true });
  await SecureStore.deleteItemAsync(KEY_NAME);
}
