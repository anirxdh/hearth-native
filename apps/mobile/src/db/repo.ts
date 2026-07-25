/**
 * The repository: every consequential write goes through here so ids,
 * timestamps, high-alert flags, and the append-only change log stay
 * consistent no matter which screen initiated the write.
 */
import { and, desc, eq, isNull } from 'drizzle-orm';
import {
  accessLog,
  contacts,
  changeLog,
  documents,
  labResults,
  medFills,
  medications,
  observations,
  patients,
  settings,
  timelineEvents,
  vitals,
  type Contact,
  type DocumentRow,
  type LabResult,
  type MedFill,
  type Medication,
  type NewContact,
  type NewDocument,
  type NewLabResult,
  type NewMedication,
  type NewObservation,
  type NewPatient,
  type NewTimelineEvent,
  type NewVital,
  type Observation,
  type Patient,
  type TimelineEvent,
  type Vital,
} from '@rua/schema';
import {
  DEFAULT_PREFS,
  isHighAlert,
  latestFill,
  computeRunway,
  uuidv7,
  type NotificationPrefs,
  type Runway,
  type LocalDate,
} from '@rua/core';
import { getDb } from './client';
import { nowIso, today } from '../lib/clock';
import { bumpDataVersion } from '../lib/events';

/* ---------- change log ---------- */

function logChange(
  entity:
    | 'patient'
    | 'medication'
    | 'med_fill'
    | 'contact'
    | 'settings'
    | 'vital'
    | 'observation'
    | 'timeline_event'
    | 'lab_result'
    | 'document',
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
  appendMedChangeEvent(
    row.patientId,
    `Started ${row.name}${row.strength ? ` ${row.strength}` : ''}`,
    row.sig ?? undefined,
  );
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
  const changes = diff(before as Record<string, unknown>, patch);
  logChange('medication', id, before.patientId, 'update', changes);
  const meaningful = ['name', 'strength', 'sig', 'dosesPerDay'].filter((k) => k in changes);
  if (meaningful.length > 0) {
    const detail = meaningful
      .map((k) => `${k}: ${String(changes[k]?.from ?? 'none')} to ${String(changes[k]?.to ?? 'none')}`)
      .join('; ');
    appendMedChangeEvent(before.patientId, `${before.name} changed`, detail);
  }
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
  appendMedChangeEvent(before.patientId, `Stopped ${before.name}`);
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

/* ---------- Stage 3: vitals ---------- */

export function listVitals(patientId: string, kind?: Vital['kind']): Vital[] {
  const db = getDb();
  const where = kind
    ? and(eq(vitals.patientId, patientId), eq(vitals.kind, kind))
    : eq(vitals.patientId, patientId);
  return db.select().from(vitals).where(where).orderBy(desc(vitals.recordedAt)).all();
}

/** Latest reading per kind, for the Overview cards. */
export function latestVitals(patientId: string): Vital[] {
  const rows = listVitals(patientId);
  const seen = new Set<string>();
  const out: Vital[] = [];
  for (const v of rows) {
    if (!seen.has(v.kind)) {
      seen.add(v.kind);
      out.push(v);
    }
  }
  return out;
}

export function addVital(input: Omit<NewVital, 'id' | 'createdAt'>): Vital {
  const db = getDb();
  const row = { ...input, id: uuidv7(), createdAt: nowIso() };
  db.insert(vitals).values(row).run();
  logChange('vital', row.id, input.patientId, 'create', { kind: input.kind, value: input.value });
  return row as Vital;
}

/* ---------- Stage 3: observations ---------- */

export function listObservations(patientId: string): Observation[] {
  return getDb()
    .select()
    .from(observations)
    .where(eq(observations.patientId, patientId))
    .orderBy(desc(observations.at))
    .all();
}

export function addObservation(input: Omit<NewObservation, 'id' | 'createdAt'>): Observation {
  const db = getDb();
  const row = { ...input, id: uuidv7(), createdAt: nowIso() };
  db.insert(observations).values(row).run();
  logChange('observation', row.id, input.patientId, 'create', { kind: input.kind });
  return row as Observation;
}

/* ---------- Stage 3: history timeline ---------- */

export function listTimeline(patientId: string, kind?: TimelineEvent['kind']): TimelineEvent[] {
  const db = getDb();
  const where = kind
    ? and(eq(timelineEvents.patientId, patientId), eq(timelineEvents.kind, kind))
    : eq(timelineEvents.patientId, patientId);
  return db
    .select()
    .from(timelineEvents)
    .where(where)
    .orderBy(desc(timelineEvents.happenedOn), desc(timelineEvents.createdAt))
    .all();
}

export function addTimelineEvent(input: Omit<NewTimelineEvent, 'id' | 'createdAt'>): TimelineEvent {
  const db = getDb();
  const row = { ...input, id: uuidv7(), createdAt: nowIso() };
  db.insert(timelineEvents).values(row).run();
  logChange('timeline_event', row.id, input.patientId, 'create', { kind: input.kind, title: input.title });
  return row as TimelineEvent;
}

/**
 * P12 invariant: medication changes surface in the history timeline without
 * anyone writing them twice. Called from the medication write paths below.
 */
function appendMedChangeEvent(patientId: string, title: string, detail?: string) {
  getDb()
    .insert(timelineEvents)
    .values({
      id: uuidv7(),
      patientId,
      kind: 'med_change',
      title,
      detail: detail ?? null,
      happenedOn: today(),
      createdAt: nowIso(),
    })
    .run();
}

/* ---------- Stage 3: labs ---------- */

export function listLabs(patientId: string): LabResult[] {
  return getDb()
    .select()
    .from(labResults)
    .where(eq(labResults.patientId, patientId))
    .orderBy(desc(labResults.collectedOn))
    .all();
}

export function addLab(input: Omit<NewLabResult, 'id' | 'createdAt'>): LabResult {
  const db = getDb();
  const row = { ...input, id: uuidv7(), createdAt: nowIso() };
  db.insert(labResults).values(row).run();
  logChange('lab_result', row.id, input.patientId, 'create', { name: input.name });
  return row as LabResult;
}

/* ---------- Stage 3: documents vault ---------- */

export function listDocuments(patientId: string): DocumentRow[] {
  return getDb()
    .select()
    .from(documents)
    .where(and(eq(documents.patientId, patientId), isNull(documents.archivedAt)))
    .orderBy(desc(documents.addedAt))
    .all();
}

export function addDocument(input: Omit<NewDocument, 'id' | 'addedAt'>): DocumentRow {
  const db = getDb();
  const row = { ...input, id: uuidv7(), addedAt: nowIso() };
  db.insert(documents).values(row).run();
  logChange('document', row.id, input.patientId, 'create', {
    title: input.title,
    category: input.category,
  });
  return row as DocumentRow;
}

export function updateDocument(
  id: string,
  patch: { title?: string; category?: DocumentRow['category'] },
): DocumentRow {
  const db = getDb();
  const before = db.select().from(documents).where(eq(documents.id, id)).get();
  if (!before) throw new Error('Document not found');
  db.update(documents).set(patch).where(eq(documents.id, id)).run();
  logChange('document', id, before.patientId, 'update', diff(before as Record<string, unknown>, patch));
  return db.select().from(documents).where(eq(documents.id, id)).get()!;
}

export function archiveDocument(id: string): void {
  const db = getDb();
  const doc = db.select().from(documents).where(eq(documents.id, id)).get();
  if (!doc) return;
  db.update(documents).set({ archivedAt: nowIso() }).where(eq(documents.id, id)).run();
  logChange('document', id, doc.patientId, 'archive');
}

/* ---------- Stage 3: access log (sensitive reads) ---------- */

export function logAccess(what: string, patientId?: string | null): void {
  getDb()
    .insert(accessLog)
    .values({ id: uuidv7(), at: nowIso(), actor: 'owner', what, patientId: patientId ?? null })
    .run();
}

export function listAccessLog(limit = 200): { id: string; at: string; actor: string; what: string; patientId: string | null }[] {
  return getDb().select().from(accessLog).orderBy(desc(accessLog.at)).limit(limit).all();
}

/* ---------- generic settings (app lock etc.) ---------- */

export function getSetting<T>(key: string, fallback: T): T {
  try {
    const row = getDb().select().from(settings).where(eq(settings.key, key)).get();
    return row ? (row.value as T) : fallback;
  } catch {
    // Reading a setting must never crash a shield; fall back quietly.
    return fallback;
  }
}

export function setSetting(key: string, value: unknown): void {
  const db = getDb();
  const now = nowIso();
  db.insert(settings)
    .values({ key, value, updatedAt: now })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: now } })
    .run();
  logChange('settings', key, null, 'update', { key });
}
