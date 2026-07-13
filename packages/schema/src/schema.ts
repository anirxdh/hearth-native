import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

/**
 * Hearth schema, phase 1 baseline.
 *
 * Conventions (locked in P1, relied on by sync in P30):
 * - ids are UUIDv7 strings (time-ordered, generated in @hearth/core)
 * - instants are ISO-8601 UTC strings in *At columns; the wall-clock zone
 *   they were recorded in travels separately in *Tz columns where it matters
 * - calendar dates with no time component (fill dates, DOB) are 'YYYY-MM-DD'
 *   local-date strings; the runway engine treats them as caregiver-local days
 * - soft delete via archivedAt; hard delete only through the data-wipe path
 * - every consequential write appends to changeLog (never updated, never deleted)
 */

export const patients = sqliteTable('patients', {
  id: text('id').primaryKey(),
  fullName: text('full_name').notNull(),
  preferredName: text('preferred_name'),
  photoUri: text('photo_uri'),
  dob: text('dob'), // YYYY-MM-DD
  relationship: text('relationship'), // e.g. "Dad", "Mom", "Aunt"
  pronouns: text('pronouns'),
  conditions: text('conditions', { mode: 'json' }).$type<string[]>().notNull().default([]),
  allergies: text('allergies', { mode: 'json' })
    .$type<{ name: string; reaction: string; severe: boolean }[]>()
    .notNull()
    .default([]),
  notes: text('notes'),
  /** Caregiver-authority attestation captured at add-patient (P4 framework). */
  attestationText: text('attestation_text'),
  attestationAt: text('attestation_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  archivedAt: text('archived_at'),
});

export const contacts = sqliteTable(
  'contacts',
  {
    id: text('id').primaryKey(),
    patientId: text('patient_id')
      .notNull()
      .references(() => patients.id),
    name: text('name').notNull(),
    relation: text('relation'), // "daughter, POA", "cardiology"
    phone: text('phone'),
    kind: text('kind', { enum: ['emergency', 'provider', 'pharmacy', 'other'] })
      .notNull()
      .default('other'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    archivedAt: text('archived_at'),
  },
  (t) => [index('contacts_patient_idx').on(t.patientId)],
);

export const medications = sqliteTable(
  'medications',
  {
    id: text('id').primaryKey(),
    patientId: text('patient_id')
      .notNull()
      .references(() => patients.id),
    name: text('name').notNull(), // display name, e.g. "Metformin"
    strength: text('strength'), // "500 mg"
    form: text('form'), // tablet, capsule, injection...
    sig: text('sig'), // human schedule, e.g. "1 tablet, twice daily with meals"
    dosesPerDay: integer('doses_per_day'), // null for PRN
    prn: integer('prn', { mode: 'boolean' }).notNull().default(false),
    scheduleAnchor: text('schedule_anchor', {
      enum: ['morning', 'midday', 'evening', 'bedtime', 'fasting', 'other'],
    }),
    prescriber: text('prescriber'),
    pharmacy: text('pharmacy'),
    pharmacyPhone: text('pharmacy_phone'),
    rxNumber: text('rx_number'),
    /** RxNorm concept id when matched (P22); free text otherwise. */
    rxcui: text('rxcui'),
    /** Set true when the name/ingredient matches the bundled high-alert list. */
    highAlert: integer('high_alert', { mode: 'boolean' }).notNull().default(false),
    notes: text('notes'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    archivedAt: text('archived_at'),
  },
  (t) => [index('medications_patient_idx').on(t.patientId)],
);

/** Fill history is append-only; the newest fill drives the runway. */
export const medFills = sqliteTable(
  'med_fills',
  {
    id: text('id').primaryKey(),
    medicationId: text('medication_id')
      .notNull()
      .references(() => medications.id),
    fillDate: text('fill_date').notNull(), // YYYY-MM-DD, caregiver-local
    daySupply: integer('day_supply').notNull(),
    quantity: integer('quantity'),
    source: text('source', { enum: ['manual', 'scan'] }).notNull().default('manual'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('med_fills_medication_idx').on(t.medicationId)],
);

/**
 * Append-only audit of consequential writes. Never updated, never deleted;
 * doubles as the change feed the P30 sync engine will ship.
 */
export const changeLog = sqliteTable(
  'change_log',
  {
    id: text('id').primaryKey(),
    at: text('at').notNull(),
    actor: text('actor').notNull().default('owner'),
    entity: text('entity', {
      enum: ['patient', 'medication', 'med_fill', 'contact', 'settings', 'vital', 'observation', 'timeline_event', 'lab_result', 'document'],
    }).notNull(),
    entityId: text('entity_id').notNull(),
    patientId: text('patient_id'),
    action: text('action', { enum: ['create', 'update', 'archive', 'restore'] }).notNull(),
    /** JSON: { field: { from, to } } for updates; full snapshot for creates. */
    detail: text('detail', { mode: 'json' }).$type<Record<string, unknown>>(),
  },
  (t) => [index('change_log_entity_idx').on(t.entity, t.entityId), index('change_log_at_idx').on(t.at)],
);

/** Append-only log of sensitive reads (exports, future shared access). */
export const accessLog = sqliteTable(
  'access_log',
  {
    id: text('id').primaryKey(),
    at: text('at').notNull(),
    actor: text('actor').notNull().default('owner'),
    what: text('what').notNull(), // e.g. "er_sheet.print", "backup.export"
    patientId: text('patient_id'),
  },
  (t) => [index('access_log_at_idx').on(t.at)],
);

/** Single-row-per-key app settings (notification prefs etc.), JSON values. */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).$type<unknown>(),
  updatedAt: text('updated_at').notNull(),
});

export type Patient = typeof patients.$inferSelect;
export type NewPatient = typeof patients.$inferInsert;
export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type Medication = typeof medications.$inferSelect;
export type NewMedication = typeof medications.$inferInsert;
export type MedFill = typeof medFills.$inferSelect;
export type NewMedFill = typeof medFills.$inferInsert;
export type ChangeLogEntry = typeof changeLog.$inferSelect;
export type SettingsRow = typeof settings.$inferSelect;

/* ───────────────────────── Stage 3 additions (migration 0001) ───────────────────────── */

/**
 * Manual vitals: blood pressure stores systolic in `value` and diastolic in
 * `value2`; every other kind uses `value` alone. Values are numbers; display
 * formatting lives in the app.
 */
export const vitals = sqliteTable(
  'vitals',
  {
    id: text('id').primaryKey(),
    patientId: text('patient_id')
      .notNull()
      .references(() => patients.id),
    kind: text('kind', {
      enum: ['bp', 'weight', 'glucose', 'spo2', 'temp', 'hr'],
    }).notNull(),
    value: integer('value', { mode: 'number' }).notNull(),
    value2: integer('value2', { mode: 'number' }),
    unit: text('unit').notNull(), // "mmHg", "lb", "mg/dL", "%", "F", "bpm"
    recordedOn: text('recorded_on').notNull(), // YYYY-MM-DD caregiver-local
    recordedAt: text('recorded_at').notNull(), // full instant, for ordering
    note: text('note'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('vitals_patient_kind_idx').on(t.patientId, t.kind, t.recordedAt)],
);

/** Caregiver observations: the soft signal log a prep sheet is built from. */
export const observations = sqliteTable(
  'observations',
  {
    id: text('id').primaryKey(),
    patientId: text('patient_id')
      .notNull()
      .references(() => patients.id),
    kind: text('kind', {
      enum: ['mood', 'appetite', 'sleep', 'incident', 'note'],
    }).notNull(),
    text: text('text').notNull(),
    at: text('at').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('observations_patient_idx').on(t.patientId, t.at)],
);

/**
 * Unified medical history. Medication changes are appended automatically by
 * the repository write path; hand-entered events use the other kinds.
 * `happenedOn` may be a year ("2019") or a full date ("2026-05-03").
 */
export const timelineEvents = sqliteTable(
  'timeline_events',
  {
    id: text('id').primaryKey(),
    patientId: text('patient_id')
      .notNull()
      .references(() => patients.id),
    kind: text('kind', {
      enum: ['diagnosis', 'hospitalization', 'procedure', 'med_change', 'other'],
    }).notNull(),
    title: text('title').notNull(),
    detail: text('detail'),
    happenedOn: text('happened_on').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('timeline_patient_idx').on(t.patientId, t.happenedOn)],
);

/** Structured lab results with reference ranges; abnormal is precomputed. */
export const labResults = sqliteTable(
  'lab_results',
  {
    id: text('id').primaryKey(),
    patientId: text('patient_id')
      .notNull()
      .references(() => patients.id),
    name: text('name').notNull(), // "HbA1c"
    value: text('value').notNull(), // keep as text: "7.1", "<0.01"
    unit: text('unit'),
    refLow: text('ref_low'),
    refHigh: text('ref_high'),
    abnormal: integer('abnormal', { mode: 'boolean' }).notNull().default(false),
    collectedOn: text('collected_on').notNull(), // YYYY-MM-DD
    source: text('source'), // "Quest Diagnostics"
    note: text('note'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('labs_patient_idx').on(t.patientId, t.collectedOn)],
);

/**
 * Documents vault metadata. Files live in the app sandbox under
 * documents/vault/<id>.<ext>; iOS Data Protection covers the bytes, this
 * table carries only names and categories.
 */
export const documents = sqliteTable(
  'documents',
  {
    id: text('id').primaryKey(),
    patientId: text('patient_id')
      .notNull()
      .references(() => patients.id),
    title: text('title').notNull(),
    category: text('category', {
      enum: ['insurance', 'directive', 'discharge', 'lab', 'photo', 'other'],
    }).notNull().default('other'),
    fileName: text('file_name').notNull(), // relative to the vault dir
    mimeType: text('mime_type').notNull(),
    addedAt: text('added_at').notNull(),
    archivedAt: text('archived_at'),
  },
  (t) => [index('documents_patient_idx').on(t.patientId)],
);

export type Vital = typeof vitals.$inferSelect;
export type NewVital = typeof vitals.$inferInsert;
export type Observation = typeof observations.$inferSelect;
export type NewObservation = typeof observations.$inferInsert;
export type TimelineEvent = typeof timelineEvents.$inferSelect;
export type NewTimelineEvent = typeof timelineEvents.$inferInsert;
export type LabResult = typeof labResults.$inferSelect;
export type NewLabResult = typeof labResults.$inferInsert;
export type DocumentRow = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
