/**
 * Seed round-trip: seedDemoFamily writes the demo family relative to a fixed
 * `today`, and everything reads back field-for-field, including JSON columns
 * and the fill inputs the runway engine depends on.
 */

import { addDays, computeRunway, daysBetween } from '@rua/core';
import { eq } from 'drizzle-orm';

import { seedDemoFamily } from '../seed';
import {
  changeLog,
  contacts,
  medFills,
  medications,
  patients,
} from '../schema';
import { openMigratedDb } from './support/testDb';

const TODAY = '2026-07-12';

describe('seedDemoFamily', () => {
  const { sqlite, db } = openMigratedDb();
  let result: Awaited<ReturnType<typeof seedDemoFamily>>;

  beforeAll(async () => {
    result = await seedDemoFamily(db, TODAY);
  });

  afterAll(() => sqlite.close());

  test('inserts exactly the demo family', async () => {
    const all = await db.select().from(patients);
    expect(all.map((p) => p.fullName).sort()).toEqual([
      'Eleanor Alvarez',
      'Robert Alvarez',
      'Rosa Marquez',
    ]);
  });

  test('Robert reads back field-for-field, including JSON columns', async () => {
    const [robert] = await db
      .select()
      .from(patients)
      .where(eq(patients.id, result.patientIds.robert));
    expect(robert).toBeDefined();
    expect(robert!.fullName).toBe('Robert Alvarez');
    expect(robert!.relationship).toBe('Dad');
    expect(robert!.pronouns).toBe('he/him');
    expect(robert!.conditions).toEqual([
      'Type 2 diabetes',
      'Hypertension',
      'Atrial fibrillation',
    ]);
    expect(robert!.allergies).toEqual([
      { name: 'Penicillin', reaction: 'Anaphylaxis', severe: true },
    ]);
    expect(robert!.archivedAt).toBeNull();
    expect(robert!.attestationText).toBeTruthy();
  });

  test('ages are computed relative to today', async () => {
    const expectAge = async (id: string, age: number) => {
      const [p] = await db.select().from(patients).where(eq(patients.id, id));
      expect(p!.dob).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Math.floor(daysBetween(p!.dob!, TODAY) / 365.25)).toBe(age);
    };
    await expectAge(result.patientIds.robert, 81);
    await expectAge(result.patientIds.eleanor, 78);
    await expectAge(result.patientIds.rosa, 74);
  });

  test('contacts include Maria as daughter POA with the documented phone', async () => {
    const robertContacts = await db
      .select()
      .from(contacts)
      .where(eq(contacts.patientId, result.patientIds.robert));
    const maria = robertContacts.find((c) => c.name === 'Maria Alvarez');
    expect(maria).toMatchObject({
      relation: 'daughter, POA',
      phone: '(415) 555-0182',
      kind: 'emergency',
    });
    expect(robertContacts.map((c) => c.kind).sort()).toEqual([
      'emergency',
      'emergency',
      'pharmacy',
      'provider',
      'provider',
    ]);
    expect(await db.select().from(contacts)).toHaveLength(14);
  });

  test('all nine medications exist with expected flags', async () => {
    const meds = await db.select().from(medications);
    expect(meds).toHaveLength(9);

    const byId = (id: string) => meds.find((m) => m.id === id)!;
    expect(byId(result.medicationIds['robert.apixaban']!).highAlert).toBe(true);
    expect(byId(result.medicationIds['robert.metformin']!).highAlert).toBe(false);

    const ibuprofen = byId(result.medicationIds['rosa.ibuprofen']!);
    expect(ibuprofen.prn).toBe(true);
    expect(ibuprofen.dosesPerDay).toBeNull();
    expect(meds.every((m) => m.active)).toBe(true);
  });

  test('Robert metformin fill produces a 4 day runway', async () => {
    const fills = await db
      .select()
      .from(medFills)
      .where(eq(medFills.medicationId, result.medicationIds['robert.metformin']!));
    expect(fills).toHaveLength(1);
    const fill = fills[0]!;
    expect(fill.daySupply).toBe(30);
    expect(fill.quantity).toBe(60);
    expect(fill.source).toBe('manual');
    expect(fill.fillDate).toBe(addDays(TODAY, -27));

    const runway = computeRunway({ fillDate: fill.fillDate, daySupply: fill.daySupply }, TODAY);
    expect(runway.daysRemaining).toBe(3);
    expect(runway.status).toBe('urgent');
  });

  test('remaining runways match the demo script', async () => {
    const daysFor = async (medKey: string) => {
      const fills = await db
        .select()
        .from(medFills)
        .where(eq(medFills.medicationId, result.medicationIds[medKey]!));
      expect(fills).toHaveLength(1);
      const f = fills[0]!;
      return computeRunway({ fillDate: f.fillDate, daySupply: f.daySupply }, TODAY).daysRemaining;
    };
    expect(await daysFor('robert.apixaban')).toBe(12);
    expect(await daysFor('eleanor.sertraline')).toBe(12);
    expect(await daysFor('rosa.levothyroxine')).toBe(32);
    expect(await daysFor('robert.lisinopril')).toBeGreaterThan(30);
    expect(await daysFor('eleanor.donepezil')).toBeGreaterThan(10);

    const prnFills = await db
      .select()
      .from(medFills)
      .where(eq(medFills.medicationId, result.medicationIds['rosa.ibuprofen']!));
    expect(prnFills).toHaveLength(0);
    expect(await db.select().from(medFills)).toHaveLength(8);
  });

  test('every insert appended a change_log create row', async () => {
    const log = await db.select().from(changeLog);
    expect(log.every((e) => e.action === 'create')).toBe(true);

    const count = (entity: string) => log.filter((e) => e.entity === entity).length;
    expect(count('patient')).toBe(3);
    expect(count('contact')).toBe(14);
    expect(count('medication')).toBe(9);
    expect(count('med_fill')).toBe(8);
    expect(count('vital')).toBe(106);
    expect(count('observation')).toBe(7);
    expect(count('timeline_event')).toBe(11);
    expect(count('lab_result')).toBe(8);
    expect(log).toHaveLength(166);
  });

  test('change_log detail carries a full JSON snapshot of the create', async () => {
    const log = await db.select().from(changeLog);
    const robertCreate = log.find(
      (e) => e.entity === 'patient' && e.entityId === result.patientIds.robert,
    );
    expect(robertCreate).toBeDefined();
    expect(robertCreate!.patientId).toBe(result.patientIds.robert);
    const detail = robertCreate!.detail as Record<string, unknown>;
    expect(detail['fullName']).toBe('Robert Alvarez');
    expect(detail['relationship']).toBe('Dad');
  });
});
