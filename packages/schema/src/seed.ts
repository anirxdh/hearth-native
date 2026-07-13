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
  NewLabResult,
  NewMedFill,
  NewMedication,
  NewObservation,
  NewPatient,
  NewTimelineEvent,
  NewVital,
  contacts,
  labResults,
  medFills,
  medications,
  observations,
  patients,
  timelineEvents,
  vitals,
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


  /* ─────────────── Stage 3 demo data: vitals, observations, history, labs ─────────────── */

  /** Deterministic wobble in [-1, 1] so series look alive but seed identically. */
  const wobble = (i: number, phase: number) => Math.sin(i * 1.7 + phase) * 0.7 + Math.sin(i * 0.43 + phase * 2) * 0.3;

  async function addVital(row: Omit<NewVital, 'id' | 'createdAt'>) {
    const id = nextId();
    const values = { ...row, id, createdAt: now };
    await db.insert(vitals).values(values);
    await logChange(db, {
      at: now,
      entity: 'vital',
      entityId: id,
      patientId: row.patientId,
      action: 'create',
      detail: snapshot(values),
    });
    return id;
  }

  async function addObservation(row: Omit<NewObservation, 'id' | 'createdAt'>) {
    const id = nextId();
    const values = { ...row, id, createdAt: now };
    await db.insert(observations).values(values);
    await logChange(db, {
      at: now,
      entity: 'observation',
      entityId: id,
      patientId: row.patientId,
      action: 'create',
      detail: snapshot(values),
    });
    return id;
  }

  async function addTimelineEvent(row: Omit<NewTimelineEvent, 'id' | 'createdAt'>) {
    const id = nextId();
    const values = { ...row, id, createdAt: now };
    await db.insert(timelineEvents).values(values);
    await logChange(db, {
      at: now,
      entity: 'timeline_event',
      entityId: id,
      patientId: row.patientId,
      action: 'create',
      detail: snapshot(values),
    });
    return id;
  }

  async function addLab(row: Omit<NewLabResult, 'id' | 'createdAt'>) {
    const id = nextId();
    const values = { ...row, id, createdAt: now };
    await db.insert(labResults).values(values);
    await logChange(db, {
      at: now,
      entity: 'lab_result',
      entityId: id,
      patientId: row.patientId,
      action: 'create',
      detail: snapshot(values),
    });
    return id;
  }

  const instantOn = (d: LocalDate, hour: number) =>
    `${d}T${String(hour).padStart(2, '0')}:00:00.000Z`;

  // Robert: 90 days of weekly weight (gentle decline), 30 days of BP and
  // fasting glucose, 30 days of resting HR drifting up ~6 bpm in the last
  // two weeks. The HR drift is the story his Activity tab should tell.
  for (let i = 12; i >= 0; i--) {
    const d = addDays(today, -i * 7);
    await addVital({
      patientId: robert, kind: 'weight', unit: 'lb',
      value: Math.round(186 - (12 - i) * 0.35 + wobble(i, 1) * 1.2),
      recordedOn: d, recordedAt: instantOn(d, 8),
    });
  }
  for (let i = 29; i >= 0; i--) {
    const d = addDays(today, -i);
    if (i % 3 === 0) {
      await addVital({
        patientId: robert, kind: 'bp', unit: 'mmHg',
        value: Math.round(138 + wobble(i, 2) * 6),
        value2: Math.round(84 + wobble(i, 3) * 4),
        recordedOn: d, recordedAt: instantOn(d, 9),
      });
    }
    await addVital({
      patientId: robert, kind: 'glucose', unit: 'mg/dL',
      value: Math.round(124 + wobble(i, 4) * 14 + (i === 6 ? 24 : 0)),
      recordedOn: d, recordedAt: instantOn(d, 7),
    });
    const drift = i < 14 ? (14 - i) * 0.45 : 0;
    await addVital({
      patientId: robert, kind: 'hr', unit: 'bpm',
      value: Math.round(71 + drift + wobble(i, 5) * 2),
      recordedOn: d, recordedAt: instantOn(d, 10),
    });
  }
  await addObservation({
    patientId: robert, kind: 'incident',
    text: 'Dizzy this morning getting up from bed. Passed after a minute sitting down. He skipped dinner last night.',
    at: instantOn(addDays(today, -6), 8),
  });
  await addObservation({
    patientId: robert, kind: 'note',
    text: 'Resting heart rate has been creeping up for about two weeks. Worth raising at the cardiology visit.',
    at: instantOn(addDays(today, -2), 20),
  });
  await addObservation({
    patientId: robert, kind: 'appetite',
    text: 'Eating well this week. Finished the lentil soup and asked for seconds on Tuesday.',
    at: instantOn(addDays(today, -3), 19),
  });

  await addTimelineEvent({ patientId: robert, kind: 'diagnosis', title: 'Hypertension diagnosed', happenedOn: '2008', });
  await addTimelineEvent({ patientId: robert, kind: 'diagnosis', title: 'Type 2 diabetes diagnosed', detail: 'Started metformin.', happenedOn: '2011' });
  await addTimelineEvent({ patientId: robert, kind: 'procedure', title: 'Cataract surgery, right eye', happenedOn: '2019' });
  await addTimelineEvent({ patientId: robert, kind: 'diagnosis', title: 'Atrial fibrillation diagnosed', detail: 'Started apixaban, a blood thinner.', happenedOn: '2022' });
  await addTimelineEvent({ patientId: robert, kind: 'hospitalization', title: 'Pneumonia, 5-day stay', detail: 'Full recovery.', happenedOn: '2023' });
  await addTimelineEvent({ patientId: robert, kind: 'diagnosis', title: 'Right knee osteoarthritis', detail: 'Managed with physical therapy and acetaminophen.', happenedOn: '2024' });
  await addTimelineEvent({ patientId: robert, kind: 'hospitalization', title: 'Observation stay for chest pain', detail: 'Two nights. Heart attack ruled out; stress test normal.', happenedOn: addDays(today, -70) });

  const robertLabsOn = addDays(today, -100);
  await addLab({ patientId: robert, name: 'HbA1c', value: '7.1', unit: '%', refLow: '4.0', refHigh: '5.6', abnormal: true, collectedOn: robertLabsOn, source: 'Quest Diagnostics' });
  await addLab({ patientId: robert, name: 'LDL cholesterol', value: '88', unit: 'mg/dL', refHigh: '100', abnormal: false, collectedOn: robertLabsOn, source: 'Quest Diagnostics', note: 'At goal on statin.' });
  await addLab({ patientId: robert, name: 'eGFR', value: '68', unit: 'mL/min', refLow: '90', abnormal: true, collectedOn: robertLabsOn, source: 'Quest Diagnostics', note: 'Mildly reduced. Relevant to metformin dosing, per Dr. Okafor.' });
  await addLab({ patientId: robert, name: 'Potassium', value: '4.2', unit: 'mmol/L', refLow: '3.5', refHigh: '5.1', abnormal: false, collectedOn: robertLabsOn, source: 'Quest Diagnostics' });

  // Eleanor: stable weight and BP; the signal lives in her sleep observations.
  for (let i = 8; i >= 0; i--) {
    const d = addDays(today, -i * 7);
    await addVital({
      patientId: eleanor, kind: 'weight', unit: 'lb',
      value: Math.round(138 + wobble(i, 6) * 1.1),
      recordedOn: d, recordedAt: instantOn(d, 8),
    });
    await addVital({
      patientId: eleanor, kind: 'bp', unit: 'mmHg',
      value: Math.round(128 + wobble(i, 7) * 5),
      value2: Math.round(78 + wobble(i, 8) * 3),
      recordedOn: d, recordedAt: instantOn(d, 9),
    });
  }
  await addObservation({ patientId: eleanor, kind: 'sleep', text: 'Up at 4 again. About six hours total. Third short night this week.', at: instantOn(addDays(today, -1), 7) });
  await addObservation({ patientId: eleanor, kind: 'incident', text: 'Hard evening. Anxious after 6 PM, settled with the photo album and her playlist.', at: instantOn(addDays(today, -2), 21) });
  await addObservation({ patientId: eleanor, kind: 'mood', text: 'Bright morning. Told the story about the Chennai train trip and laughed a lot.', at: instantOn(addDays(today, -4), 11) });

  await addTimelineEvent({ patientId: eleanor, kind: 'diagnosis', title: 'Hypertension diagnosed', happenedOn: '2018' });
  await addTimelineEvent({ patientId: eleanor, kind: 'diagnosis', title: 'Osteoporosis diagnosed', detail: 'After a wrist fracture from a minor fall.', happenedOn: '2020' });
  await addTimelineEvent({ patientId: eleanor, kind: 'diagnosis', title: 'Early-stage Alzheimer\'s disease diagnosed', detail: 'Started donepezil with Dr. Patel.', happenedOn: '2024' });

  const eleanorLabsOn = addDays(today, -60);
  await addLab({ patientId: eleanor, name: 'Vitamin D, 25-OH', value: '24', unit: 'ng/mL', refLow: '30', refHigh: '100', abnormal: true, collectedOn: eleanorLabsOn, source: 'LabCorp', note: 'Low. Dr. Patel suggested discussing a supplement at the next visit.' });
  await addLab({ patientId: eleanor, name: 'Vitamin B12', value: '380', unit: 'pg/mL', refLow: '200', refHigh: '900', abnormal: false, collectedOn: eleanorLabsOn, source: 'LabCorp' });
  await addLab({ patientId: eleanor, name: 'TSH', value: '1.9', unit: 'mIU/L', refLow: '0.4', refHigh: '4.0', abnormal: false, collectedOn: eleanorLabsOn, source: 'LabCorp' });

  // Rosa: light data on purpose; her "all good" status should feel earned.
  for (let i = 4; i >= 0; i--) {
    const d = addDays(today, -i * 14);
    await addVital({
      patientId: rosa, kind: 'weight', unit: 'lb',
      value: Math.round(150 + wobble(i, 9)),
      recordedOn: d, recordedAt: instantOn(d, 8),
    });
  }
  await addObservation({ patientId: rosa, kind: 'note', text: 'Repotted the tomatoes. Knee held up fine on the garden steps.', at: instantOn(addDays(today, -5), 17) });
  await addTimelineEvent({ patientId: rosa, kind: 'diagnosis', title: 'Hypothyroidism diagnosed', detail: 'Started levothyroxine.', happenedOn: '2015' });
  const rosaLabsOn = addDays(today, -45);
  await addLab({ patientId: rosa, name: 'TSH', value: '2.8', unit: 'mIU/L', refLow: '0.4', refHigh: '4.0', abnormal: false, collectedOn: rosaLabsOn, source: 'Quest Diagnostics', note: 'Stable on 75 mcg.' });

  return { patientIds: { robert, eleanor, rosa }, medicationIds };
}
