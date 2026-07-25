/**
 * The print pipeline (P14): pure HTML from @rua/print, rendered to PDF by
 * expo-print. Two rules, both enforced here and nowhere else:
 *  - every print or share of a care document is a sensitive read -> access log
 *  - PHI PDFs only ever live in the cache, and are deleted after the share
 *    sheet closes
 */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import {
  erSheetHtml,
  onePagerHtml,
  portfolioHtml,
  guideHtml,
  type PrintContact,
  type PrintMed,
  type PrintPatient,
  type PrintVital,
} from '@rua/print';
import { dailyNeeds, type NutritionRow } from '@rua/core';
import type { Contact, Patient, Vital } from '@rua/schema';
import type { Guide } from '../content/guides';
import { listContacts, latestVitals, listMedications, logAccess, type MedWithRunway } from '../db/repo';
import { today } from '../lib/clock';

function toPrintPatient(p: Patient): PrintPatient {
  return {
    fullName: p.fullName,
    ...(p.preferredName ? { preferredName: p.preferredName } : {}),
    ...(p.dob ? { dob: p.dob } : {}),
    ...(p.relationship ? { relationship: p.relationship } : {}),
    conditions: p.conditions,
    allergies: p.allergies,
  };
}

function toPrintMeds(meds: MedWithRunway[]): PrintMed[] {
  return meds.map((m) => ({
    name: m.name,
    ...(m.strength ? { strength: m.strength } : {}),
    ...(m.sig ? { sig: m.sig } : {}),
    prn: m.prn,
    highAlert: m.highAlert,
    daysLeft: m.runway ? m.runway.daysRemaining : null,
    runOutDate: m.runway ? m.runway.runOutDate : null,
  }));
}

const VITAL_LABEL: Record<Vital['kind'], string> = {
  bp: 'Blood pressure',
  weight: 'Weight',
  glucose: 'Fasting glucose',
  spo2: 'Oxygen',
  temp: 'Temperature',
  steps: 'Steps',
  sleep: 'Sleep',
  active_min: 'Active minutes',
  hr: 'Resting heart rate',
};

function toPrintVitals(vs: Vital[]): PrintVital[] {
  return vs.map((v) => ({
    label: VITAL_LABEL[v.kind],
    value: `${v.kind === 'bp' && v.value2 != null ? `${v.value}/${v.value2}` : v.value} ${v.unit}`,
    recordedOn: v.recordedOn,
  }));
}

function toPrintContacts(cs: Contact[]): PrintContact[] {
  return cs.map((c) => ({
    name: c.name,
    ...(c.relation ? { relation: c.relation } : {}),
    ...(c.phone ? { phone: c.phone } : {}),
    kind: c.kind,
  }));
}

function ageOf(p: Patient): number | null {
  return p.dob ? Math.floor((Date.now() - new Date(p.dob).getTime()) / (365.25 * 86400000)) : null;
}

function nutritionFor(p: Patient): NutritionRow[] {
  const age = ageOf(p);
  if (age === null) return [];
  const weight = latestVitals(p.id).find((v) => v.kind === 'weight');
  // The explicit profile field (patients.sex) wins. For records created
  // before that field existed, fall back to the stated demo simplification:
  // female unless pronouns say otherwise.
  const sex = p.sex ?? (p.pronouns?.toLowerCase().startsWith('he') ? 'male' : 'female');
  return dailyNeeds({ ageYears: age, sex, ...(weight ? { weightLb: weight.value } : {}) });
}

function generatedAt(): string {
  return new Date().toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Render HTML to a cached PDF, open the share sheet, then delete the file. */
async function shareHtmlAsPdf(html: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html });
  try {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
  } finally {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
}

/** AirPrint directly (no intermediate file). */
async function printHtml(html: string): Promise<void> {
  await Print.printAsync({ html });
}

export type PaperAction = 'print' | 'share';

export async function outputOnePager(patient: Patient, action: PaperAction): Promise<void> {
  logAccess(`one_pager.${action}`, patient.id);
  const html = onePagerHtml({
    patient: toPrintPatient(patient),
    meds: toPrintMeds(listMedications(patient.id)),
    vitals: toPrintVitals(latestVitals(patient.id)),
    contacts: toPrintContacts(listContacts(patient.id)),
    nutrition: nutritionFor(patient),
    generatedAt: generatedAt(),
  });
  await (action === 'print' ? printHtml(html) : shareHtmlAsPdf(html));
}

export async function outputErSheet(patient: Patient, action: PaperAction): Promise<void> {
  logAccess(`er_sheet.${action}`, patient.id);
  const meds = listMedications(patient.id);
  const contacts = listContacts(patient.id);
  const pharmacyNames = [...new Set(meds.map((m) => m.pharmacy).filter(Boolean))] as string[];
  const html = erSheetHtml({
    patient: toPrintPatient(patient),
    meds: toPrintMeds(meds),
    contacts: toPrintContacts(contacts),
    keyFacts: [
      ...(patient.dob ? [{ label: 'Date of birth', value: patient.dob }] : []),
      ...(pharmacyNames.length ? [{ label: 'Pharmacy', value: pharmacyNames.join(', ') }] : []),
      { label: 'Generated', value: today() },
    ],
    generatedAt: generatedAt(),
  });
  await (action === 'print' ? printHtml(html) : shareHtmlAsPdf(html));
}

export async function outputPortfolio(patients: Patient[], action: PaperAction): Promise<void> {
  logAccess(`portfolio.${action}`, null);
  const html = portfolioHtml({
    people: patients.map((p) => ({
      patient: toPrintPatient(p),
      meds: toPrintMeds(listMedications(p.id)),
      contacts: toPrintContacts(listContacts(p.id)),
    })),
    generatedAt: generatedAt(),
  });
  await (action === 'print' ? printHtml(html) : shareHtmlAsPdf(html));
}

export async function outputGuide(guide: Guide, action: PaperAction): Promise<void> {
  logAccess(`guide.${action}:${guide.id}`, null);
  const html = guideHtml({
    title: guide.title,
    oneLiner: guide.oneLiner,
    steps: guide.steps.map(({ n, title, body }) => ({ n, title, body })),
    ...(guide.warning ? { warning: guide.warning } : {}),
    review: guide.review,
    generatedAt: generatedAt(),
  });
  await (action === 'print' ? printHtml(html) : shareHtmlAsPdf(html));
}
