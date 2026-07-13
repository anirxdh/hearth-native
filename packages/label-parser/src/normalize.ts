/**
 * Normalization helpers shared by the parser, its tests, and the spike
 * runner's ground-truth comparison. Deterministic string munging only.
 */

const MONTHS: Record<string, number> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};

function iso(y: number, m: number, d: number): string | undefined {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return undefined;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Find the first date in a string and return it as ISO YYYY-MM-DD.
 * Supported: YYYY-MM-DD, MM/DD/YYYY, M/D/YY, MM-DD-YYYY, MM.DD.YYYY,
 * "MAY 30, 2026" (full or abbreviated month), "30 MAY 2026", "30-MAY-2026".
 */
export function parseDate(text: string): string | undefined {
  const t = text.toUpperCase();

  let m = t.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));

  m = t.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    return iso(y, Number(m[1]), Number(m[2]));
  }

  m = t.match(/\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/);
  if (m) return iso(Number(m[3]), MONTHS[m[1] as string] ?? 0, Number(m[2]));

  m = t.match(/\b(\d{1,2})[\s-](JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\.?[\s-](\d{4})\b/);
  if (m) return iso(Number(m[3]), MONTHS[m[2] as string] ?? 0, Number(m[1]));

  return undefined;
}

/** Uppercase, collapse runs of whitespace, trim. */
export function normalizeText(s: string): string {
  return s.toUpperCase().replace(/\s+/g, ' ').trim();
}

/** "ALVAREZ, ROBERT" -> "ROBERT ALVAREZ"; strips periods, collapses space. */
export function normalizeName(s: string): string {
  const t = normalizeText(s).replace(/\./g, '');
  const m = t.match(/^([A-Z' -]+),\s*([A-Z' -]+)$/);
  if (m) return `${(m[2] as string).trim()} ${(m[1] as string).trim()}`;
  return t;
}

/** "500 mg" and "500MG" both -> "500MG". */
export function normalizeStrength(s: string): string {
  return s.toUpperCase().replace(/[\s.]+/g, '');
}

/** Keep digits; strip a leading US country code from 11-digit numbers. */
export function normalizePhone(s: string): string {
  let digits = s.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  return digits;
}
