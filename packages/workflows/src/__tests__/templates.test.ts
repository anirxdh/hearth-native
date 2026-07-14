import { ALL_TEMPLATES } from '../templates';
import { dischargeToHome } from '../templates/dischargeToHome';
import { hipaaRecordsRelease } from '../templates/hipaaRecordsRelease';
import { medicaidRenewal } from '../templates/medicaidRenewal';
import { newPatientIntake } from '../templates/newPatientIntake';
import { priorAuthorization } from '../templates/priorAuthorization';
import { MemoryStore } from '../store';
import { confirm, execute, userInputTemplate, validateGateBeforeSink } from '../runner';
import type { WorkflowBuilder } from '../builder';
import { fileVal, jsonVal, textVal, type InterNodeVal, type JsonVal } from '../values';
import type { RecordAccess } from '../executors';
import type { RunnerEnv } from '../runner';
import type { FullWorkflow } from '../model';

const NOW = '2026-07-14T12:00:00.000Z';

const ELEANOR: Record<string, unknown> = {
  fullName: 'Eleanor Whitfield',
  dob: '1941-09-03',
  conditions: 'Congestive heart failure, chronic kidney disease',
  caregiverLine: 'Daniel Whitfield, son and caregiver',
  medsList: 'Furosemide 40 mg daily; Carvedilol 6.25 mg twice daily; Atorvastatin 20 mg nightly',
};

const EXTRACTED = 'FIXTURE: text read from the uploaded document on this device.';

function records(written: Record<string, unknown>[]): RecordAccess {
  return {
    pullPatientFields: (_pid, fields) =>
      Object.fromEntries(fields.map((f) => [f, ELEANOR[f] ?? ''])),
    writePatientData: (_pid, data) => {
      written.push(data);
    },
  };
}

function makeEnv(store: MemoryStore, written: Record<string, unknown>[] = []): RunnerEnv {
  let n = 0;
  return {
    store,
    records: records(written),
    extractText: async () => EXTRACTED,
    now: () => NOW,
    newId: () => `id-${n++}`,
  };
}

function seed(store: MemoryStore, build: (now: string) => WorkflowBuilder): FullWorkflow {
  const w = build(NOW).buildStable(NOW);
  validateGateBeforeSink(w);
  store.addWorkflow(w);
  return w;
}

function inputLabels(w: FullWorkflow): string[] {
  return userInputTemplate(w)
    .userInputs.map((p) => p.label ?? p.name)
    .sort();
}

function inputId(w: FullWorkflow, needle: string): string {
  const t = userInputTemplate(w);
  const p = t.userInputs.find((u) =>
    (u.label ?? u.name).toLowerCase().includes(needle.toLowerCase()),
  );
  if (!p) throw new Error(`no user input matching "${needle}" in ${w.key}`);
  return p.id;
}

type Paused = { executionId: string; nodeId: string; bundle: JsonVal };

async function runToGate(
  env: RunnerEnv,
  w: FullWorkflow,
  inputs: { nodePropertyId: string; values: InterNodeVal[] }[],
): Promise<Paused> {
  const result = await execute(env, w.id, inputs, 'patient-eleanor');
  if (result.kind !== 'awaiting_confirm') {
    throw new Error(`expected pause, got ${result.kind}${'error' in result ? `: ${result.error}` : ''}`);
  }
  const bundle = result.payload[0];
  if (!bundle || bundle.type !== 'jsonv') throw new Error('expected a jsonv confirm bundle');
  return { executionId: result.executionId, nodeId: result.nodeId, bundle };
}

async function confirmAsIs(env: RunnerEnv, paused: Paused): Promise<string> {
  const done = await confirm(env, paused.executionId, paused.nodeId, [jsonVal(paused.bundle.json)]);
  if (done.kind !== 'completed') {
    throw new Error(`expected completed, got ${done.kind}${'error' in done ? `: ${done.error}` : ''}`);
  }
  const out = done.output[0];
  if (!out || out.type !== 'text') throw new Error('expected text output');
  return out.text;
}

describe('template registry', () => {
  test('ALL_TEMPLATES lists all six templates with matching keys and gated sinks', () => {
    expect(ALL_TEMPLATES.map((t) => t.key)).toEqual([
      'claim-denial-appeal',
      'hipaa-records-release',
      'prior-authorization',
      'medicaid-renewal',
      'discharge-to-home',
      'new-patient-intake',
    ]);
    for (const { key, build } of ALL_TEMPLATES) {
      const w = build(NOW).buildStable(NOW);
      expect(w.key).toBe(key);
      expect(w.id).toBe(key);
      expect(w.version).toBe(1);
      expect(() => validateGateBeforeSink(w)).not.toThrow();
    }
  });
});

describe('hipaa records release', () => {
  test('exposes exactly the expected caregiver inputs', () => {
    const w = seed(new MemoryStore(), hipaaRecordsRelease);
    expect(w.category).toBe('Records');
    expect(inputLabels(w)).toEqual(
      [
        'Patient',
        'Releasing provider or organization',
        'Receiving provider and fax or address',
        'Records date range',
        'Purpose of the release',
      ].sort(),
    );
  });

  test('pauses at the gate, then renders a signature-ready authorization', async () => {
    const store = new MemoryStore();
    const w = seed(store, hipaaRecordsRelease);
    const env = makeEnv(store);
    const paused = await runToGate(env, w, [
      { nodePropertyId: inputId(w, 'Patient'), values: [textVal('Eleanor Whitfield')] },
      { nodePropertyId: inputId(w, 'Releasing'), values: [textVal('Lakeside Family Medicine, Dr. Amara Osei')] },
      { nodePropertyId: inputId(w, 'Receiving'), values: [textVal('Cardiology Associates, Dr. Priya Raman, fax 555-0142')] },
      { nodePropertyId: inputId(w, 'date range'), values: [textVal('January 2025 through June 2026')] },
      { nodePropertyId: inputId(w, 'Purpose'), values: [textVal('Continuity of care with a new cardiologist')] },
    ]);
    expect(paused.bundle.json['fullName']).toBe('Eleanor Whitfield');
    expect(paused.bundle.json['Releasing provider']).toContain('Lakeside');

    const letter = await confirmAsIs(env, paused);
    expect(letter).toContain('AUTHORIZATION FOR RELEASE OF PROTECTED HEALTH INFORMATION');
    expect(letter).toContain('expires 1 year from the date of signature');
    expect(letter).toContain('Cardiology Associates, Dr. Priya Raman, fax 555-0142');
    expect(letter).toContain('Date: ______________________');
    expect(letter).not.toContain('{');
  });
});

describe('prior authorization', () => {
  test('exposes exactly the expected caregiver inputs', () => {
    const w = seed(new MemoryStore(), priorAuthorization);
    expect(w.category).toBe('Insurance & benefits');
    expect(inputLabels(w)).toEqual(
      [
        'Patient',
        'Medication or service needing authorization',
        'Prescriber name',
        'Insurance plan and member ID',
        'Clinical justification (from the prescriber note)',
        'Supporting document (prescriber note or records)',
      ].sort(),
    );
  });

  test('pauses at the gate, then renders the request with the attachment', async () => {
    const store = new MemoryStore();
    const w = seed(store, priorAuthorization);
    const env = makeEnv(store);
    const paused = await runToGate(env, w, [
      { nodePropertyId: inputId(w, 'Patient'), values: [textVal('Eleanor Whitfield')] },
      { nodePropertyId: inputId(w, 'Medication'), values: [textVal('Entresto 24/26 mg twice daily')] },
      { nodePropertyId: inputId(w, 'Prescriber name'), values: [textVal('Dr. Priya Raman')] },
      { nodePropertyId: inputId(w, 'Insurance plan'), values: [textVal('BlueCare Advantage, member ID XQR-4471-88')] },
      { nodePropertyId: inputId(w, 'Clinical justification'), values: [textVal('Symptomatic heart failure despite maximum tolerated lisinopril; guideline-directed therapy.')] },
      { nodePropertyId: inputId(w, 'Supporting document'), values: [fileVal('vault/prescriber-note.pdf', { name: 'prescriber-note.pdf' })] },
    ]);
    expect(paused.bundle.json['Supporting document text']).toBe(EXTRACTED);

    const letter = await confirmAsIs(env, paused);
    expect(letter).toContain('RE: Prior authorization request');
    expect(letter).toContain('Entresto 24/26 mg twice daily');
    expect(letter).toContain('BlueCare Advantage, member ID XQR-4471-88');
    expect(letter).toContain('ATTACHMENT: Supporting document');
    expect(letter).toContain(EXTRACTED);
    expect(letter).not.toContain('{');
  });
});

describe('medicaid renewal', () => {
  test('exposes exactly the expected caregiver inputs', () => {
    const w = seed(new MemoryStore(), medicaidRenewal);
    expect(w.category).toBe('Insurance & benefits');
    expect(inputLabels(w)).toEqual(
      [
        'Patient',
        'Case or renewal number',
        'Household size',
        'Monthly income summary',
        'Proof documents (pay stubs, award letters)',
      ].sort(),
    );
  });

  test('pauses at the gate, then renders the cover letter and checklist', async () => {
    const store = new MemoryStore();
    const w = seed(store, medicaidRenewal);
    const env = makeEnv(store);
    const paused = await runToGate(env, w, [
      { nodePropertyId: inputId(w, 'Patient'), values: [textVal('Eleanor Whitfield')] },
      { nodePropertyId: inputId(w, 'Case or renewal'), values: [textVal('MA-2026-5521')] },
      { nodePropertyId: inputId(w, 'Household'), values: [textVal('2 (member and caregiver)')] },
      { nodePropertyId: inputId(w, 'income'), values: [textVal('$1,480 Social Security; no other income')] },
      { nodePropertyId: inputId(w, 'Proof documents'), values: [fileVal('vault/award-letter.pdf', { name: 'award-letter.pdf' })] },
    ]);
    expect(paused.bundle.json['Case or renewal number']).toBe('MA-2026-5521');

    const packet = await confirmAsIs(env, paused);
    expect(packet).toContain('Case or renewal number: MA-2026-5521');
    expect(packet).toContain('DOCUMENT CHECKLIST');
    expect(packet).toContain('[ ] Proof of income for every earner in the household');
    expect(packet).toContain(EXTRACTED);
    expect(packet).not.toContain('{');
  });
});

describe('discharge to home', () => {
  test('exposes exactly the expected caregiver inputs', () => {
    const w = seed(new MemoryStore(), dischargeToHome);
    expect(w.category).toBe('Care transitions');
    expect(inputLabels(w)).toEqual(
      [
        'Patient',
        'Discharge summary document',
        'Discharging facility',
        'Follow-up appointments as stated',
      ].sort(),
    );
  });

  test('pauses at the gate, then renders the setup sheet with med reconciliation', async () => {
    const store = new MemoryStore();
    const w = seed(store, dischargeToHome);
    const env = makeEnv(store);
    const paused = await runToGate(env, w, [
      { nodePropertyId: inputId(w, 'Patient'), values: [textVal('Eleanor Whitfield')] },
      { nodePropertyId: inputId(w, 'Discharge summary'), values: [fileVal('vault/discharge.pdf', { name: 'discharge.pdf' })] },
      { nodePropertyId: inputId(w, 'Discharging facility'), values: [textVal('St. Vincent Medical Center')] },
      { nodePropertyId: inputId(w, 'Follow-up'), values: [textVal('Cardiology with Dr. Raman on July 22 at 10:00 AM')] },
    ]);
    expect(paused.bundle.json['Follow-up plan']).toBe('Cardiology with Dr. Raman on July 22 at 10:00 AM');

    const sheet = await confirmAsIs(env, paused);
    expect(sheet).toContain('MEDICATION RECONCILIATION');
    expect(sheet).toContain('Furosemide 40 mg daily');
    expect(sheet).toContain('Cardiology with Dr. Raman on July 22 at 10:00 AM');
    expect(sheet).toContain('call 911 first');
    expect(sheet).not.toContain('{');
  });

  test('an empty follow-up list falls back to the call-the-facility guidance', async () => {
    const store = new MemoryStore();
    const w = seed(store, dischargeToHome);
    const env = makeEnv(store);
    const paused = await runToGate(env, w, [
      { nodePropertyId: inputId(w, 'Patient'), values: [textVal('Eleanor Whitfield')] },
      { nodePropertyId: inputId(w, 'Discharge summary'), values: [fileVal('vault/discharge.pdf', { name: 'discharge.pdf' })] },
      { nodePropertyId: inputId(w, 'Discharging facility'), values: [textVal('St. Vincent Medical Center')] },
      { nodePropertyId: inputId(w, 'Follow-up'), values: [textVal('')] },
    ]);
    expect(paused.bundle.json['Follow-up plan']).toBe(
      'No follow-up appointments were listed. Call the discharging facility to confirm.',
    );
  });
});

describe('new patient intake', () => {
  test('exposes exactly the expected caregiver inputs', () => {
    const w = seed(new MemoryStore(), newPatientIntake);
    expect(w.category).toBe('Onboarding');
    expect(inputLabels(w)).toEqual(
      [
        'Patient',
        'Full name',
        'Date of birth',
        'Conditions (comma separated)',
        'Allergies (comma separated)',
        'Primary pharmacy',
      ].sort(),
    );
  });

  test('pauses at the gate, then writes the confirmed keys to the record', async () => {
    const store = new MemoryStore();
    const w = seed(store, newPatientIntake);
    const written: Record<string, unknown>[] = [];
    const env = makeEnv(store, written);
    const paused = await runToGate(env, w, [
      { nodePropertyId: inputId(w, 'Patient'), values: [textVal('Eleanor Whitfield')] },
      { nodePropertyId: inputId(w, 'Full name'), values: [textVal('Eleanor Whitfield')] },
      { nodePropertyId: inputId(w, 'Date of birth'), values: [textVal('1941-09-03')] },
      { nodePropertyId: inputId(w, 'Conditions'), values: [textVal('Congestive heart failure, chronic kidney disease')] },
      { nodePropertyId: inputId(w, 'Allergies'), values: [textVal('Penicillin, sulfa drugs')] },
      { nodePropertyId: inputId(w, 'Primary pharmacy'), values: [textVal('Lakeside Pharmacy, 41 Main St')] },
    ]);
    expect(paused.bundle.json).toEqual({
      fullName: 'Eleanor Whitfield',
      dob: '1941-09-03',
      conditions: 'Congestive heart failure, chronic kidney disease',
      allergies: 'Penicillin, sulfa drugs',
      primaryPharmacy: 'Lakeside Pharmacy, 41 Main St',
    });
    expect(written).toHaveLength(0); // nothing saved before confirm

    // the caregiver corrects an allergy during review
    const edited = { ...paused.bundle.json, allergies: 'Penicillin only' };
    const done = await confirm(env, paused.executionId, paused.nodeId, [jsonVal(edited)]);
    expect(done.kind).toBe('completed');
    if (done.kind !== 'completed') return;
    expect(done.output[0]).toEqual(textVal('saved'));
    expect(written).toHaveLength(1);
    expect(written[0]).toEqual(edited); // the EDIT won, with the confirmed keys
  });
});
