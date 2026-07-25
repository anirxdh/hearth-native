/**
 * Encrypted backup (P18): the canonical SQLCipher path, no extra crypto code.
 *
 * Export re-keys a full copy of the database to a caregiver-chosen passphrase
 * with sqlcipher_export, so the file that leaves the phone is encrypted with
 * something the caregiver knows, not with the device keychain key. Import
 * reverses it: verify the passphrase, then export the backup's contents into
 * a fresh live database keyed with this device's keychain key.
 *
 * This is also the escape hatch for the by-design key-loss case: a backup
 * plus its passphrase can rebuild the record on a new phone.
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { openDatabaseSync } from 'expo-sqlite';
import { bootDatabase, closeDb, getDbKeyHex, getRawDb, liveDbPath } from '../db/client';
import { logAccess } from '../db/repo';
import { bumpDataVersion } from './events';
import { today } from './clock';

const sq = (s: string) => s.replace(/'/g, "''");

export function validPassphrase(p: string): string | null {
  if (p.length < 8) return 'Use at least 8 characters.';
  return null;
}

/** Export the whole record as a passphrase-encrypted file and open the share sheet. */
export async function exportBackup(passphrase: string): Promise<void> {
  const err = validPassphrase(passphrase);
  if (err) throw new Error(err);
  logAccess('backup.export', null);

  const raw = getRawDb();
  const dest = `${FileSystem.cacheDirectory}RUA-backup-${today()}.ruabackup`;
  await FileSystem.deleteAsync(dest, { idempotent: true });

  raw.execSync('PRAGMA wal_checkpoint(TRUNCATE);');
  raw.execSync(`ATTACH DATABASE '${sq(dest.replace('file://', ''))}' AS backup KEY '${sq(passphrase)}';`);
  try {
    raw.execSync("SELECT sqlcipher_export('backup');");
  } finally {
    raw.execSync('DETACH DATABASE backup;');
  }
  try {
    await Sharing.shareAsync(dest, { mimeType: 'application/octet-stream' });
  } finally {
    await FileSystem.deleteAsync(dest, { idempotent: true });
  }
}

/**
 * Pick a .ruabackup file, verify the passphrase, and REPLACE the live
 * database with its contents. Destructive by definition; the settings UI
 * double-confirms before calling this.
 */
export async function importBackup(passphrase: string): Promise<'canceled' | 'done'> {
  const err = validPassphrase(passphrase);
  if (err) throw new Error(err);

  const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  const asset = picked.assets?.[0];
  if (picked.canceled || !asset) return 'canceled';

  // Stage the backup inside the SQLite directory so expo-sqlite can open it.
  const sqliteDir = `${FileSystem.documentDirectory}SQLite`;
  const stagedName = 'import-staging.db';
  const stagedPath = `${sqliteDir}/${stagedName}`;
  await FileSystem.deleteAsync(stagedPath, { idempotent: true });
  await FileSystem.copyAsync({ from: asset.uri, to: stagedPath });

  const keyHex = await getDbKeyHex();
  if (!keyHex) throw new Error('This phone has no database key; open the app once, then retry.');

  const conn = openDatabaseSync(stagedName);
  try {
    conn.execSync(`PRAGMA key = '${sq(passphrase)}';`);
    // Wrong passphrase surfaces here as "file is not a database".
    conn.getFirstSync('SELECT count(*) AS n FROM sqlite_master;');

    logAccess('backup.import', null);
    closeDb();
    const livePath = liveDbPath().replace('file://', '');
    await FileSystem.deleteAsync(liveDbPath(), { idempotent: true });
    await FileSystem.deleteAsync(`${liveDbPath()}-wal`, { idempotent: true });
    await FileSystem.deleteAsync(`${liveDbPath()}-shm`, { idempotent: true });

    conn.execSync(`ATTACH DATABASE '${sq(livePath)}' AS live KEY "x'${keyHex}'";`);
    try {
      conn.execSync("SELECT sqlcipher_export('live');");
    } finally {
      conn.execSync('DETACH DATABASE live;');
    }
  } finally {
    conn.closeSync();
    await FileSystem.deleteAsync(stagedPath, { idempotent: true });
  }

  // Reopen and roll the imported data forward through any newer migrations.
  const state = await bootDatabase();
  if (state.kind !== 'ready') {
    throw new Error(`Import finished but the database did not reopen cleanly (${state.kind}).`);
  }
  bumpDataVersion();
  return 'done';
}
