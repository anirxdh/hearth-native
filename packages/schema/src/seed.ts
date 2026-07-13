/**
 * Demo family seed: three fictional older adults with realistic medication
 * regimens and deliberately staggered refill runways so the dashboard has an
 * urgent story to tell on first launch.
 *
 * All dates are computed relative to the caller-supplied `today` so the demo
 * is always live: Robert's metformin sits at ~3 days of runway no matter when
 * the app is seeded. Every insert appends a change_log 'create' row.
 */

import { LocalDate, addDays, isHighAlert, uuidv7 } from '@hearth/core';

import { HearthDatabase, logChange } from './audit';
import {
  NewContact,
  NewMedFill,
  NewMedication,
  NewPatient,
  contacts,
  medFills,
  medications,
  patients,
} from './schema';

export interface SeedResult {
  patientIds: { robert: string; eleanor: string; rosa: string };
  /** Keyed 'robert.metformin', 'eleanor.sertraline', etc. */
  medicationIds: Record<string, string>;
}

export async function seedDemoFamily(db: HearthDatabase, today: LocalDate): Promise<SeedResult> {
  const now = `${today}T12:00:00.000Z`;
  const nowMs = Date.parse(now);
  let seq = 0;
  /** Strictly time-ordered ids so insertion order survives sorts by id. */
  const nextId = () => uuidv7(nowMs + seq++);

  /** A birth date that always yields the requested age relative to `today`. */
  const dobYearsAgo = (years: number): LocalDate =>
    addDays(today, -(Math.round(years * 365.25) + 30));

  /** Fill date such that runway (fillDate + daySupply - today) = daysRemaining. */
  const fillDateFor = (daysRemaining: number, daySupply: number): LocalDate =>
    addDays(today, daysRemaining - daySupply);

  const snapshot = (row: object): Record<string, unknown> => ({ ...row });

  async function addPatient(row: Omit<NewPatient, 'id' | 'createdAt' | 'updatedAt'>) {
    const id = nextId();
    const values = { ...row, id, createdAt: now, updatedAt: now };
    await db.insert(patients).values(values);
    await logChange(db, {
      at: now,
      entity: 'patient',
      entityId: id,
      patientId: id,
      action: 'create',
      detail: snapshot(values),
    });
    return id;
  }

  async function addContact(row: Omit<NewContact, 'id' | 'createdAt' | 'updatedAt'>) {
    const id = nextId();
    const values = { ...row, id, createdAt: now, updatedAt: now };
    await db.insert(contacts).values(values);
    await logChange(db, {
      at: now,
      entity: 'contact',
      entityId: id,
      patientId: row.patientId,
      action: 'create',
      detail: snapshot(values),
    });
    return id;
  }

  async function addMedication(row: Omit<NewMedication, 'id' | 'createdAt' | 'updatedAt' | 'highAlert'>) {
    const id = nextId();
    const values = { ...row, id, highAlert: isHighAlert(row.name), createdAt: now, updatedAt: now };
    await db.insert(medications).values(values);
    await logChange(db, {
      at: now,
      entity: 'medication',
      entityId: id,
      patientId: row.patientId,
      action: 'create',
      detail: snapshot(values),
    });
    return id;
  }

  async function addFill(patientId: string, row: Omit<NewMedFill, 'id' | 'createdAt'>) {
    const id = nextId();
    const values = { ...row, id, createdAt: `${row.fillDate}T12:00:00.000Z` };
    await db.insert(medFills).values(values);
    await logChange(db, {
      at: now,
      entity: 'med_fill',
      entityId: id,
      patientId,
      action: 'create',
      detail: snapshot(values),
    });
    return id;
  }

  // Patients

  const robert = await addPatient({
    fullName: 'Robert Alvarez',
    preferredName: 'Robert',
    dob: dobYearsAgo(81),
    relationship: 'Dad',
    pronouns: 'he/him',
    conditions: ['Type 2 diabetes', 'Hypertension', 'Atrial fibrillation'],
    allergies: [{ name: 'Penicillin', reaction: 'Anaphylaxis', severe: true }],
    attestationText: 'I help manage care for this person and am authorized to keep these records.',
    attestationAt: now,
  });

  const eleanor = await addPatient({
    fullName: 'Eleanor Alvarez',
    preferredName: 'Ellie',
    dob: dobYearsAgo(78),
    relationship: 'Mom',
    pronouns: 'she/her',
    conditions: ["Early-stage Alzheimer's disease", 'Hypertension', 'Osteoporosis'],
    allergies: [],
    attestationText: 'I help manage care for this person and am authorized to keep these records.',
    attestationAt: now,
  });

  const rosa = await addPatient({
    fullName: 'Rosa Marquez',
    preferredName: 'Rosa',
    dob: dobYearsAgo(74),
    relationship: 'Aunt',
    pronouns: 'she/her',
    conditions: ['Hypothyroidism'],
    allergies: [],
    attestationText: 'I help manage care for this person and am authorized to keep these records.',
    attestationAt: now,
  });

  // Contacts

  const missionPharmacy = {
    name: 'Mission Street Pharmacy',
    phone: '(415) 555-0134',
  };
  const excelsiorPharmacy = {
    name: 'Walgreens Excelsior',
    phone: '(415) 555-0171',
  };

  for (const patientId of [robert, eleanor]) {
    await addContact({
      patientId,
      name: 'Maria Alvarez',
      relation: 'daughter, POA',
      phone: '(415) 555-0182',
      kind: 'emergency',
      sortOrder: 0,
    });
    await addContact({
      patientId,
      name: 'Miguel Alvarez',
      relation: 'son',
      phone: '(415) 555-0147',
      kind: 'emergency',
      sortOrder: 1,
    });
    await addContact({
      patientId,
      name: 'Dr. Priya Natarajan',
      relation: 'primary care',
      phone: '(415) 555-0119',
      kind: 'provider',
      sortOrder: 2,
    });
  }
  await addContact({
    patientId: robert,
    name: 'Dr. Samuel Weiss',
    relation: 'cardiology',
    phone: '(415) 555-0128',
    kind: 'provider',
    sortOrder: 3,
  });
  await addContact({
    patientId: eleanor,
    name: 'Dr. Alan Reyes',
    relation: 'neurology',
    phone: '(415) 555-0163',
    kind: 'provider',
    sortOrder: 3,
  });
  for (const patientId of [robert, eleanor]) {
    await addContact({
      patientId,
      name: missionPharmacy.name,
      relation: 'pharmacy',
      phone: missionPharmacy.phone,
      kind: 'pharmacy',
      sortOrder: 4,
    });
  }

  await addContact({
    patientId: rosa,
    name: 'Maria Alvarez',
    relation: 'niece, POA',
    phone: '(415) 555-0182',
    kind: 'emergency',
    sortOrder: 0,
  });
  await addContact({
    patientId: rosa,
    name: 'Miguel Alvarez',
    relation: 'nephew',
    phone: '(415) 555-0147',
    kind: 'emergency',
    sortOrder: 1,
  });
  await addContact({
    patientId: rosa,
    name: 'Dr. Karen Liu',
    relation: 'endocrinology',
    phone: '(415) 555-0186',
    kind: 'provider',
    sortOrder: 2,
  });
  await addContact({
    patientId: rosa,
    name: excelsiorPharmacy.name,
    relation: 'pharmacy',
    phone: excelsiorPharmacy.phone,
    kind: 'pharmacy',
    sortOrder: 3,
  });

  // Medications and fills. Runways are staggered on purpose:
  // metformin ~3 days (urgent), apixaban and sertraline ~12 days (approaching),
  // levothyroxine ~32 days, everything else comfortable.

  const medicationIds: Record<string, string> = {};

  const robertMetformin = await addMedication({
    patientId: robert,
    name: 'Metformin',
    strength: '500 mg',
    form: 'tablet',
    sig: '1 tablet twice daily with meals',
    dosesPerDay: 2,
    scheduleAnchor: 'morning',
    prescriber: 'Dr. Priya Natarajan',
    pharmacy: missionPharmacy.name,
    pharmacyPhone: missionPharmacy.phone,
    rxNumber: 'RX-482913',
  });
  medicationIds['robert.metformin'] = robertMetformin;
  await addFill(robert, {
    medicationId: robertMetformin,
    fillDate: fillDateFor(3, 30),
    daySupply: 30,
    quantity: 60,
  });

  const robertApixaban = await addMedication({
    patientId: robert,
    name: 'Apixaban',
    strength: '5 mg',
    form: 'tablet',
    sig: '1 tablet twice daily, morning and evening',
    dosesPerDay: 2,
    scheduleAnchor: 'morning',
    prescriber: 'Dr. Samuel Weiss',
    pharmacy: missionPharmacy.name,
    pharmacyPhone: missionPharmacy.phone,
    rxNumber: 'RX-482920',
  });
  medicationIds['robert.apixaban'] = robertApixaban;
  await addFill(robert, {
    medicationId: robertApixaban,
    fillDate: fillDateFor(12, 30),
    daySupply: 30,
    quantity: 60,
  });

  const robertLisinopril = await addMedication({
    patientId: robert,
    name: 'Lisinopril',
    strength: '10 mg',
    form: 'tablet',
    sig: '1 tablet once daily in the morning',
    dosesPerDay: 1,
    scheduleAnchor: 'morning',
    prescriber: 'Dr. Priya Natarajan',
    pharmacy: missionPharmacy.name,
    pharmacyPhone: missionPharmacy.phone,
    rxNumber: 'RX-482931',
  });
  medicationIds['robert.lisinopril'] = robertLisinopril;
  await addFill(robert, {
    medicationId: robertLisinopril,
    fillDate: fillDateFor(64, 90),
    daySupply: 90,
    quantity: 90,
  });

  const robertAtorvastatin = await addMedication({
    patientId: robert,
    name: 'Atorvastatin',
    strength: '20 mg',
    form: 'tablet',
    sig: '1 tablet once daily at bedtime',
    dosesPerDay: 1,
    scheduleAnchor: 'bedtime',
    prescriber: 'Dr. Priya Natarajan',
    pharmacy: missionPharmacy.name,
    pharmacyPhone: missionPharmacy.phone,
    rxNumber: 'RX-482945',
  });
  medicationIds['robert.atorvastatin'] = robertAtorvastatin;
  await addFill(robert, {
    medicationId: robertAtorvastatin,
    fillDate: fillDateFor(58, 90),
    daySupply: 90,
    quantity: 90,
  });

  const eleanorDonepezil = await addMedication({
    patientId: eleanor,
    name: 'Donepezil',
    strength: '10 mg',
    form: 'tablet',
    sig: '1 tablet once daily at bedtime',
    dosesPerDay: 1,
    scheduleAnchor: 'bedtime',
    prescriber: 'Dr. Alan Reyes',
    pharmacy: missionPharmacy.name,
    pharmacyPhone: missionPharmacy.phone,
    rxNumber: 'RX-517203',
  });
  medicationIds['eleanor.donepezil'] = eleanorDonepezil;
  await addFill(eleanor, {
    medicationId: eleanorDonepezil,
    fillDate: fillDateFor(21, 30),
    daySupply: 30,
    quantity: 30,
  });

  const eleanorSertraline = await addMedication({
    patientId: eleanor,
    name: 'Sertraline',
    strength: '50 mg',
    form: 'tablet',
    sig: '1 tablet once daily in the morning',
    dosesPerDay: 1,
    scheduleAnchor: 'morning',
    prescriber: 'Dr. Priya Natarajan',
    pharmacy: missionPharmacy.name,
    pharmacyPhone: missionPharmacy.phone,
    rxNumber: 'RX-517211',
  });
  medicationIds['eleanor.sertraline'] = eleanorSertraline;
  await addFill(eleanor, {
    medicationId: eleanorSertraline,
    fillDate: fillDateFor(12, 30),
    daySupply: 30,
    quantity: 30,
  });

  const eleanorAmlodipine = await addMedication({
    patientId: eleanor,
    name: 'Amlodipine',
    strength: '5 mg',
    form: 'tablet',
    sig: '1 tablet once daily in the morning',
    dosesPerDay: 1,
    scheduleAnchor: 'morning',
    prescriber: 'Dr. Priya Natarajan',
    pharmacy: missionPharmacy.name,
    pharmacyPhone: missionPharmacy.phone,
    rxNumber: 'RX-517224',
  });
  medicationIds['eleanor.amlodipine'] = eleanorAmlodipine;
  await addFill(eleanor, {
    medicationId: eleanorAmlodipine,
    fillDate: fillDateFor(61, 90),
    daySupply: 90,
    quantity: 90,
  });

  const rosaLevothyroxine = await addMedication({
    patientId: rosa,
    name: 'Levothyroxine',
    strength: '75 mcg',
    form: 'tablet',
    sig: '1 tablet once daily on an empty stomach, 30 minutes before breakfast',
    dosesPerDay: 1,
    scheduleAnchor: 'fasting',
    prescriber: 'Dr. Karen Liu',
    pharmacy: excelsiorPharmacy.name,
    pharmacyPhone: excelsiorPharmacy.phone,
    rxNumber: 'RX-733410',
  });
  medicationIds['rosa.levothyroxine'] = rosaLevothyroxine;
  await addFill(rosa, {
    medicationId: rosaLevothyroxine,
    fillDate: fillDateFor(32, 90),
    daySupply: 90,
    quantity: 90,
  });

  // PRN med: no dosesPerDay and no fill, so the runway engine honestly
  // reports nothing instead of forecasting an as-needed medication.
  const rosaIbuprofen = await addMedication({
    patientId: rosa,
    name: 'Ibuprofen',
    strength: '200 mg',
    form: 'tablet',
    sig: '1 to 2 tablets every 6 hours as needed for pain',
    dosesPerDay: null,
    prn: true,
    prescriber: 'Dr. Karen Liu',
    pharmacy: excelsiorPharmacy.name,
    pharmacyPhone: excelsiorPharmacy.phone,
  });
  medicationIds['rosa.ibuprofen'] = rosaIbuprofen;

  return { patientIds: { robert, eleanor, rosa }, medicationIds };
}
