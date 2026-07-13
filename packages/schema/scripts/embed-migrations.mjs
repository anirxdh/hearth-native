/**
 * Regenerates src/migrations.ts from the drizzle-kit output in migrations/.
 *
 * Metro cannot import .sql files (or JSON outside the app tree), so the
 * journal and every migration's SQL are inlined into a TypeScript module in
 * the exact shape drizzle-orm/expo-sqlite/migrator expects. Run via
 * "pnpm generate", which chains drizzle-kit generate and this script.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = join(pkgRoot, 'migrations');
const outFile = join(pkgRoot, 'src', 'migrations.ts');

const journal = JSON.parse(readFileSync(join(migrationsDir, 'meta', '_journal.json'), 'utf8'));

if (!Array.isArray(journal.entries) || journal.entries.length === 0) {
  throw new Error('No entries in migrations/meta/_journal.json; run drizzle-kit generate first');
}

const migrationConsts = [];
const migrationKeys = [];
for (const entry of journal.entries) {
  const key = `m${String(entry.idx).padStart(4, '0')}`;
  const sql = readFileSync(join(migrationsDir, `${entry.tag}.sql`), 'utf8');
  migrationConsts.push(`const ${key} = ${JSON.stringify(sql)};`);
  migrationKeys.push(key);
}

const src = `/**
 * GENERATED FILE. Do not edit by hand.
 *
 * Embedded copy of the drizzle migrations under packages/schema/migrations,
 * in the shape drizzle-orm/expo-sqlite/migrator expects ({ journal,
 * migrations }). Metro cannot import .sql files, so the SQL is inlined here.
 *
 * Whenever src/schema.ts changes, run "pnpm generate" in packages/schema to
 * regenerate both the migration files and this module. A test asserts this
 * module matches the files on disk, so a stale copy fails CI.
 */

export const journal = ${JSON.stringify(journal, null, 2)};

${migrationConsts.join('\n\n')}

export const migrations: Record<string, string> = {
${migrationKeys.map((k) => `  ${k},`).join('\n')}
};

export default { journal, migrations };
`;

writeFileSync(outFile, src);
console.log(`Embedded ${migrationKeys.length} migration(s) into src/migrations.ts`);
