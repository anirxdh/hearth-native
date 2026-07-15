import { claimDenialAppeal } from '../templates/claimDenialAppeal';
import { MemoryStore } from '../store';
import { cancel, confirm, execute, resume, sinkNode, userInputTemplate, validateGateBeforeSink } from '../runner';
import { WorkflowBuilder } from '../builder';
import { fileVal, jsonVal, textVal, type InterNodeVal } from '../values';
import type { RecordAccess } from '../executors';
import type { RunnerEnv } from '../runner';

const NOW = '2026-07-14T12:00:00.000Z';

const ROBERT: Record<string, unknown> = {
  fullName: 'Robert Alvarez',
  dob: '1945-02-14',
  conditions: 'Type 2 diabetes, atrial fibrillation, hypertension',
  caregiverLine: 'Maria Alvarez, daughter and caregiver',
};

function records(written: Record<string, unknown>[] = []): RecordAccess {
  return {
    pullPatientFields: (_pid, fields) =>
      Object.fromEntries(fields.map((f) => [f, ROBERT[f] ?? ''])),
    writePatientData: (_pid, data) => {
      written.push(data);
    },
  };
}

function makeEnv(store: MemoryStore): RunnerEnv {
  let n = 0;
  return {
    store,
    records: records(),
    extractText: async () => 'DENIAL: service 99213 not medically necessary per plan policy B-12.',
    now: () => NOW,
    newId: () => `id-${n++}`,
  };
}

function seedFixture(store: MemoryStore) {
  const w = claimDenialAppeal(NOW).buildStable(NOW);
  validateGateBeforeSink(w);
  store.addWorkflow(w);
  return w;
}

function fixtureInputs(w: ReturnType<typeof seedFixture>) {
  const t = userInputTemplate(w);
  const byLabelOrName = (needle: string) =>
    t.userInputs.find((p) => (p.label ?? p.name).toLowerCase().includes(needle.toLowerCase()))!;
  return [
    { nodePropertyId: byLabelOrName('Denial letter').id, values: [fileVal('vault/denial.pdf', { name: 'denial.pdf' })] },
    { nodePropertyId: byLabelOrName('Denial reason').id, values: [textVal('not medically necessary')] },
    { nodePropertyId: byLabelOrName('Claim number').id, values: [textVal('CLM-88412-07')] },
    { nodePropertyId: byLabelOrName('Patient').id, values: [textVal('Robert Alvarez')] },
  ];
}

describe('claim denial appeal fixture (the P25 proving run)', () => {
  test('user-input template exposes exactly the four caregiver inputs', () => {
    const w = seedFixture(new MemoryStore());
    const t = userInputTemplate(w);
    expect(t.userInputs.map((p) => p.label ?? p.name).sort()).toEqual(
      ['Claim number', 'Denial letter or EOB', 'Denial reason (from the letter)', 'Patient'].sort(),
    );
  });

  test('runs headless to the gate, pauses with a named fact bundle', async () => {
    const store = new MemoryStore();
    const w = seedFixture(store);
    const env = makeEnv(store);
    const result = await execute(env, w.id, fixtureInputs(w), 'patient-robert');
    expect(result.kind).toBe('awaiting_confirm');
    if (result.kind !== 'awaiting_confirm') return;
    const bundle = result.payload[0];
    expect(bundle?.type).toBe('jsonv');
    if (bundle?.type !== 'jsonv') return;
    expect(bundle.json['Claim number']).toBe('CLM-88412-07');
    expect(bundle.json['Denial letter text']).toContain('99213');
    expect(bundle.json['fullName']).toBe('Robert Alvarez');
    // paused state is persisted
    expect(store.getExecution(result.executionId)?.status).toBe('awaiting_confirm');
  });

  test('confirming (with a caregiver edit) completes to a finished letter', async () => {
    const store = new MemoryStore();
    const w = seedFixture(store);
    const env = makeEnv(store);
    const paused = await execute(env, w.id, fixtureInputs(w), 'patient-robert');
    if (paused.kind !== 'awaiting_confirm') throw new Error('expected pause');
    const bundle = paused.payload[0]!;
    if (bundle.type !== 'jsonv') throw new Error('expected jsonv');
    // the caregiver corrects the claim number during review
    const edited: InterNodeVal[] = [jsonVal({ ...bundle.json, 'Claim number': 'CLM-88412-08' })];
    const done = await confirm(env, paused.executionId, paused.nodeId, edited);
    expect(done.kind).toBe('completed');
    if (done.kind !== 'completed') return;
    const letter = done.output[0];
    expect(letter?.type).toBe('text');
    if (letter?.type !== 'text') return;
    expect(letter.text).toContain('Claim number: CLM-88412-08'); // the EDIT won
    expect(letter.text).toContain('Robert Alvarez');
    expect(letter.text).toContain('ATTACHMENT: Denial letter');
    expect(letter.text).toContain('99213');
    expect(letter.text).not.toContain('{'); // no unfilled tokens
    // every node output persisted
    expect(store.getNodeOutputs(done.executionId).size).toBe(w.nodes.length);
  });

  test('survives a force-quit: a fresh env over the same store resumes the pause', async () => {
    const store = new MemoryStore();
    const w = seedFixture(store);
    const paused = await execute(makeEnv(store), w.id, fixtureInputs(w), 'patient-robert');
    if (paused.kind !== 'awaiting_confirm') throw new Error('expected pause');

    // "force quit": everything except the store is rebuilt from scratch
    const env2 = makeEnv(store);
    const resumed = await resume(env2, paused.executionId);
    expect(resumed.kind).toBe('awaiting_confirm');
    if (resumed.kind !== 'awaiting_confirm') return;
    expect(resumed.nodeId).toBe(paused.nodeId);

    const bundle = resumed.payload[0]!;
    if (bundle.type !== 'jsonv') throw new Error('expected jsonv');
    const done = await confirm(env2, resumed.executionId, resumed.nodeId, [jsonVal(bundle.json)]);
    expect(done.kind).toBe('completed');
  });

  test('a missing required input fails loudly, never silently', async () => {
    const store = new MemoryStore();
    const w = seedFixture(store);
    const inputs = fixtureInputs(w).slice(0, 2); // drop claim number + patient
    const result = await execute(makeEnv(store), w.id, inputs, 'patient-robert');
    expect(result.kind).toBe('failed');
    if (result.kind !== 'failed') return;
    expect(result.error).toMatch(/missing/);
    expect(store.getExecution(result.executionId)?.status).toBe('failed');
  });
});

describe('cancel', () => {
  test('canceling a paused run closes it; confirming afterwards is refused', async () => {
    const store = new MemoryStore();
    const w = seedFixture(store);
    const env = makeEnv(store);
    const paused = await execute(env, w.id, fixtureInputs(w), 'patient-robert');
    if (paused.kind !== 'awaiting_confirm') throw new Error('expected pause');

    cancel(env, paused.executionId);
    const e = store.getExecution(paused.executionId)!;
    expect(e.status).toBe('canceled');
    expect(e.finishedAt).toBe(NOW);
    expect(e.awaitingNodeId).toBeNull();

    await expect(
      confirm(env, paused.executionId, paused.nodeId, [jsonVal({})]),
    ).rejects.toThrow(/not awaiting/);
  });

  test('cancel is idempotent and never touches terminal runs', async () => {
    const store = new MemoryStore();
    const w = seedFixture(store);
    const env = makeEnv(store);
    const paused = await execute(env, w.id, fixtureInputs(w), 'patient-robert');
    if (paused.kind !== 'awaiting_confirm') throw new Error('expected pause');
    const bundle = paused.payload[0]!;
    if (bundle.type !== 'jsonv') throw new Error('expected jsonv');
    const done = await confirm(env, paused.executionId, paused.nodeId, [jsonVal(bundle.json)]);
    expect(done.kind).toBe('completed');

    cancel(env, paused.executionId); // no-op on completed
    expect(store.getExecution(paused.executionId)?.status).toBe('completed');
    cancel(env, paused.executionId); // still a no-op
    expect(store.getExecution(paused.executionId)?.status).toBe('completed');
  });
});

describe('structural safety rules', () => {
  test('a template whose facts bypass the gate is rejected', () => {
    const b = new WorkflowBuilder({
      key: 'bad-ungated',
      name: 'Bad',
      description: 'x',
      category: 'x',
      estMinutes: 1,
      replacesHours: 'x',
      version: 1,
    });
    const input = b.node('Text Input', 'A value', { x: 0, y: 0 });
    const fill = b.node('Form Fill', 'Fill', { x: 1, y: 0 }, { Template: [textVal('{A value}')] });
    const render = b.node('Document Render', 'Doc', { x: 2, y: 0 }, {
      Title: [textVal('t')],
      'Output Kind': [textVal('letter')],
    });
    b.wire(input, fill, 'A value');
    b.wire(fill, render, 'Body');
    const w = b.buildStable(NOW);
    expect(() => validateGateBeforeSink(w)).toThrow(/without a Human Confirm gate/);
  });

  test('exactly one sink is required', () => {
    const b = new WorkflowBuilder({
      key: 'two-sinks',
      name: 'Two',
      description: 'x',
      category: 'x',
      estMinutes: 1,
      replacesHours: 'x',
      version: 1,
    });
    b.node('Document Render', 'One', { x: 0, y: 0 });
    b.node('Document Render', 'Two', { x: 1, y: 0 });
    expect(() => sinkNode(b.buildStable(NOW))).toThrow(/exactly one output/);
  });

  test('cycles are detected instead of hanging', async () => {
    const b = new WorkflowBuilder({
      key: 'cycle',
      name: 'Cycle',
      description: 'x',
      category: 'x',
      estMinutes: 1,
      replacesHours: 'x',
      version: 1,
    });
    const a = b.node('Form Fill', 'A', { x: 0, y: 0 }, { Template: [textVal('{x}')] });
    const c = b.node('Form Fill', 'C', { x: 1, y: 0 }, { Template: [textVal('{y}')] });
    const render = b.node('Document Render', 'Doc', { x: 2, y: 0 }, {
      Title: [textVal('t')],
      'Output Kind': [textVal('letter')],
    });
    b.wire(a, c, 'y');
    b.wire(c, a, 'x');
    b.wire(c, render, 'Body');
    const store = new MemoryStore();
    const w = b.buildStable(NOW);
    store.addWorkflow(w);
    const result = await execute(makeEnv(store), w.id, [], null);
    expect(result.kind).toBe('failed');
    if (result.kind !== 'failed') return;
    expect(result.error).toMatch(/cycle/);
  });
});
