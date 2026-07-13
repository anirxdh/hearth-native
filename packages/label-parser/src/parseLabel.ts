/**
 * Deterministic pharmacy-label parser.
 *
 * Input: OCR lines with pixel bounding boxes (top-left origin) from Apple
 * Vision. Output: candidate fields with per-field confidence. No inference
 * beyond fixed heuristics; anything uncertain simply comes back undefined
 * or with a low confidence so the confirm UI can flag it.
 */

import { sortedGenerics } from './generics';
import { parseDate } from './normalize';
import type { OcrLine, ParsedField, ParsedLabel } from './types';

interface Entry {
  line: OcrLine;
  /** Uppercased, whitespace-collapsed text. */
  u: string;
  /** Row index in reading order (top to bottom). */
  row: number;
  /** Position within the row (left to right). */
  col: number;
  /** Index in flattened reading order. */
  idx: number;
}

const SIG_STARTER =
  /^(TAKE|USE|INJECT|APPLY|INSTILL|INHALE|CHEW|GIVE|PLACE|DISSOLVE|SWALLOW|SPRAY)\b/;
const SIG_DOSE = /^\d+\s+(TABLET|CAPSULE|TAB|CAP|PUFF|DROP|UNIT)S?\b/;
const SIG_CONTENT =
  /\b(TABLETS?|CAPSULES?|TABS?|CAPS?|MOUTH|ORALLY|DAILY|DAYS?|MORNING|EVENING|BEDTIME|WEEKLY|HOURS?|UNITS?|SKIN|SUBCUTANEOUSLY|NEEDED|MEALS?|FOOD|STOMACH|TWICE|ONCE|EYES?|EARS?)\b/;
const FIELD_NOISE =
  /\b(QTY|QUANTITY|REFILLS?|RX|SUPPLY|FILLED|DISPENSED|NDC|MFG|LOT|EXP|EXPIRES?|DISCARD|WARNING|CAUTION|PHONE|TEL|DR|MD|RPH|PRESCRIBER|ORIG|AUTH|STORE|KEEP|FEDERAL|AVOID|IMPORTANT|INSURANCE)\b/;
const STRENGTH_RE =
  /(\d+(?:\.\d+)?)\s*(UNITS?\/ML|MG\/ML|MCG\/ML|MCG|MG|MEQ|ML|IU|%|G)\b/;
const PHONE_RE = /(?<!\d)(?:1[-.\s])?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}(?!\d)/;
const NAME_EXCLUDE =
  /\b(PHARMACY|PHARMACIES|CVS|WALGREENS|KAISER|PERMANENTE|RITE|AID|DRUG|DRUGS|CLINIC|MEDICAL|MAIL|ORDER|STORE|INC|LLC|DR|MD|DO|NP|PA|RPH|PRESCRIBER|DOCTOR|TABLET|CAPSULE|TAKE|USE|INJECT|APPLY|REFILL|REFILLS|QTY|SUPPLY|FILLED|DATE|PHONE|TEL|CALL|NDC|MFG|LOT|EXP|DISCARD|WARNING|CAUTION|ORIG|AUTH|INSURANCE|GENERIC|SUBSTITUTED|FEDERAL|LAW|IMPORTANT|KEEP|QUESTIONS|BOX)\b/;

function field<T>(value: T, confidence: number): ParsedField<T> {
  return { value, confidence: Math.max(0, Math.min(1, confidence)) };
}

/** Group lines into visual rows, then flatten into reading order. */
function buildEntries(lines: OcrLine[]): Entry[] {
  const sorted = [...lines]
    .filter((l) => l.text.trim().length > 0)
    .sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2) || a.x - b.x);
  const rows: OcrLine[][] = [];
  for (const line of sorted) {
    const cy = line.y + line.h / 2;
    const last = rows[rows.length - 1];
    if (last) {
      const ref = last[last.length - 1] as OcrLine;
      const refCy = ref.y + ref.h / 2;
      if (Math.abs(cy - refCy) <= Math.max(line.h, ref.h) * 0.6) {
        last.push(line);
        continue;
      }
    }
    rows.push([line]);
  }
  const entries: Entry[] = [];
  rows.forEach((row, r) => {
    row.sort((a, b) => a.x - b.x);
    row.forEach((line, c) => {
      entries.push({
        line,
        u: line.text.toUpperCase().replace(/\s+/g, ' ').trim(),
        row: r,
        col: c,
        idx: entries.length,
      });
    });
  });
  return entries;
}

/** Levenshtein distance, early-exit above `max`. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (prev[j] as number) + 1,
        (curr[j - 1] as number) + 1,
        (prev[j - 1] as number) + cost,
      );
      rowMin = Math.min(rowMin, curr[j] as number);
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j] as number;
  }
  return prev[b.length] as number;
}

interface DrugHit {
  name: string;
  entry: Entry;
  factor: number;
}

function findDrug(entries: Entry[]): DrugHit | undefined {
  const generics = sortedGenerics();
  const hits: DrugHit[] = [];
  for (const entry of entries) {
    for (const g of generics) {
      const re = new RegExp(`\\b${g.replace(/ /g, '\\s+')}\\b`);
      if (re.test(entry.u)) {
        hits.push({ name: g, entry, factor: 1 });
        break;
      }
    }
  }
  if (hits.length > 0) {
    const withStrength = hits.find((h) => STRENGTH_RE.test(h.entry.u));
    return withStrength ?? (hits[0] as DrugHit);
  }
  // Fuzzy fallback for one OCR character error in longer names.
  for (const entry of entries) {
    const words = entry.u.split(/[^A-Z0-9]+/).filter((w) => w.length >= 6);
    for (const w of words) {
      for (const g of generics) {
        if (g.includes(' ')) continue;
        if (editDistance(w, g, 1) <= 1) {
          return { name: g, entry, factor: 0.7 };
        }
      }
    }
  }
  return undefined;
}

function findStrength(entries: Entry[], drug: DrugHit | undefined): ParsedField | undefined {
  const scan = (e: Entry, factor: number): ParsedField | undefined => {
    const m = e.u.match(STRENGTH_RE);
    if (!m) return undefined;
    return field(`${m[1]} ${m[2]}`, e.line.confidence * factor);
  };
  if (drug) {
    const inLine = scan(drug.entry, 1);
    if (inLine) return inLine;
    for (const e of entries) {
      if (e !== drug.entry && Math.abs(e.row - drug.entry.row) <= 1) {
        const near = scan(e, 0.7);
        if (near) return near;
      }
    }
  }
  return undefined;
}

function findSig(entries: Entry[]): ParsedField | undefined {
  for (const entry of entries) {
    const t = entry.u;
    if (!(SIG_STARTER.test(t) || SIG_DOSE.test(t))) continue;
    if (parseDate(t) !== undefined) continue; // "USE BY 05/30/2027"
    if (!SIG_CONTENT.test(t)) continue;
    // Join wrapped continuation lines directly below with a similar left edge.
    let value = t;
    let conf = entry.line.confidence;
    let row = entry.row;
    for (const next of entries) {
      if (next.row !== row + 1) continue;
      if (Math.abs(next.line.x - entry.line.x) > 60) continue;
      if (FIELD_NOISE.test(next.u)) continue;
      if (SIG_STARTER.test(next.u)) continue;
      if (parseDate(next.u) !== undefined) continue;
      if (!/^[A-Z0-9 ,.'/-]+$/.test(next.u)) continue;
      const gap = next.line.y - (entry.line.y + entry.line.h);
      if (gap > entry.line.h * 1.8) continue;
      value += ` ${next.u}`;
      conf = Math.min(conf, next.line.confidence);
      row = next.row;
    }
    return field(value, conf);
  }
  return undefined;
}

const FILL_LABEL = /\b(DATE\s+FILLED|FILL\s+DATE|FILLED|DISPENSED)\b/;
const DATE_EXCLUDE =
  /\b(DISCARD|EXP|EXPIRES?|USE\s+BY|REORDER|ORIG|WRITTEN|REFILLS?|BEFORE|AFTER|DOB)\b/;

function findFillDate(entries: Entry[]): ParsedField | undefined {
  for (const entry of entries) {
    if (!FILL_LABEL.test(entry.u)) continue;
    const own = parseDate(entry.u);
    if (own) return field(own, entry.line.confidence);
    // Label-only cell: value sits to the right in the same row or just below.
    for (const other of entries) {
      if (other === entry) continue;
      const sameRowRight = other.row === entry.row && other.line.x > entry.line.x;
      const justBelow =
        other.row === entry.row + 1 && Math.abs(other.line.x - entry.line.x) < 200;
      if (!sameRowRight && !justBelow) continue;
      if (DATE_EXCLUDE.test(other.u)) continue;
      const d = parseDate(other.u);
      if (d) return field(d, Math.min(entry.line.confidence, other.line.confidence) * 0.9);
    }
  }
  // Fallback: a single unambiguous date on the whole label.
  const candidates = new Set<string>();
  let src: Entry | undefined;
  for (const entry of entries) {
    if (DATE_EXCLUDE.test(entry.u)) continue;
    const d = parseDate(entry.u);
    if (d) {
      candidates.add(d);
      src = src ?? entry;
    }
  }
  if (candidates.size === 1 && src) {
    return field([...candidates][0] as string, src.line.confidence * 0.4);
  }
  return undefined;
}

function intNear(
  entries: Entry[],
  labelRe: RegExp,
  valueAfterRe: RegExp,
  valueBeforeRe: RegExp | undefined,
): ParsedField<number> | undefined {
  for (const entry of entries) {
    const after = entry.u.match(valueAfterRe);
    if (after) return field(Number(after[1]), entry.line.confidence);
  }
  if (valueBeforeRe) {
    for (const entry of entries) {
      const before = entry.u.match(valueBeforeRe);
      if (before) return field(Number(before[1]), entry.line.confidence);
    }
  }
  // Label-only cell with a bare number to its right in the same row.
  for (const entry of entries) {
    if (!labelRe.test(entry.u)) continue;
    for (const other of entries) {
      if (other.row !== entry.row || other.line.x <= entry.line.x) continue;
      const m = other.u.match(/^(\d{1,4})$/);
      if (m) {
        return field(
          Number(m[1]),
          Math.min(entry.line.confidence, other.line.confidence) * 0.9,
        );
      }
    }
  }
  return undefined;
}

function findRefills(entries: Entry[]): ParsedField<number> | undefined {
  const labeled = intNear(
    entries,
    /\bREFILLS?\b/,
    /\bREFILLS?\s*(?:REMAINING|LEFT)?\s*[:#]\s*(\d{1,2})\b/,
    /\b(\d{1,2})\s+REFILLS?\b/,
  );
  if (labeled) return labeled;
  for (const entry of entries) {
    if (/\bNO\s+REFILLS?\b/.test(entry.u)) return field(0, entry.line.confidence);
    const bare = entry.u.match(/\bREFILLS?\s+(\d{1,2})\b/);
    if (bare) return field(Number(bare[1]), entry.line.confidence * 0.9);
  }
  return undefined;
}

function findRxNumber(entries: Entry[]): ParsedField | undefined {
  for (const entry of entries) {
    if (/\bNDC\b/.test(entry.u)) continue;
    const m = entry.u.match(/\bRX\s*(?:NO|NUM|NUMBER)?\s*[#.:]*\s*([0-9][0-9-]{3,})\b/);
    if (m) return field((m[1] as string).replace(/-$/, ''), entry.line.confidence);
  }
  return undefined;
}

function findPhone(entries: Entry[]): ParsedField | undefined {
  interface Cand {
    digits: string;
    score: number;
    idx: number;
    conf: number;
  }
  const cands: Cand[] = [];
  for (const entry of entries) {
    if (/\bNDC\b/.test(entry.u)) continue;
    const m = entry.u.match(PHONE_RE);
    if (!m) continue;
    let digits = m[0].replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
    if (digits.length !== 10) continue;
    let score = 0;
    if (/\b(PH|PHONE|TEL|CALL|QUESTIONS)\b/.test(entry.u)) score += 3;
    if (entry.row <= 2) score += 2;
    if (/\b(DR|MD|PRESCRIBER|DOCTOR|PHYSICIAN)\b/.test(entry.u)) score -= 3;
    cands.push({ digits, score, idx: entry.idx, conf: entry.line.confidence });
  }
  if (cands.length === 0) return undefined;
  cands.sort((a, b) => b.score - a.score || a.idx - b.idx);
  const best = cands[0] as Cand;
  return field(best.digits, best.conf * (best.score > 0 ? 1 : 0.7));
}

function findPatientName(
  entries: Entry[],
  drug: DrugHit | undefined,
): ParsedField | undefined {
  for (const entry of entries) {
    const m = entry.u.match(/\b(?:PATIENT|FOR)\s*:\s*([A-Z][A-Z ,.'-]{3,})$/);
    if (m) return field((m[1] as string).trim(), entry.line.confidence);
  }
  const totalRows = entries.length > 0 ? (entries[entries.length - 1] as Entry).row + 1 : 0;
  const generics = sortedGenerics();
  for (const entry of entries) {
    if (entry.row > totalRows * 0.6) break;
    const t = entry.u;
    if (/\d/.test(t)) continue;
    if (entry.line.text !== entry.line.text.toUpperCase()) continue;
    const words = t.split(' ');
    if (words.length < 2 || words.length > 4) continue;
    if (!words.every((w) => /^[A-Z][A-Z,.'-]*$/.test(w) && w.length >= 2)) continue;
    if (NAME_EXCLUDE.test(t)) continue;
    if (generics.some((g) => t.includes(g))) continue;
    return field(t, entry.line.confidence * 0.6);
  }
  return undefined;
}

export function parseLabel(lines: OcrLine[]): ParsedLabel {
  const entries = buildEntries(lines);
  const out: ParsedLabel = {};
  if (entries.length === 0) return out;

  const drug = findDrug(entries);
  if (drug) out.drugName = field(drug.name, drug.entry.line.confidence * drug.factor);

  const strength = findStrength(entries, drug);
  if (strength) out.strength = strength;

  const sig = findSig(entries);
  if (sig) out.sig = sig;

  const fillDate = findFillDate(entries);
  if (fillDate) out.fillDate = fillDate;

  const daySupply = intNear(
    entries,
    /\bDAYS?\s*SUPPLY\b/,
    /\bDAYS?\s*SUPPLY\s*[:#]?\s*(\d{1,3})\b/,
    /\b(\d{1,3})[\s-]*DAYS?\s+SUPPLY\b/,
  );
  if (daySupply) out.daySupply = daySupply;

  const quantity = intNear(
    entries,
    /\b(?:QTY|QUANTITY)\b/,
    /\b(?:QTY|QUANTITY)\s*[:#.]?\s*(\d{1,4})\b/,
    undefined,
  );
  if (quantity) out.quantity = quantity;

  const refills = findRefills(entries);
  if (refills) out.refills = refills;

  const rxNumber = findRxNumber(entries);
  if (rxNumber) out.rxNumber = rxNumber;

  const phone = findPhone(entries);
  if (phone) out.pharmacyPhone = phone;

  const patient = findPatientName(entries, drug);
  if (patient) out.patientName = patient;

  return out;
}
