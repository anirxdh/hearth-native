/**
 * The appointment prep sheet (P24): a deterministic summary of what a
 * clinician should hear about, computed from the record. Pure functions
 * only; no clock, no database, no React Native. The screen assembles the
 * inputs from the repo and this module decides what is worth saying.
 *
 * Every drafted question is a plain-English string ending in a question
 * mark. The rules are code, not weights, so a caregiver can always ask
 * "why is this question here?" and get an answer that reads like a sentence.
 */

import { addDays, type LocalDate } from '@rua/core';

/* ---------- input shapes (display-ready, decoupled from DB rows) ---------- */

export interface PrepMed {
  name: string;
  strength: string | null;
  sig: string | null;
  prn: boolean;
  highAlert: boolean;
}

export interface PrepMedChange {
  /** ISO instant of the change-log row. */
  at: string;
  action: 'create' | 'update' | 'archive' | 'restore';
  medName: string;
  /** Field names that changed, for updates; empty otherwise. */
  changedFields: string[];
}

export interface PrepVital {
  kind: string; // 'bp' | 'weight' | 'glucose' | 'spo2' | 'temp' | 'hr'
  value: number;
  value2: number | null;
  unit: string;
  recordedOn: string; // YYYY-MM-DD
  recordedAt: string; // ISO instant, for ordering within a day
}

export interface PrepObservation {
  kind: string; // 'mood' | 'appetite' | 'sleep' | 'incident' | 'note'
  text: string;
  at: string; // ISO instant
}

export interface PrepSheetInput {
  today: LocalDate;
  meds: PrepMed[];
  medChanges: PrepMedChange[];
  vitals: PrepVital[];
  observations: PrepObservation[];
  /** The appointment's free-text bring field; comma or newline separated. */
  bring: string | null;
}

export interface PrepSheetData {
  currentMeds: PrepMed[];
  /** "2026-06-20: Started Metformin", newest first. */
  medChanges: string[];
  /** Sentences about notable 30-day vital movement. */
  trends: string[];
  /** Newest five observations from the last 30 days. */
  observations: { on: string; text: string }[];
  /** Drafted questions; each ends in a question mark. Never empty. */
  questions: string[];
  bring: string[];
}

/* ---------- rules ---------- */

const WINDOW_DAYS = 30;
const MAX_MED_CHANGES = 8;
const MAX_OBSERVATIONS = 5;
const MAX_QUESTIONS = 6;

/** Notable 30-day deltas, per vital kind. BP compares systolic (value). */
const TREND_THRESHOLDS: Record<string, number> = {
  hr: 5, // bpm
  weight: 3, // lb
  bp: 10, // systolic points
};

const TREND_NOUN: Record<string, string> = {
  hr: 'Resting heart rate',
  weight: 'Weight',
  bp: 'Systolic blood pressure',
};

interface Trend {
  kind: string;
  delta: number;
  from: number;
  to: number;
  unit: string;
}

function inWindow(day: string, today: LocalDate): boolean {
  // YYYY-MM-DD strings compare correctly as strings.
  return day >= addDays(today, -WINDOW_DAYS) && day <= today;
}

function findTrends(vitals: PrepVital[], today: LocalDate): Trend[] {
  const trends: Trend[] = [];
  for (const kind of Object.keys(TREND_THRESHOLDS)) {
    const series = vitals
      .filter((v) => v.kind === kind && inWindow(v.recordedOn, today))
      .sort((a, b) => (a.recordedAt < b.recordedAt ? -1 : a.recordedAt > b.recordedAt ? 1 : 0));
    if (series.length < 2) continue;
    const baseline = series[0]!;
    const latest = series[series.length - 1]!;
    if (baseline.recordedOn === latest.recordedOn) continue;
    const delta = latest.value - baseline.value;
    if (Math.abs(delta) < TREND_THRESHOLDS[kind]!) continue;
    trends.push({ kind, delta, from: baseline.value, to: latest.value, unit: latest.unit });
  }
  return trends;
}

function trendLine(t: Trend): string {
  const dir = t.delta > 0 ? 'up' : 'down';
  const amount = Math.abs(t.delta);
  if (t.kind === 'bp') {
    return `${TREND_NOUN.bp} is ${dir} ${amount} points over the last 30 days (${t.from} to ${t.to}).`;
  }
  return `${TREND_NOUN[t.kind]} is ${dir} ${amount} ${t.unit} over the last 30 days (${t.from} to ${t.to} ${t.unit}).`;
}

function trendQuestion(t: Trend): string {
  const dir = t.delta > 0 ? 'up' : 'down';
  const amount = Math.abs(t.delta);
  if (t.kind === 'hr') {
    return `Resting heart rate is ${dir} ${amount} bpm this month. Could a medication or dose explain it?`;
  }
  if (t.kind === 'weight') {
    return `Weight is ${dir} ${amount} lb this month. Is that expected?`;
  }
  return `Systolic blood pressure is ${dir} ${amount} points this month. Should the plan change?`;
}

/** Plain-English names for the medication fields a change can touch. */
const FIELD_LABELS: Record<string, string> = {
  name: 'name',
  strength: 'strength',
  sig: 'schedule',
  dosesPerDay: 'doses per day',
  prn: 'as-needed status',
  prescriber: 'prescriber',
  pharmacy: 'pharmacy',
  pharmacyPhone: 'pharmacy phone',
  rxNumber: 'rx number',
  notes: 'notes',
  active: 'active status',
};

function medChangeLine(c: PrepMedChange): string {
  const day = c.at.slice(0, 10);
  const fields = c.changedFields.map((f) => FIELD_LABELS[f] ?? f);
  switch (c.action) {
    case 'create':
      return `${day}: Started ${c.medName}`;
    case 'archive':
      return `${day}: Stopped ${c.medName}`;
    case 'restore':
      return `${day}: Resumed ${c.medName}`;
    default:
      return `${day}: ${c.medName} changed${fields.length ? ` (${fields.join(', ')})` : ''}`;
  }
}

function medChangeQuestion(c: PrepMedChange): string {
  switch (c.action) {
    case 'create':
      return `We started ${c.medName} recently. Is it working as intended?`;
    case 'archive':
      return `We stopped ${c.medName} recently. Is a follow-up needed?`;
    case 'restore':
      return `We resumed ${c.medName} recently. Is the plan still right?`;
    default:
      return `${c.medName} changed recently. Does anything else need to change with it?`;
  }
}

function splitBring(bring: string | null): string[] {
  if (!bring) return [];
  return bring
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function buildPrepSheet(input: PrepSheetInput): PrepSheetData {
  const { today } = input;

  const changes = input.medChanges
    .filter((c) => inWindow(c.at.slice(0, 10), today))
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  const trends = findTrends(input.vitals, today);

  const observations = input.observations
    .filter((o) => inWindow(o.at.slice(0, 10), today))
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, MAX_OBSERVATIONS)
    .map((o) => ({ on: o.at.slice(0, 10), text: o.text }));

  const questions: string[] = [];
  const ask = (q: string) => {
    if (!questions.includes(q)) questions.push(q);
  };

  for (const t of trends) ask(trendQuestion(t));
  for (const c of changes.slice(0, 2)) ask(medChangeQuestion(c));

  const incident = input.observations
    .filter((o) => o.kind === 'incident' && inWindow(o.at.slice(0, 10), today))
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))[0];
  if (incident) {
    const snippet =
      incident.text.length > 80 ? `${incident.text.slice(0, 80).trimEnd()}...` : incident.text;
    ask(`We noted an incident on ${incident.at.slice(0, 10)}: ${snippet} What should we watch for?`);
  }

  const highAlertNames = input.meds.filter((m) => m.highAlert).map((m) => m.name);
  if (highAlertNames.length > 0) {
    ask(
      `Do the high-alert medication${highAlertNames.length === 1 ? '' : 's'} (${highAlertNames.join(', ')}) need any adjustment?`,
    );
  }

  ask('Is there anything new we should watch for before the next visit?');

  return {
    currentMeds: input.meds,
    medChanges: changes.slice(0, MAX_MED_CHANGES).map(medChangeLine),
    trends: trends.map(trendLine),
    observations,
    questions: questions.slice(0, MAX_QUESTIONS),
    bring: [
      'Insurance card and photo ID',
      'Medication list (this prep sheet covers it)',
      ...splitBring(input.bring),
    ],
  };
}

/* ---------- printable HTML (inline CSS mirroring @rua/print) ---------- */

/** Escape a string for safe interpolation into HTML text and attributes. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const INK = '#1D1D1F';
const SECONDARY = '#6E6E73';
const HAIRLINE = '#E5E5EA';
const RED = '#C4362F';

const PREP_CSS = `
  @page { size: letter; margin: 0.6in; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: #FFFFFF; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: ${INK};
    font-size: 11px;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .kicker {
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: ${SECONDARY};
  }
  h1 { font-size: 27px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.15; margin-top: 2px; }
  .subline { color: ${SECONDARY}; font-size: 11px; margin-top: 3px; }
  .header { padding-bottom: 12px; border-bottom: 1px solid ${HAIRLINE}; }
  .section { margin-top: 20px; page-break-inside: avoid; }
  .section h2 {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: -0.01em;
    padding-bottom: 6px;
    border-bottom: 1px solid ${HAIRLINE};
    margin-bottom: 8px;
  }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 6px 10px 6px 0; border-bottom: 1px solid ${HAIRLINE}; vertical-align: top; }
  tr { page-break-inside: avoid; }
  .med-name { font-weight: 600; }
  .muted { color: ${SECONDARY}; }
  .high-alert {
    color: ${RED};
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  ul { padding-left: 16px; }
  li { margin-top: 4px; }
  .q { font-weight: 600; }
  .footer {
    margin-top: 26px;
    padding-top: 10px;
    border-top: 1px solid ${HAIRLINE};
    color: ${SECONDARY};
    font-size: 9px;
  }
`;

export interface PrepSheetHtmlInput {
  patientName: string;
  dob: string | null;
  provider: string;
  specialty: string | null;
  location: string | null;
  onDate: string;
  atTime: string | null;
  driver: string | null;
  purpose: string | null;
  sheet: PrepSheetData;
  generatedAt: string;
}

export function prepSheetHtml(input: PrepSheetHtmlInput): string {
  const { sheet } = input;

  const visitLine = [
    input.provider,
    input.specialty,
    `${input.onDate}${input.atTime ? ` at ${input.atTime}` : ''}`,
    input.location,
    input.driver ? `${input.driver} drives` : null,
  ]
    .filter((s): s is string => Boolean(s))
    .map(esc)
    .join(' &middot; ');

  const medsRows =
    sheet.currentMeds.length === 0
      ? '<div class="muted">No medications on record.</div>'
      : [
          '<table><tbody>',
          sheet.currentMeds
            .map((m) =>
              [
                '<tr>',
                `<td><span class="med-name">${esc(m.name)}</span>${m.strength ? ` ${esc(m.strength)}` : ''}</td>`,
                `<td>${m.sig ? esc(m.sig) : '<span class="muted">See label</span>'}</td>`,
                `<td>${[m.highAlert ? '<span class="high-alert">HIGH ALERT</span>' : '', m.prn ? '<span class="muted">PRN</span>' : ''].filter(Boolean).join(' ')}</td>`,
                '</tr>',
              ].join(''),
            )
            .join(''),
          '</tbody></table>',
        ].join('');

  const list = (items: string[], empty: string, cls?: string): string =>
    items.length === 0
      ? `<div class="muted">${esc(empty)}</div>`
      : `<ul>${items.map((s) => `<li${cls ? ` class="${cls}"` : ''}>${esc(s)}</li>`).join('')}</ul>`;

  const observations =
    sheet.observations.length === 0
      ? '<div class="muted">Nothing noted in the last 30 days.</div>'
      : `<ul>${sheet.observations
          .map((o) => `<li><span class="muted">${esc(o.on)}</span> ${esc(o.text)}</li>`)
          .join('')}</ul>`;

  const body = [
    '<div class="header">',
    '<div class="kicker">Appointment prep sheet</div>',
    `<h1>${esc(input.patientName)}</h1>`,
    `<div class="subline">${input.dob ? `Born ${esc(input.dob)} &middot; ` : ''}${visitLine}</div>`,
    '</div>',
    `<div class="section"><h2>Current medications</h2>${medsRows}</div>`,
    `<div class="section"><h2>Medication changes, last 30 days</h2>${list(sheet.medChanges, 'No medication changes in the last 30 days.')}</div>`,
    `<div class="section"><h2>Trends worth mentioning</h2>${list(sheet.trends, 'No notable movement in the tracked vitals.')}</div>`,
    `<div class="section"><h2>Recent observations</h2>${observations}</div>`,
    `<div class="section"><h2>Questions to ask</h2>${list(sheet.questions, '', 'q')}</div>`,
    `<div class="section"><h2>Bring</h2>${list(sheet.bring, 'Nothing listed.')}</div>`,
    `<div class="footer">Generated by RUA on ${esc(input.generatedAt)}. Prepared from home records; always verify against the bottle and your clinician's instructions.</div>`,
  ].join('\n');

  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>Prep sheet for ${esc(input.patientName)}</title>`,
    `<style>${PREP_CSS}</style>`,
    '</head>',
    '<body>',
    body,
    '</body>',
    '</html>',
  ].join('\n');
}
