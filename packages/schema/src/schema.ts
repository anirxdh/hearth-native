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
      enum: ['patient', 'medication', 'med_fill', 'contact', 'settings', 'vital', 'observation', 'timeline_event', 'lab_result', 'document', 'appointment'],
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
      enum: ['bp', 'weight', 'glucose', 'spo2', 'temp', 'hr', 'steps', 'sleep', 'active_min'],
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

/* ───────────── Stage 6 additions (migration 0002): admin workflows ───────────── */

/**
 * The admin-workflow engine's persistence (see packages/workflows): template
 * definitions are seeded from bundled code at boot, version-checked; nodes
 * and properties mirror the nonlinear reference model where a property's
 * inputNodeId IS the edge. Executions and per-node outputs make runs
 * resumable across force-quits.
 */
export const wfWorkflows = sqliteTable('wf_workflows', {
  id: text('id').primaryKey(),
  key: text('key').notNull(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  estMinutes: integer('est_minutes').notNull(),
  replacesHours: text('replaces_hours').notNull(),
  version: integer('version').notNull(),
  createdAt: text('created_at').notNull(),
});

export const wfNodes = sqliteTable(
  'wf_nodes',
  {
    id: text('id').primaryKey(),
    workflowId: text('workflow_id')
      .notNull()
      .references(() => wfWorkflows.id),
    type: text('type').notNull(),
    description: text('description').notNull(),
    positionX: integer('position_x').notNull(),
    positionY: integer('position_y').notNull(),
  },
  (t) => [index('wf_nodes_workflow_idx').on(t.workflowId)],
);

export const wfNodeProperties = sqliteTable(
  'wf_node_properties',
  {
    id: text('id').primaryKey(),
    nodeId: text('node_id')
      .notNull()
      .references(() => wfNodes.id),
    name: text('name').notNull(),
    label: text('label'),
    /** THE EDGE: values flow from this node's output when set. */
    inputNodeId: text('input_node_id'),
    hidden: integer('hidden', { mode: 'boolean' }).notNull().default(false),
    /** Preset literal values as a JSON InterNodeVal[]. */
    values: text('values', { mode: 'json' }).$type<unknown[]>().notNull().default([]),
  },
  (t) => [index('wf_props_node_idx').on(t.nodeId)],
);

export const wfExecutions = sqliteTable(
  'wf_executions',
  {
    id: text('id').primaryKey(),
    workflowId: text('workflow_id')
      .notNull()
      .references(() => wfWorkflows.id),
    workflowVersion: integer('workflow_version').notNull(),
    patientId: text('patient_id'),
    status: text('status', {
      enum: ['running', 'awaiting_confirm', 'completed', 'failed', 'canceled'],
    }).notNull(),
    awaitingNodeId: text('awaiting_node_id'),
    error: text('error'),
    startedAt: text('started_at').notNull(),
    finishedAt: text('finished_at'),
  },
  (t) => [index('wf_exec_workflow_idx').on(t.workflowId, t.startedAt)],
);

export const wfExecutionInputs = sqliteTable(
  'wf_execution_inputs',
  {
    id: text('id').primaryKey(),
    executionId: text('execution_id')
      .notNull()
      .references(() => wfExecutions.id),
    nodePropertyId: text('node_property_id').notNull(),
    values: text('values', { mode: 'json' }).$type<unknown[]>().notNull(),
  },
  (t) => [index('wf_exec_inputs_idx').on(t.executionId)],
);

export const wfExecutionOutputs = sqliteTable(
  'wf_execution_outputs',
  {
    id: text('id').primaryKey(),
    executionId: text('execution_id')
      .notNull()
      .references(() => wfExecutions.id),
    nodeId: text('node_id').notNull(),
    output: text('output', { mode: 'json' }).$type<unknown[]>().notNull(),
    at: text('at').notNull(),
  },
  (t) => [index('wf_exec_outputs_idx').on(t.executionId, t.nodeId)],
);

/* ───────────── Stage 5 additions (same migration): appointments ───────────── */

export const appointments = sqliteTable(
  'appointments',
  {
    id: text('id').primaryKey(),
    patientId: text('patient_id')
      .notNull()
      .references(() => patients.id),
    provider: text('provider').notNull(), // "Dr. Chen"
    specialty: text('specialty'), // "cardiology"
    location: text('location'),
    phone: text('phone'),
    /** Local calendar date + optional time, caregiver-local. */
    onDate: text('on_date').notNull(), // YYYY-MM-DD
    atTime: text('at_time'), // "09:30"
    driver: text('driver'), // who is taking them
    bring: text('bring'), // "sleep log"
    purpose: text('purpose'),
    postVisitNotes: text('post_visit_notes'),
    status: text('status', { enum: ['scheduled', 'done', 'canceled'] })
      .notNull()
      .default('scheduled'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    archivedAt: text('archived_at'),
  },
  (t) => [index('appointments_patient_idx').on(t.patientId, t.onDate)],
);

export type WfWorkflowRow = typeof wfWorkflows.$inferSelect;
export type WfNodeRow = typeof wfNodes.$inferSelect;
export type WfNodePropertyRow = typeof wfNodeProperties.$inferSelect;
export type WfExecutionRow = typeof wfExecutions.$inferSelect;
export type WfExecutionOutputRow = typeof wfExecutionOutputs.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;
