import { LocalDate } from '../dates';
import {
  DigestMedInput,
  DigestPatientInput,
  buildDigest,
  digestIsStale,
} from '../digest';
import { Runway, statusFor } from '../runway';

const TODAY: LocalDate = '2026-07-12';
const NOW_ISO = '2026-07-12T15:00:00Z';

function rw(daysRemaining: number, runOutDate: LocalDate): Runway {
  return { runOutDate, daysRemaining, status: statusFor(daysRemaining), fraction: 0.5 };
}

interface MedOpts {
  highAlert?: boolean;
  prn?: boolean;
  active?: boolean;
  patientName?: string;
}

function med(
  medicationId: string,
  patientId: string,
  medName: string,
  runway: Runway | null,
  opts: MedOpts = {},
): DigestMedInput {
  return {
    medicationId,
    patientId,
    patientName: opts.patientName ?? 'Dad',
    medName,
    highAlert: opts.highAlert ?? false,
    prn: opts.prn ?? false,
    active: opts.active ?? true,
    runway,
  };
}

function patient(patientId: string, name: string, lastTouchedAt: string | null): DigestPatientInput {
  return { patientId, name, lastTouchedAt };
}

const FRESH_PATIENTS = [patient('p1', 'Dad', '2026-07-11T20:00:00Z')];

describe('buildDigest ranking', () => {
  test('overdue beats urgent beats soon', () => {
    const digest = buildDigest(
      [
        med('soon', 'p1', 'Atorvastatin', rw(7, '2026-07-19')),
        med('urgent', 'p1', 'Lisinopril', rw(2, '2026-07-14')),
        med('overdue', 'p1', 'Metformin', rw(-1, '2026-07-11')),
      ],
      FRESH_PATIENTS,
      TODAY,
      NOW_ISO,
    );
    expect(digest.lead!.kind).toBe('refill-overdue');
    expect(digest.lead!.medicationId).toBe('overdue');
    expect(digest.quiet.map((i) => i.kind)).toEqual(['refill-urgent', 'refill-soon']);
  });

  test('within overdue, longest-out first', () => {
    const digest = buildDigest(
      [
        med('out2', 'p1', 'Metformin', rw(-2, '2026-07-10')),
        med('out8', 'p1', 'Lisinopril', rw(-8, '2026-07-04')),
        med('out5', 'p1', 'Amlodipine', rw(-5, '2026-07-07')),
      ],
      FRESH_PATIENTS,
      TODAY,
      NOW_ISO,
    );
    expect(digest.lead!.medicationId).toBe('out8');
    expect(digest.quiet.map((i) => i.medicationId)).toEqual(['out5', 'out2']);
  });

  test('high-alert breaks ties among equally overdue meds', () => {
    const digest = buildDigest(
      [
        med('plain', 'p1', 'Metformin', rw(-5, '2026-07-07')),
        med('ha', 'p1', 'Apixaban', rw(-5, '2026-07-07'), { highAlert: true }),
      ],
      FRESH_PATIENTS,
      TODAY,
      NOW_ISO,
    );
    expect(digest.lead!.medicationId).toBe('ha');
    expect(digest.quiet[0]!.medicationId).toBe('plain');
  });

  test('high-alert breaks ties among urgent meds with equal days remaining', () => {
    const digest = buildDigest(
      [
        med('plain', 'p1', 'Lisinopril', rw(2, '2026-07-14')),
        med('ha', 'p1', 'Apixaban', rw(2, '2026-07-14'), { highAlert: true }),
      ],
      FRESH_PATIENTS,
      TODAY,
      NOW_ISO,
    );
    expect(digest.lead!.medicationId).toBe('ha');
  });

  test('no-fill-data outranks stale', () => {
    const digest = buildDigest(
      [med('nofill', 'p1', 'Sertraline', null)],
      [patient('p2', 'Mom', '2026-06-20T08:00:00Z')],
      TODAY,
      NOW_ISO,
    );
    expect(digest.lead!.kind).toBe('no-fill-data');
    expect(digest.quiet.map((i) => i.kind)).toEqual(['stale']);
  });

  test('full household fixture pins the complete order and the quiet cap of 4', () => {
    const meds = [
      med('mE', 'p1', 'Atorvastatin', rw(7, '2026-07-19')),
      med('mA', 'p1', 'Metformin', rw(-5, '2026-07-07')),
      med('mF', 'p2', 'Sertraline', null, { patientName: 'Mom' }),
      med('mC', 'p1', 'Lisinopril', rw(-8, '2026-07-04')),
      med('mD', 'p2', 'Donepezil', rw(2, '2026-07-14'), { patientName: 'Mom' }),
      med('mB', 'p1', 'Apixaban', rw(-5, '2026-07-07'), { highAlert: true }),
      // Excluded: healthy runway, PRN, inactive.
      med('mG', 'p3', 'Levothyroxine', rw(25, '2026-08-06'), { patientName: 'Rosa' }),
      med('mH', 'p3', 'Ibuprofen', rw(-3, '2026-07-09'), { prn: true, patientName: 'Rosa' }),
      med('mI', 'p3', 'Old med', null, { active: false, patientName: 'Rosa' }),
    ];
    const patients = [
      patient('p1', 'Dad', '2026-07-11T20:00:00Z'),
      patient('p2', 'Mom', '2026-06-20T08:00:00Z'), // 22 days stale
      patient('p3', 'Rosa', null),
    ];
    const digest = buildDigest(meds, patients, TODAY, NOW_ISO);

    // Full ranked list: mC, mB, mA, mD, mE, mF(no-fill), stale(p2).
    // Lead takes the first, quiet keeps the next four.
    expect(digest.lead!.medicationId).toBe('mC');
    expect(digest.lead!.kind).toBe('refill-overdue');
    expect(digest.quiet).toHaveLength(4);
    expect(digest.quiet.map((i) => i.medicationId)).toEqual(['mB', 'mA', 'mD', 'mE']);
    expect(digest.quiet.map((i) => i.kind)).toEqual([
      'refill-overdue',
      'refill-overdue',
      'refill-urgent',
      'refill-soon',
    ]);
    // Excluded meds never appear anywhere.
    const allIds = [digest.lead!, ...digest.quiet].map((i) => i.medicationId);
    expect(allIds).not.toContain('mG');
    expect(allIds).not.toContain('mH');
    expect(allIds).not.toContain('mI');
  });
});

describe('buildDigest item content', () => {
  test('overdue lead has the run-out phrasing and refill action route', () => {
    const digest = buildDigest(
      [med('m1', 'p1', 'Apixaban', rw(-8, '2026-07-04'), { highAlert: true })],
      FRESH_PATIENTS,
      TODAY,
      NOW_ISO,
    );
    expect(digest.lead!.title).toBe("Dad's Apixaban has run out");
    expect(digest.lead!.detail).toBe('Out for 8 days based on the last fill.');
    expect(digest.lead!.action).toEqual({ label: 'Request refill', route: '/patient/p1/med/m1' });
  });

  test('runs-out-today med reads as ending today', () => {
    const digest = buildDigest(
      [med('m1', 'p1', 'Metformin', rw(0, TODAY))],
      FRESH_PATIENTS,
      TODAY,
      NOW_ISO,
    );
    expect(digest.lead!.kind).toBe('refill-overdue');
    expect(digest.lead!.detail).toBe('The supply ends today based on the last fill.');
  });

  test('soon item uses singular/plural days and flags high-alert in the detail', () => {
    const digest = buildDigest(
      [
        med('m1', 'p1', 'Apixaban', rw(7, '2026-07-19'), { highAlert: true }),
        med('m2', 'p1', 'Lisinopril', rw(1, '2026-07-13')),
      ],
      FRESH_PATIENTS,
      TODAY,
      NOW_ISO,
    );
    expect(digest.lead!.title).toBe("Dad's Lisinopril runs out in 1 day");
    expect(digest.quiet[0]!.title).toBe("Dad's Apixaban runs out in 7 days");
    expect(digest.quiet[0]!.detail).toBe('Supply ends 2026-07-19. High-alert medication.');
  });

  test('all action routes follow /patient/:id/med/:id', () => {
    const digest = buildDigest(
      [
        med('m-1', 'p-9', 'Metformin', rw(-2, '2026-07-10')),
        med('m-2', 'p-9', 'Sertraline', null),
      ],
      [patient('p-9', 'Dad', NOW_ISO)],
      TODAY,
      NOW_ISO,
    );
    for (const item of [digest.lead!, ...digest.quiet]) {
      expect(item.action!.route).toMatch(/^\/patient\/[\w-]+\/med\/[\w-]+$/);
    }
  });
});

describe('buildDigest exclusions', () => {
  test('PRN meds never appear even when overdue', () => {
    const digest = buildDigest(
      [med('m1', 'p1', 'Ibuprofen', rw(-10, '2026-07-02'), { prn: true })],
      FRESH_PATIENTS,
      TODAY,
      NOW_ISO,
    );
    expect(digest.lead).toBeNull();
    expect(digest.quiet[0]!.kind).toBe('all-good');
  });

  test('inactive meds never appear, including as no-fill-data', () => {
    const digest = buildDigest(
      [
        med('m1', 'p1', 'Old med', rw(1, '2026-07-13'), { active: false }),
        med('m2', 'p1', 'Older med', null, { active: false }),
      ],
      FRESH_PATIENTS,
      TODAY,
      NOW_ISO,
    );
    expect(digest.lead).toBeNull();
    expect(digest.quiet[0]!.kind).toBe('all-good');
  });

  test('meds due beyond 10 days produce nothing', () => {
    const digest = buildDigest(
      [med('m1', 'p1', 'Metformin', rw(11, '2026-07-23'))],
      FRESH_PATIENTS,
      TODAY,
      NOW_ISO,
    );
    expect(digest.lead).toBeNull();
    expect(digest.quiet.map((i) => i.kind)).toEqual(['all-good']);
  });
});

describe('buildDigest staleness', () => {
  test('exactly 14 days without a touch is stale', () => {
    const digest = buildDigest(
      [],
      [patient('p1', 'Dad', '2026-06-28T23:59:00Z')],
      TODAY,
      NOW_ISO,
    );
    expect(digest.lead!.kind).toBe('stale');
    expect(digest.lead!.title).toBe('Nothing new for Dad in 14 days');
    expect(digest.lead!.action).toEqual({ label: 'Open record', route: '/patient/p1' });
  });

  test('13 days is not stale', () => {
    const digest = buildDigest([], [patient('p1', 'Dad', '2026-06-29T00:00:00Z')], TODAY, NOW_ISO);
    expect(digest.lead).toBeNull();
    expect(digest.quiet[0]!.kind).toBe('all-good');
  });

  test('patients never touched produce no stale item', () => {
    const digest = buildDigest([], [patient('p1', 'Dad', null)], TODAY, NOW_ISO);
    expect(digest.quiet[0]!.kind).toBe('all-good');
  });

  test('staler patients rank first among stale items', () => {
    const digest = buildDigest(
      [],
      [
        patient('p1', 'Dad', '2026-06-25T08:00:00Z'), // 17 days
        patient('p2', 'Mom', '2026-06-10T08:00:00Z'), // 32 days
      ],
      TODAY,
      NOW_ISO,
    );
    expect(digest.lead!.patientId).toBe('p2');
    expect(digest.quiet[0]!.patientId).toBe('p1');
  });
});

describe('buildDigest all-good', () => {
  test('empty inputs produce a single all-good quiet line and no lead', () => {
    const digest = buildDigest([], [], TODAY, NOW_ISO);
    expect(digest.lead).toBeNull();
    expect(digest.quiet).toHaveLength(1);
    expect(digest.quiet[0]!).toMatchObject({
      kind: 'all-good',
      patientId: null,
      medicationId: null,
      title: 'Everyone is covered',
      action: null,
    });
  });

  test('healthy runways and fresh patients are all-good', () => {
    const digest = buildDigest(
      [med('m1', 'p1', 'Metformin', rw(20, '2026-08-01'))],
      FRESH_PATIENTS,
      TODAY,
      NOW_ISO,
    );
    expect(digest.lead).toBeNull();
    expect(digest.quiet.map((i) => i.kind)).toEqual(['all-good']);
  });
});

describe('digestIsStale', () => {
  test('same day is fresh, any other day is stale', () => {
    expect(digestIsStale('2026-07-12', '2026-07-12')).toBe(false);
    expect(digestIsStale('2026-07-11', '2026-07-12')).toBe(true);
    expect(digestIsStale('2026-07-13', '2026-07-12')).toBe(true);
  });
});
