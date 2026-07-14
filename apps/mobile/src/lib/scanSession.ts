/**
 * In-memory hand-off between the scan capture screen and the confirm
 * screen. Parsed label fields are transient PHI; the no-PII-in-URLs
 * guardrail forbids serializing them into route params, so the capture
 * screen stashes them here and the confirm screen reads them back. The
 * holder is cleared after a save (or when a new scan replaces it) and
 * never touches disk.
 */
import {
  parseDate,
  type ParsedLabel,
} from '@hearth/label-parser';

/** Field keys the confirm screen renders cards for. */
export type ScanFieldKey =
  | 'name'
  | 'strength'
  | 'sig'
  | 'fillDate'
  | 'daySupply'
  | 'quantity'
  | 'rxNumber'
  | 'pharmacy'
  | 'pharmacyPhone'
  | 'prescriber'
  | 'patientName';

export interface PendingScan {
  patientId: string;
  /** Full recognized text, line per visual line. Never leaves the device. */
  rawText: string;
  parsed: ParsedLabel;
  /** Raw source line each parsed value was read from, for the confirm UI. */
  sources: Partial<Record<ScanFieldKey, string>>;
}

let pending: PendingScan | null = null;

export function setPendingScan(scan: PendingScan): void {
  pending = scan;
}

export function getPendingScan(): PendingScan | null {
  return pending;
}

export function clearPendingScan(): void {
  pending = null;
}

/* ---------- source-line derivation ---------- */

const PHARMACY_LINE = /\b(PHARMACY|PHARMACIES|CVS|WALGREENS|RITE\s+AID|KAISER|DRUGS?)\b/;
const PRESCRIBER_LINE = /\b(DR\.?|MD|DO|NP|PA|PRESCRIBER|PHYSICIAN)\b/;

/**
 * Find, for each parsed field, the raw line it was read from. parseLabel
 * reports values without provenance, so this walks the raw text and picks
 * the first line consistent with each value. Purely presentational: the
 * confirm screen shows these lines above the editable fields so the
 * caregiver verifies against what the camera actually saw.
 */
export function deriveFieldSources(
  rawText: string,
  parsed: ParsedLabel,
): Partial<Record<ScanFieldKey, string>> {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const upper = lines.map((l) => l.toUpperCase().replace(/\s+/g, ' '));

  const lineContaining = (needle: string | undefined): string | undefined => {
    if (!needle) return undefined;
    const n = needle.toUpperCase().replace(/\s+/g, ' ').trim();
    if (n.length === 0) return undefined;
    const i = upper.findIndex((u) => u.includes(n));
    return i >= 0 ? lines[i] : undefined;
  };

  const lineMatching = (re: RegExp): string | undefined => {
    const i = upper.findIndex((u) => re.test(u));
    return i >= 0 ? lines[i] : undefined;
  };

  const out: Partial<Record<ScanFieldKey, string>> = {};

  const name = lineContaining(parsed.drugName?.value);
  if (name) out.name = name;

  const strength = lineContaining(parsed.strength?.value);
  if (strength) out.strength = strength;

  // The sig value IS raw text (possibly two joined lines); show it as read.
  if (parsed.sig?.value) out.sig = parsed.sig.value;

  if (parsed.fillDate?.value) {
    const i = upper.findIndex((u) => parseDate(u) === parsed.fillDate!.value);
    if (i >= 0) out.fillDate = lines[i]!;
  }

  if (parsed.daySupply?.value != null) {
    const supply = lineMatching(/\bDAYS?\s*SUPPLY\b/);
    if (supply) out.daySupply = supply;
  }

  if (parsed.quantity?.value != null) {
    const qty = lineMatching(/\b(QTY|QUANTITY)\b/);
    if (qty) out.quantity = qty;
  }

  const rx = parsed.rxNumber?.value ? lineMatching(/\bRX\b/) : undefined;
  if (rx) out.rxNumber = rx;

  const pharmacy = lineMatching(PHARMACY_LINE);
  if (pharmacy) out.pharmacy = pharmacy;

  if (parsed.pharmacyPhone?.value) {
    const digits = parsed.pharmacyPhone.value;
    const i = upper.findIndex((u) => u.replace(/\D/g, '').includes(digits));
    if (i >= 0) out.pharmacyPhone = lines[i]!;
  }

  const prescriber = lineMatching(PRESCRIBER_LINE);
  if (prescriber) out.prescriber = prescriber;

  const patient = lineContaining(parsed.patientName?.value);
  if (patient) out.patientName = patient;

  return out;
}

/* ---------- small parse conveniences for the confirm screen ---------- */

/**
 * A deliberately small doses-per-day reading of the sig, used only to
 * prefill the editable field. Anything unrecognized stays blank; the
 * caregiver is the source of truth.
 */
export function inferDosesPerDay(sig: string | undefined): number | null {
  if (!sig) return null;
  const t = sig.toUpperCase();
  if (/\b(ONCE\s+DAILY|ONCE\s+A\s+DAY|EVERY\s+DAY|DAILY|AT\s+BEDTIME|EVERY\s+MORNING|EVERY\s+EVENING|EVERY\s+24\s+HOURS|WEEKLY)\b/.test(t)) {
    if (/\bTWICE\b|\b2\s+TIMES\b/.test(t)) return 2;
    if (/\bWEEKLY\b|\bONCE\s+A\s+WEEK\b/.test(t)) return null;
    return 1;
  }
  if (/\bTWICE\s+(DAILY|A\s+DAY)\b|\b2\s+TIMES\s+(DAILY|A\s+DAY)\b|\bEVERY\s+12\s+HOURS\b/.test(t)) return 2;
  if (/\b(THREE|3)\s+TIMES\s+(DAILY|A\s+DAY)\b|\bEVERY\s+8\s+HOURS\b/.test(t)) return 3;
  if (/\b(FOUR|4)\s+TIMES\s+(DAILY|A\s+DAY)\b|\bEVERY\s+6\s+HOURS\b/.test(t)) return 4;
  return null;
}

/** True when the sig reads as an as-needed (PRN) schedule. */
export function inferPrn(sig: string | undefined): boolean {
  if (!sig) return false;
  return /\b(AS\s+NEEDED|PRN)\b/.test(sig.toUpperCase());
}

/** 'METFORMIN HCL' -> 'Metformin Hcl'; leaves mixed-case input alone. */
export function titleCase(s: string): string {
  if (s !== s.toUpperCase()) return s;
  return s
    .toLowerCase()
    .replace(/(^|[\s\-/])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** '4155550301' -> '(415) 555-0301'; anything else passes through. */
export function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, '');
  if (d.length !== 10) return digits;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}
