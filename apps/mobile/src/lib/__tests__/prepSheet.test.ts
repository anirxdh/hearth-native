import { buildPrepSheet, prepSheetHtml, type PrepSheetInput } from '../prepSheet';

const TODAY = '2026-07-14';

function vital(
  kind: string,
  value: number,
  recordedOn: string,
  value2: number | null = null,
  unit = kind === 'weight' ? 'lb' : kind === 'bp' ? 'mmHg' : 'bpm',
) {
  return { kind, value, value2, unit, recordedOn, recordedAt: `${recordedOn}T09:00:00.000Z` };
}

function baseInput(overrides: Partial<PrepSheetInput> = {}): PrepSheetInput {
  return {
    today: TODAY,
    meds: [],
    medChanges: [],
    vitals: [],
    observations: [],
    bring: null,
    ...overrides,
  };
}

describe('buildPrepSheet', () => {
  it('passes current meds through untouched', () => {
    const meds = [
      { name: 'Metformin', strength: '500 mg', sig: '1 tablet twice daily', prn: false, highAlert: false },
    ];
    const sheet = buildPrepSheet(baseInput({ meds }));
    expect(sheet.currentMeds).toEqual(meds);
  });

  it('flags a heart-rate drift at the 5 bpm threshold, not below it', () => {
    const drifted = buildPrepSheet(
      baseInput({ vitals: [vital('hr', 71, '2026-06-20'), vital('hr', 76, '2026-07-13')] }),
    );
    expect(drifted.trends).toEqual([
      'Resting heart rate is up 5 bpm over the last 30 days (71 to 76 bpm).',
    ]);

    const steady = buildPrepSheet(
      baseInput({ vitals: [vital('hr', 71, '2026-06-20'), vital('hr', 75, '2026-07-13')] }),
    );
    expect(steady.trends).toEqual([]);
  });

  it('compares systolic for blood pressure and ignores same-day pairs', () => {
    const sheet = buildPrepSheet(
      baseInput({
        vitals: [vital('bp', 128, '2026-06-20', 78), vital('bp', 140, '2026-07-12', 78)],
      }),
    );
    expect(sheet.trends).toEqual([
      'Systolic blood pressure is up 12 points over the last 30 days (128 to 140).',
    ]);

    const sameDay = buildPrepSheet(
      baseInput({
        vitals: [vital('bp', 128, '2026-07-12', 78), vital('bp', 145, '2026-07-12', 80)],
      }),
    );
    expect(sameDay.trends).toEqual([]);
  });

  it('reports a downward weight trend at 3 lb', () => {
    const sheet = buildPrepSheet(
      baseInput({ vitals: [vital('weight', 186, '2026-06-18'), vital('weight', 183, '2026-07-10')] }),
    );
    expect(sheet.trends).toEqual(['Weight is down 3 lb over the last 30 days (186 to 183 lb).']);
  });

  it('keeps only medication changes from the last 30 days, newest first', () => {
    const sheet = buildPrepSheet(
      baseInput({
        medChanges: [
          { at: '2026-05-01T12:00:00.000Z', action: 'create', medName: 'Old med', changedFields: [] },
          { at: '2026-06-20T12:00:00.000Z', action: 'create', medName: 'Metformin', changedFields: [] },
          { at: '2026-07-10T12:00:00.000Z', action: 'update', medName: 'Apixaban', changedFields: ['sig'] },
        ],
      }),
    );
    expect(sheet.medChanges).toEqual([
      '2026-07-10: Apixaban changed (schedule)',
      '2026-06-20: Started Metformin',
    ]);
  });

  it('caps observations at the newest five within 30 days', () => {
    const observations = Array.from({ length: 8 }, (_, i) => ({
      kind: 'note',
      text: `Note ${i}`,
      at: `2026-07-${String(i + 2).padStart(2, '0')}T10:00:00.000Z`,
    }));
    observations.push({ kind: 'note', text: 'Too old', at: '2026-05-01T10:00:00.000Z' });
    const sheet = buildPrepSheet(baseInput({ observations }));
    expect(sheet.observations).toHaveLength(5);
    expect(sheet.observations[0]).toEqual({ on: '2026-07-09', text: 'Note 7' });
    expect(sheet.observations.map((o) => o.text)).not.toContain('Too old');
  });

  it('drafts questions from signals and every question ends in a question mark', () => {
    const sheet = buildPrepSheet(
      baseInput({
        meds: [{ name: 'Apixaban', strength: '5 mg', sig: null, prn: false, highAlert: true }],
        vitals: [vital('hr', 70, '2026-06-20'), vital('hr', 77, '2026-07-13')],
        medChanges: [
          { at: '2026-07-01T12:00:00.000Z', action: 'create', medName: 'Metformin', changedFields: [] },
        ],
        observations: [
          { kind: 'incident', text: 'Dizzy getting up from bed.', at: '2026-07-08T08:00:00.000Z' },
        ],
      }),
    );
    expect(sheet.questions.length).toBeGreaterThan(3);
    for (const q of sheet.questions) expect(q.endsWith('?')).toBe(true);
    expect(sheet.questions).toContain(
      'Resting heart rate is up 7 bpm this month. Could a medication or dose explain it?',
    );
    expect(sheet.questions).toContain('We started Metformin recently. Is it working as intended?');
    expect(sheet.questions.some((q) => q.includes('Dizzy getting up'))).toBe(true);
    expect(sheet.questions.some((q) => q.includes('Apixaban'))).toBe(true);
  });

  it('always offers at least one question even with an empty record', () => {
    const sheet = buildPrepSheet(baseInput());
    expect(sheet.questions).toEqual([
      'Is there anything new we should watch for before the next visit?',
    ]);
  });

  it('merges custom bring items after the standard ones', () => {
    const sheet = buildPrepSheet(baseInput({ bring: 'sleep log, reading glasses' }));
    expect(sheet.bring).toEqual([
      'Insurance card and photo ID',
      'Medication list (this prep sheet covers it)',
      'sleep log',
      'reading glasses',
    ]);
  });
});

describe('prepSheetHtml', () => {
  it('renders a full document and escapes interpolated text', () => {
    const sheet = buildPrepSheet(
      baseInput({
        meds: [{ name: 'Metformin <b>', strength: '500 mg', sig: null, prn: false, highAlert: false }],
      }),
    );
    const html = prepSheetHtml({
      patientName: 'Robert & Sons',
      dob: '1945-03-02',
      provider: 'Dr. Chen',
      specialty: 'cardiology',
      location: 'Mission Cardiology Clinic',
      onDate: '2026-07-17',
      atTime: '09:30',
      driver: 'Maria',
      purpose: null,
      sheet,
      generatedAt: 'Jul 14, 2026',
    });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Robert &amp; Sons');
    expect(html).toContain('Metformin &lt;b&gt;');
    expect(html).toContain('Dr. Chen');
    expect(html).toContain('Questions to ask');
    expect(html).not.toContain('<b>');
  });
});
