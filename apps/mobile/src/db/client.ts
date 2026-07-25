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
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import * as schema from '@rua/schema';
import { migrationBundle } from '@rua/schema';

// Renamed in the RUA rebrand: existing installs get a fresh database under
// the new name; the simulator is the only install base.
const DB_NAME = 'rua.db';
const KEY_NAME = 'rua.db.key.v1';

export type BootState =
  | { kind: 'ready'; db: RuaDb }
  | { kind: 'key-without-db' } // keychain survived, file gone (restore/new device)
  | { kind: 'db-without-key' } // file present, key lost: data unrecoverable by design
  | { kind: 'migration-failed'; error: string }
  | { kind: 'boot-error'; error: string }; // unexpected failure (keychain, filesystem)

export type RuaDb = ReturnType<typeof drizzle<typeof schema>>;

type RawHandle = Pick<SQLiteDatabase, 'execSync' | 'getAllSync' | 'closeSync'>;
let cached: { db: RuaDb; raw: RawHandle } | null = null;

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

function openEncrypted(key: string): { db: RuaDb; raw: SQLiteDatabase } {
  const raw = openDatabaseSync(DB_NAME);
  // Must be the first statement against the connection.
  raw.execSync(`PRAGMA key = "x'${key}'";`);
  raw.execSync('PRAGMA journal_mode = WAL;');
  raw.execSync('PRAGMA foreign_keys = ON;');
  const db = drizzle(raw, { schema });
  return { db, raw };
}

/** Copy-protected migration: snapshot, migrate, restore snapshot on failure. */
async function migrateSafely(db: RuaDb, raw: SQLiteDatabase): Promise<void> {
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

/**
 * WEB IS A TEST SURFACE, NOT THE PRODUCT: the Playwright E2E suite runs the
 * app as an Expo web export on plain (unencrypted, browser-sandboxed)
 * SQLite. SQLCipher, the Keychain, and file-copy migration safety are
 * iOS-only; nothing PHI-real should ever be entered on web.
 */
async function bootWeb(): Promise<BootState> {
  try {
    // Platform-split module: webdb.web.ts (sql.js) on web, stub on native.
    // expo-sqlite's sync API cannot run on the web main thread (Atomics.wait
    // is banned there), so the web surface uses sql.js instead.
    const { openWebDb } = await import('./webdb');
    cached = await openWebDb();
    return { kind: 'ready', db: cached.db };
  } catch (e) {
    return { kind: 'migration-failed', error: e instanceof Error ? e.message : String(e) };
  }
}

export async function bootDatabase(): Promise<BootState> {
  if (cached) return { kind: 'ready', db: cached.db };
  if (Platform.OS === 'web') return bootWeb();

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

export function getDb(): RuaDb {
  if (!cached) throw new Error('Database accessed before bootDatabase() completed');
  return cached.db;
}

/** Raw SQLCipher handle for maintenance paths (backup export/import). */
export function getRawDb(): RawHandle {
  if (!cached) throw new Error('Database accessed before bootDatabase() completed');
  return cached.raw;
}

/** Absolute path of the live database file. */
export function liveDbPath(): string {
  return dbPath();
}

/** Hex key from the keychain; null if missing. Maintenance paths only. */
export async function getDbKeyHex(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_NAME);
}

/** Close the live connection (before an import replaces the file). */
export function closeDb(): void {
  if (cached) {
    cached.raw.closeSync();
    cached = null;
  }
}

/** Full local wipe: DB file + key + document vault. The P19 "delete everything" path. */
export async function destroyAllData(): Promise<void> {
  if (Platform.OS === 'web') {
    // web test surface: delete every row, keep the connection
    if (cached) {
      const raw = cached.raw;
      const tables = raw.getAllSync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%'",
      );
      for (const t of tables) raw.execSync(`DELETE FROM "${t.name}";`);
    }
    return;
  }
  if (cached) {
    cached.raw.closeSync();
    cached = null;
  }
  await FileSystem.deleteAsync(dbPath(), { idempotent: true });
  await FileSystem.deleteAsync(`${dbPath()}-wal`, { idempotent: true });
  await FileSystem.deleteAsync(`${dbPath()}-shm`, { idempotent: true });
  await FileSystem.deleteAsync(`${FileSystem.documentDirectory}vault`, { idempotent: true });
  await SecureStore.deleteItemAsync(KEY_NAME);
}
