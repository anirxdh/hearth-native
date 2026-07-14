/**
 * Appointment repository (P24). Same contract as repo.ts: every
 * consequential write generates ids and timestamps here and appends to the
 * append-only change log (entity 'appointment'), so screens can stay dumb
 * and the audit trail stays complete. Completing a visit also lands in the
 * patient's history timeline through the existing timeline write path.
 */
import { and, desc, eq, gte, isNull } from 'drizzle-orm';
import {
  appointments,
  changeLog,
  medications,
  type Appointment,
  type NewAppointment,
  type Patient,
} from '@hearth/schema';
import { addDays, uuidv7, type LocalDate } from '@hearth/core';
import { getDb } from './client';
import { nowIso } from '../lib/clock';
import { bumpDataVersion } from '../lib/events';
import { addTimelineEvent, listPatients } from './repo';
import type { PrepMedChange } from '../lib/prepSheet';

export interface AppointmentWithPatient extends Appointment {
  patient: Patient;
}

/* ---------- change log (entity 'appointment') ---------- */

function logApptChange(
  entityId: string,
  patientId: string | null,
  action: 'create' | 'update' | 'archive' | 'restore',
  detail?: Record<string, unknown>,
) {
  getDb()
    .insert(changeLog)
    .values({
      id: uuidv7(),
      at: nowIso(),
      entity: 'appointment',
      entityId,
      patientId,
      action,
      detail: detail ?? null,
    })
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

/* ---------- reads ---------- */

function getRow(id: string): Appointment | undefined {
  return getDb().select().from(appointments).where(eq(appointments.id, id)).get();
}

export function getAppointment(id: string): AppointmentWithPatient | undefined {
  const row = getRow(id);
  if (!row) return undefined;
  const patient = listPatients().find((p) => p.id === row.patientId);
  return patient ? { ...row, patient } : undefined;
}

/**
 * Every non-archived appointment (all statuses), joined to its patient and
 * sorted by date then time. Patient-first screens render straight from this.
 */
export function listAppointments(patientId?: string): AppointmentWithPatient[] {
  const db = getDb();
  const where = patientId
    ? and(eq(appointments.patientId, patientId), isNull(appointments.archivedAt))
    : isNull(appointments.archivedAt);
  const rows = db.select().from(appointments).where(where).all();
  const people = new Map(listPatients().map((p) => [p.id, p]));
  return rows
    .filter((a) => people.has(a.patientId))
    .map((a) => ({ ...a, patient: people.get(a.patientId)! }))
    .sort(
      (a, b) =>
        a.onDate.localeCompare(b.onDate) ||
        (a.atTime ?? '').localeCompare(b.atTime ?? '') ||
        a.id.localeCompare(b.id),
    );
}

/** Scheduled visits from today through today + days, soonest first. */
export function upcomingAppointments(today: LocalDate, days = 30): AppointmentWithPatient[] {
  const horizon = addDays(today, days);
  return listAppointments().filter(
    (a) => a.status === 'scheduled' && a.onDate >= today && a.onDate <= horizon,
  );
}

/* ---------- writes ---------- */

export function createAppointment(
  input: Omit<NewAppointment, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'postVisitNotes'>,
): Appointment {
  const now = nowIso();
  const row: NewAppointment = {
    ...input,
    id: uuidv7(),
    status: 'scheduled',
    createdAt: now,
    updatedAt: now,
  };
  getDb().insert(appointments).values(row).run();
  logApptChange(row.id!, row.patientId, 'create', {
    provider: row.provider,
    onDate: row.onDate,
  });
  return getRow(row.id!)!;
}

export function updateAppointment(id: string, patch: Partial<NewAppointment>): Appointment {
  const before = getRow(id);
  if (!before) throw new Error('Appointment not found');
  getDb()
    .update(appointments)
    .set({ ...patch, updatedAt: nowIso() })
    .where(eq(appointments.id, id))
    .run();
  logApptChange(id, before.patientId, 'update', diff(before as Record<string, unknown>, patch));
  return getRow(id)!;
}

/**
 * Mark the visit done and keep what happened: the notes live on the
 * appointment and a 'Visit: {provider}' event lands in the history timeline
 * (via the repo's existing timeline write path, which audits itself).
 */
export function completeVisit(id: string, postVisitNotes: string): Appointment {
  const before = getRow(id);
  if (!before) throw new Error('Appointment not found');
  const notes = postVisitNotes.trim();
  getDb()
    .update(appointments)
    .set({ status: 'done', postVisitNotes: notes, updatedAt: nowIso() })
    .where(eq(appointments.id, id))
    .run();
  logApptChange(id, before.patientId, 'update', {
    status: { from: before.status, to: 'done' },
    postVisitNotes: { from: before.postVisitNotes ?? null, to: notes },
  });
  addTimelineEvent({
    patientId: before.patientId,
    kind: 'other',
    title: `Visit: ${before.provider}`,
    detail: notes || null,
    happenedOn: before.onDate,
  });
  return getRow(id)!;
}

export function archiveAppointment(id: string): void {
  const before = getRow(id);
  if (!before) return;
  getDb()
    .update(appointments)
    .set({ archivedAt: nowIso(), updatedAt: nowIso() })
    .where(eq(appointments.id, id))
    .run();
  logApptChange(id, before.patientId, 'archive');
}

/* ---------- digest + prep sheet feeds ---------- */

/**
 * The soonest scheduled visit within the next 7 days, for the home digest.
 * Home wires this in itself; this module only answers the question.
 */
export function upcomingForDigest(
  today: LocalDate,
): { patientName: string; provider: string; onDate: LocalDate } | null {
  const next = upcomingAppointments(today, 7)[0];
  if (!next) return null;
  return {
    patientName: next.patient.preferredName ?? next.patient.fullName,
    provider: next.provider,
    onDate: next.onDate,
  };
}

/**
 * Medication change-log rows for a patient in the last 30 days, resolved to
 * display names for the prep sheet. Reads only; the pure rules live in
 * lib/prepSheet.ts.
 */
export function recentMedChanges(patientId: string, today: LocalDate): PrepMedChange[] {
  const db = getDb();
  const since = `${addDays(today, -30)}T00:00:00.000Z`;
  const rows = db
    .select()
    .from(changeLog)
    .where(
      and(
        eq(changeLog.entity, 'medication'),
        eq(changeLog.patientId, patientId),
        gte(changeLog.at, since),
      ),
    )
    .orderBy(desc(changeLog.at))
    .all();
  const names = new Map(
    db
      .select()
      .from(medications)
      .where(eq(medications.patientId, patientId))
      .all()
      .map((m) => [m.id, m.name]),
  );
  return rows.map((r) => {
    const detail = (r.detail ?? {}) as Record<string, unknown>;
    const fromDetail = typeof detail.name === 'string' ? detail.name : null;
    return {
      at: r.at,
      action: r.action,
      medName: names.get(r.entityId) ?? fromDetail ?? 'A medication',
      changedFields: r.action === 'update' ? Object.keys(detail) : [],
    };
  });
}
