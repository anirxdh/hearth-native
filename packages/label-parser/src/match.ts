/**
 * Deterministic matcher from a raw OCR drug-name string to the bundled
 * RxNorm subset. Pure string work: lowercase, strip strength and form
 * tokens, then exact match, then small-edit-distance or prefix match.
 * No network, no randomness; ties resolve to the earliest subset entry.
 */

import { RXNORM_SUBSET, type RxEntry } from './rxnorm';

export interface RxMatch {
  entry: RxEntry;
  confidence: 'exact' | 'close';
}

/**
 * Tokens that carry no identity: dose units, dose forms, release
 * modifiers, salt suffixes, and route words. The first token of a string
 * is always kept, so single-salt names like "potassium chloride" still
 * normalize to a stable, matchable key.
 */
const STRIP_TOKENS = new Set<string>([
  // Dose units
  'mg', 'mcg', 'g', 'gm', 'kg', 'ml', 'l', 'meq', 'iu', 'unit', 'units',
  'hr', 'hour', 'actuation',
  // Dose forms
  'tablet', 'tablets', 'tab', 'tabs', 'capsule', 'capsules', 'cap', 'caps',
  'caplet', 'caplets', 'softgel', 'softgels', 'solution', 'suspension',
  'syrup', 'elixir', 'cream', 'ointment', 'gel', 'lotion', 'patch',
  'patches', 'inhaler', 'inhalation', 'nebulizer', 'spray', 'drop',
  'drops', 'injection', 'injectable', 'pen', 'vial', 'syringe', 'film',
  'lozenge', 'suppository', 'powder', 'packet',
  // Release modifiers
  'er', 'xr', 'xl', 'sr', 'cr', 'dr', 'ir', 'la', 'cd', 'odt', 'hfa',
  'extended', 'delayed', 'immediate', 'release', 'chewable', 'dispersible',
  'disintegrating',
  // Salt and ester suffixes
  'hcl', 'hbr', 'hydrochloride', 'hydrobromide', 'sodium', 'potassium',
  'calcium', 'magnesium', 'besylate', 'bitartrate', 'tartrate',
  'succinate', 'fumarate', 'hemifumarate', 'maleate', 'mesylate',
  'citrate', 'oxalate', 'sulfate', 'sulphate', 'acetate', 'chloride',
  'phosphate', 'nitrate', 'dihydrate', 'monohydrate', 'propionate',
  'furoate', 'valerate', 'tromethamine', 'napsylate', 'carbonate',
  'gluconate', 'lactate',
  // Route words
  'oral', 'orally', 'sublingual', 'buccal', 'topical', 'transdermal',
  'ophthalmic', 'otic', 'nasal', 'rectal', 'subcutaneous', 'eye', 'ear',
]);

/**
 * Lowercase, split on non-alphanumerics, drop tokens that start with a
 * digit (strengths, counts, NDC fragments), and drop strip tokens except
 * in first position. "METFORMIN HCL 500MG TABLETS" -> "metformin".
 */
export function normalizeDrugName(raw: string): string {
  const tokens = raw
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
  const kept: string[] = [];
  for (const t of tokens) {
    if (/^[0-9]/.test(t)) continue;
    if (kept.length > 0 && STRIP_TOKENS.has(t)) continue;
    kept.push(t);
  }
  return kept.join(' ');
}

/** Levenshtein distance, early-exit above `max`. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev: number[] = [];
  for (let j = 0; j <= b.length; j++) prev.push(j);
  let curr = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(
        (prev[j] as number) + 1,
        (curr[j - 1] as number) + 1,
        (prev[j - 1] as number) + cost,
      );
      curr[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[b.length] as number;
}

/** Normalized keys an entry can be matched against, deduplicated. */
function keysOf(entry: RxEntry): string[] {
  const name = normalizeDrugName(entry.name);
  const ingredient = normalizeDrugName(entry.ingredient);
  return name === ingredient ? [name] : [name, ingredient];
}

/** Minimum normalized length before a bare prefix counts as a match. */
const PREFIX_MIN = 5;

/**
 * Match a raw OCR drug-name string against the bundled subset.
 * 'exact' means the normalized strings are identical; 'close' means one
 * OCR-sized slip (edit distance <= 2) or an unambiguous prefix. Returns
 * null rather than guessing when nothing is near.
 */
export function matchRxNorm(
  rawName: string,
  subset: RxEntry[] = RXNORM_SUBSET,
): RxMatch | null {
  const query = normalizeDrugName(rawName);
  if (query.length === 0) return null;

  for (const entry of subset) {
    if (keysOf(entry).some((k) => k === query)) {
      return { entry, confidence: 'exact' };
    }
  }

  let best: { entry: RxEntry; dist: number } | null = null;
  for (const entry of subset) {
    for (const key of keysOf(entry)) {
      const d = editDistance(query, key, 2);
      if (d <= 2 && (best === null || d < best.dist)) {
        best = { entry, dist: d };
      }
    }
  }
  if (best) return { entry: best.entry, confidence: 'close' };

  for (const entry of subset) {
    for (const key of keysOf(entry)) {
      if (Math.min(query.length, key.length) < PREFIX_MIN) continue;
      if (query.startsWith(key) || key.startsWith(query)) {
        return { entry, confidence: 'close' };
      }
    }
  }

  return null;
}
