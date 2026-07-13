/**
 * The repository: every consequential write goes through here so ids,
 * timestamps, high-alert flags, and the append-only change log stay
 * consistent no matter which screen initiated the write.
 */
import { and, desc, eq, isNull } from 'drizzle-orm';
import {
  contacts,
  changeLog,
  medFills,
  medications,
  patients,
  settings,
  type Contact,
  type MedFill,
  type Medication,
  type NewContact,
  type NewMedication,
  type NewPatient,
  type Patient,
} from '@hearth/schema';
import {
  DEFAULT_PREFS,
  isHighAlert,
  latestFill,
  computeRunway,
  uuidv7,
  type NotificationPrefs,
  type Runway,
  type LocalDate,
} from '@hearth/core';
import { getDb } from './client';
import { nowIso, today } from '../lib/clock';
import { bumpDataVersion } from '../lib/events';

/* ---------- change log ---------- */

function logChange(
  entity: 'patient' | 'medication' | 'med_fill' | 'contact' | 'settings',
  entityId: string,
  patientId: string | null,
  action: 'create' | 'update' | 'archive' | 'restore',
  detail?: Record<string, unknown>,
) {
  getDb()
    .insert(changeLog)
    .values({ id: uuidv7(), at: nowIso(), entity, entityId, patientId, action, detail: detail ?? null })
    .run();
  bumpDataVersion();
}

function diff<T extends Record<string, unknown>>(before: T, patch: Partial<T>) {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of Object.keys(patch)) {
    if (before[k] !== patch[k]) out[k] = { from: before[k] ?? null, to: patch[k] ?? null };
  }
  return out;
}

/* ---------- patients ---------- */

export function listPatients(): Patient[] {
  return getDb().select().from(patients).where(isNull(patients.archivedAt)).all();
}

export function getPatient(id: string): Patient | undefined {
  return getDb().select().from(patients).where(eq(patients.id, id)).get();
}

export function createPatient(
  input: Omit<NewPatient, 'id' | 'createdAt' | 'updatedAt'>,
): Patient {
  const now = nowIso();
  const row: NewPatient = { ...input, id: uuidv7(), createdAt: now, updatedAt: now };
  getDb().insert(patients).values(row).run();
  logChange('patient', row.id!, row.id!, 'create', { fullName: row.fullName });
  return getPatient(row.id!)!;
}

export function updatePatient(id: string, patch: Partial<NewPatient>): Patient {
  const before = getPatient(id);
  if (!before) throw new Error('Patient not found');
  getDb().update(patients).set({ ...patch, updatedAt: nowIso() }).where(eq(patients.id, id)).run();
  logChange('patient', id, id, 'update', diff(before as Record<string, unknown>, patch));
  return getPatient(id)!;
}

export function archivePatient(id: string): void {
  getDb().update(patients).set({ archivedAt: nowIso(), updatedAt: nowIso() }).where(eq(patients.id, id)).run();
  logChange('patient', id, id, 'archive');
}

/* ---------- contacts ---------- */

export function listContacts(patientId: string): Contact[] {
  return getDb()
    .select()
    .from(contacts)
    .where(and(eq(contacts.patientId, patientId), isNull(contacts.archivedAt)))
    .all()
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function createContact(input: Omit<NewContact, 'id' | 'createdAt' | 'updatedAt'>): Contact {
  const now = nowIso();
  const row: NewContact = { ...input, id: uuidv7(), createdAt: now, updatedAt: now };
  getDb().insert(contacts).values(row).run();
  logChange('contact', row.id!, row.patientId, 'create', { name: row.name });
  return getDb().select().from(contacts).where(eq(contacts.id, row.id!)).get()!;
}

/* ---------- medications ---------- */

export interface MedWithRunway extends Medication {
  fills: MedFill[];
  runway: Runway | null;
}

export function listMedications(patientId: string, opts?: { includeInactive?: boolean }): MedWithRunway[] {
  const db = getDb();
  const meds = db
    .select()
    .from(medications)
    .where(and(eq(medications.patientId, patientId), isNull(medications.archivedAt)))
    .all()
    .filter((m) => (opts?.includeInactive ? true : m.active));
  return meds.map(withRunway);
}

export function listAllMedications(): (MedWithRunway & { patient: Patient })[] {
  const db = getDb();
  const pats = new Map(listPatients().map((p) => [p.id, p]));
  const meds = db.select().from(medications).where(isNull(medications.archivedAt)).all();
  return meds
    .filter((m) => m.active && pats.has(m.patientId))
    .map((m) => ({ ...withRunway(m), patient: pats.get(m.patientId)! }));
}

export function getMedication(id: string): MedWithRunway | undefined {
  const m = getDb().select().from(medications).where(eq(medications.id, id)).get();
  return m ? withRunway(m) : undefined;
}

function withRunway(m: Medication): MedWithRunway {
  const fills = getDb()
    .select()
    .from(medFills)
    .where(eq(medFills.medicationId, m.id))
    .orderBy(desc(medFills.fillDate))
    .all();
  const latest = latestFill(fills);
  const runway =
    latest && !m.prn ? computeRunway({ fillDate: latest.fillDate as LocalDate, daySupply: latest.daySupply }, today()) : null;
  return { ...m, fills, runway };
}

export function createMedication(
  input: Omit<NewMedication, 'id' | 'createdAt' | 'updatedAt' | 'highAlert'>,
  firstFill?: { fillDate: LocalDate; daySupply: number; quantity?: number },
): MedWithRunway {
  const now = nowIso();
  const row: NewMedication = {
    ...input,
    id: uuidv7(),
    highAlert: isHighAlert(`${input.name} ${input.strength ?? ''}`),
    createdAt: now,
    updatedAt: now,
  };
  getDb().insert(medications).values(row).run();
  logChange('medication', row.id!, row.patientId, 'create', { name: row.name, highAlert: row.highAlert });
  if (firstFill) addFill(row.id!, firstFill, 'manual');
  return getMedication(row.id!)!;
}

export function updateMedication(id: string, patch: Partial<NewMedication>): MedWithRunway {
  const before = getDb().select().from(medications).where(eq(medications.id, id)).get();
  if (!before) throw new Error('Medication not found');
  const next: Partial<NewMedication> = { ...patch, updatedAt: nowIso() };
  if (patch.name || patch.strength) {
    next.highAlert = isHighAlert(`${patch.name ?? before.name} ${patch.strength ?? before.strength ?? ''}`);
  }
  getDb().update(medications).set(next).where(eq(medications.id, id)).run();
  logChange('medication', id, before.patientId, 'update', diff(before as Record<string, unknown>, patch));
  return getMedication(id)!;
}

export function archiveMedication(id: string): void {
  const before = getDb().select().from(medications).where(eq(medications.id, id)).get();
  if (!before) return;
  getDb()
    .update(medications)
    .set({ archivedAt: nowIso(), active: false, updatedAt: nowIso() })
    .where(eq(medications.id, id))
    .run();
  logChange('medication', id, before.patientId, 'archive');
}

export function addFill(
  medicationId: string,
  fill: { fillDate: LocalDate; daySupply: number; quantity?: number },
  source: 'manual' | 'scan' = 'manual',
): MedFill {
  const med = getDb().select().from(medications).where(eq(medications.id, medicationId)).get();
  if (!med) throw new Error('Medication not found');
  const row = {
    id: uuidv7(),
    medicationId,
    fillDate: fill.fillDate,
    daySupply: fill.daySupply,
    quantity: fill.quantity ?? null,
    source,
    createdAt: nowIso(),
  };
  getDb().insert(medFills).values(row).run();
  logChange('med_fill', row.id, med.patientId, 'create', {
    fillDate: fill.fillDate,
    daySupply: fill.daySupply,
  });
  return row as MedFill;
}

/* ---------- settings ---------- */

const PREFS_KEY = 'notificationPrefs';

export function getNotificationPrefs(): NotificationPrefs {
  const row = getDb().select().from(settings).where(eq(settings.key, PREFS_KEY)).get();
  return row?.value ? { ...DEFAULT_PREFS, ...(row.value as Partial<NotificationPrefs>) } : DEFAULT_PREFS;
}

export function setNotificationPrefs(prefs: NotificationPrefs): void {
  getDb()
    .insert(settings)
    .values({ key: PREFS_KEY, value: prefs, updatedAt: nowIso() })
    .onConflictDoUpdate({ target: settings.key, set: { value: prefs, updatedAt: nowIso() } })
    .run();
  logChange('settings', PREFS_KEY, null, 'update');
}

/* ---------- cross-patient reads for digest/status ---------- */

export function lastTouchedAt(patientId: string): string | null {
  const row = getDb()
    .select()
    .from(changeLog)
    .where(eq(changeLog.patientId, patientId))
    .orderBy(desc(changeLog.at))
    .limit(1)
    .get();
  return row?.at ?? null;
}
