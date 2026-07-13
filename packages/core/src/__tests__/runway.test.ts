import { LocalDate } from '../dates';
import {
  FillInput,
  MedSyncCandidate,
  RUNWAY_THRESHOLDS,
  RunwayStatus,
  computeRunway,
  latestFill,
  medSyncPlan,
  statusFor,
} from '../runway';

describe('statusFor thresholds', () => {
  test('threshold constants are the documented contract', () => {
    expect(RUNWAY_THRESHOLDS.soon).toBe(10);
    expect(RUNWAY_THRESHOLDS.urgent).toBe(3);
  });

  test('exact boundaries at 10, 3, and 0', () => {
    expect(statusFor(11)).toBe('ok');
    expect(statusFor(10)).toBe('soon');
    expect(statusFor(4)).toBe('soon');
    expect(statusFor(3)).toBe('urgent');
    expect(statusFor(1)).toBe('urgent');
    expect(statusFor(0)).toBe('overdue');
    expect(statusFor(-1)).toBe('overdue');
  });
});

interface GoldenCase {
  name: string;
  fill: FillInput;
  today: LocalDate;
  runOutDate: LocalDate;
  daysRemaining: number;
  status: RunwayStatus;
  fraction: number;
}

// Every expected value below is hand-computed from fill date + day supply.
const GOLDEN: GoldenCase[] = [
  {
    name: 'ok: 30-day fill with 19 days left',
    fill: { fillDate: '2026-07-01', daySupply: 30 },
    today: '2026-07-12',
    runOutDate: '2026-07-31',
    daysRemaining: 19,
    status: 'ok',
    fraction: 19 / 30,
  },
  {
    name: 'ok: 11 days left is still ok (one above the soon boundary)',
    fill: { fillDate: '2026-07-01', daySupply: 30 },
    today: '2026-07-20',
    runOutDate: '2026-07-31',
    daysRemaining: 11,
    status: 'ok',
    fraction: 11 / 30,
  },
  {
    name: 'soon boundary: exactly 10 days left',
    fill: { fillDate: '2026-07-01', daySupply: 30 },
    today: '2026-07-21',
    runOutDate: '2026-07-31',
    daysRemaining: 10,
    status: 'soon',
    fraction: 10 / 30,
  },
  {
    name: 'soon: 4 days left (one above the urgent boundary)',
    fill: { fillDate: '2026-07-01', daySupply: 30 },
    today: '2026-07-27',
    runOutDate: '2026-07-31',
    daysRemaining: 4,
    status: 'soon',
    fraction: 4 / 30,
  },
  {
    name: 'urgent boundary: exactly 3 days left',
    fill: { fillDate: '2026-07-01', daySupply: 30 },
    today: '2026-07-28',
    runOutDate: '2026-07-31',
    daysRemaining: 3,
    status: 'urgent',
    fraction: 3 / 30,
  },
  {
    name: 'urgent: 1 day left',
    fill: { fillDate: '2026-07-01', daySupply: 30 },
    today: '2026-07-30',
    runOutDate: '2026-07-31',
    daysRemaining: 1,
    status: 'urgent',
    fraction: 1 / 30,
  },
  {
    name: 'overdue boundary: runs out today (0 days remaining)',
    fill: { fillDate: '2026-07-01', daySupply: 30 },
    today: '2026-07-31',
    runOutDate: '2026-07-31',
    daysRemaining: 0,
    status: 'overdue',
    fraction: 0,
  },
  {
    name: 'overdue: out for 5 days',
    fill: { fillDate: '2026-07-01', daySupply: 30 },
    today: '2026-08-05',
    runOutDate: '2026-07-31',
    daysRemaining: -5,
    status: 'overdue',
    fraction: 0,
  },
  {
    name: 'zero day supply runs out on the fill date itself',
    fill: { fillDate: '2026-07-12', daySupply: 0 },
    today: '2026-07-12',
    runOutDate: '2026-07-12',
    daysRemaining: 0,
    status: 'overdue',
    fraction: 0,
  },
  {
    name: '90-day fill lands on the soon boundary',
    fill: { fillDate: '2026-01-15', daySupply: 90 },
    today: '2026-04-05',
    runOutDate: '2026-04-15',
    daysRemaining: 10,
    status: 'soon',
    fraction: 10 / 90,
  },
  {
    name: 'future fill date: daysRemaining exceeds daySupply, fraction clamps to 1',
    fill: { fillDate: '2026-08-01', daySupply: 30 },
    today: '2026-07-12',
    runOutDate: '2026-08-31',
    daysRemaining: 50,
    status: 'ok',
    fraction: 1,
  },
  {
    name: 'fill spanning DST spring-forward (2026-03-08)',
    fill: { fillDate: '2026-03-01', daySupply: 14 },
    today: '2026-03-10',
    runOutDate: '2026-03-15',
    daysRemaining: 5,
    status: 'soon',
    fraction: 5 / 14,
  },
  {
    name: 'fill spanning DST fall-back (2026-11-01)',
    fill: { fillDate: '2026-10-25', daySupply: 14 },
    today: '2026-11-05',
    runOutDate: '2026-11-08',
    daysRemaining: 3,
    status: 'urgent',
    fraction: 3 / 14,
  },
  {
    name: 'fill spanning leap day, today is 2024-02-29',
    fill: { fillDate: '2024-02-15', daySupply: 30 },
    today: '2024-02-29',
    runOutDate: '2024-03-16',
    daysRemaining: 16,
    status: 'ok',
    fraction: 16 / 30,
  },
  {
    name: 'fill spanning the year boundary',
    fill: { fillDate: '2025-12-20', daySupply: 30 },
    today: '2026-01-01',
    runOutDate: '2026-01-19',
    daysRemaining: 18,
    status: 'ok',
    fraction: 18 / 30,
  },
];

describe('computeRunway golden fixtures', () => {
  test.each(GOLDEN)('$name', (c) => {
    const r = computeRunway(c.fill, c.today);
    expect(r.runOutDate).toBe(c.runOutDate);
    expect(r.daysRemaining).toBe(c.daysRemaining);
    expect(r.status).toBe(c.status);
    expect(r.fraction).toBeCloseTo(c.fraction, 12);
  });

  test('throws on negative day supply', () => {
    expect(() => computeRunway({ fillDate: '2026-07-01', daySupply: -1 }, '2026-07-12')).toThrow(
      /Invalid day supply/,
    );
  });

  test('throws on non-integer day supply', () => {
    expect(() => computeRunway({ fillDate: '2026-07-01', daySupply: 3.5 }, '2026-07-12')).toThrow(
      /Invalid day supply/,
    );
  });

  test('throws on NaN day supply', () => {
    expect(() => computeRunway({ fillDate: '2026-07-01', daySupply: NaN }, '2026-07-12')).toThrow(
      /Invalid day supply/,
    );
  });
});

describe('latestFill', () => {
  const f = (fillDate: LocalDate, createdAt: string, id: string) => ({ fillDate, createdAt, id });

  test('empty list returns null', () => {
    expect(latestFill([])).toBeNull();
  });

  test('single fill returns itself', () => {
    const only = f('2026-07-01', '2026-07-01T10:00:00Z', 'a');
    expect(latestFill([only])).toBe(only);
  });

  test('newest fillDate wins regardless of array order', () => {
    const older = f('2026-06-01', '2026-06-01T10:00:00Z', 'old');
    const newer = f('2026-07-05', '2026-07-05T09:00:00Z', 'new');
    expect(latestFill([older, newer])!.id).toBe('new');
    expect(latestFill([newer, older])!.id).toBe('new');
  });

  test('newest fillDate wins even when its createdAt is older', () => {
    const backfilled = f('2026-07-10', '2026-07-01T08:00:00Z', 'backfilled');
    const earlier = f('2026-07-05', '2026-07-05T09:00:00Z', 'earlier');
    expect(latestFill([earlier, backfilled])!.id).toBe('backfilled');
  });

  test('same fillDate: later createdAt breaks the tie regardless of array order', () => {
    const morning = f('2026-07-05', '2026-07-05T09:00:00Z', 'morning');
    const evening = f('2026-07-05', '2026-07-05T21:00:00Z', 'evening');
    expect(latestFill([morning, evening])!.id).toBe('evening');
    expect(latestFill([evening, morning])!.id).toBe('evening');
  });
});

describe('medSyncPlan', () => {
  const cand = (
    medicationId: string,
    name: string,
    runOutDate: LocalDate,
    dosesPerDay: number | null,
  ): MedSyncCandidate => ({ medicationId, name, runOutDate, dosesPerDay });

  test('returns null for fewer than 2 meds', () => {
    expect(medSyncPlan([])).toBeNull();
    expect(medSyncPlan([cand('a', 'Metformin', '2026-07-20', 2)])).toBeNull();
  });

  test('returns null when all run-out dates are identical', () => {
    expect(
      medSyncPlan([
        cand('a', 'Metformin', '2026-07-20', 2),
        cand('b', 'Lisinopril', '2026-07-20', 1),
        cand('c', 'Atorvastatin', '2026-07-20', 1),
      ]),
    ).toBeNull();
  });

  test('3-med alignment: aligns to the latest run-out with hand-computed gaps and doses', () => {
    const plan = medSyncPlan([
      cand('a', 'Metformin', '2026-07-20', 2),
      cand('b', 'Lisinopril', '2026-07-25', 1),
      cand('c', 'Atorvastatin', '2026-08-01', null),
    ]);
    expect(plan).not.toBeNull();
    expect(plan!.alignDate).toBe('2026-08-01');
    expect(plan!.perMed).toHaveLength(3);

    const [a, b, c] = plan!.perMed;
    expect(a).toEqual({ medicationId: 'a', name: 'Metformin', gapDays: 12, shortFillDoses: 24 });
    expect(b).toEqual({ medicationId: 'b', name: 'Lisinopril', gapDays: 7, shortFillDoses: 7 });
    expect(c).toEqual({ medicationId: 'c', name: 'Atorvastatin', gapDays: 0, shortFillDoses: null });
  });

  test('the align med itself gets gap 0 and zero short-fill doses when dosesPerDay is known', () => {
    const plan = medSyncPlan([
      cand('a', 'Levothyroxine', '2026-07-28', 1),
      cand('b', 'Amlodipine', '2026-08-04', 1),
    ]);
    expect(plan!.alignDate).toBe('2026-08-04');
    expect(plan!.perMed[0]).toEqual({
      medicationId: 'a',
      name: 'Levothyroxine',
      gapDays: 7,
      shortFillDoses: 7,
    });
    expect(plan!.perMed[1]).toEqual({
      medicationId: 'b',
      name: 'Amlodipine',
      gapDays: 0,
      shortFillDoses: 0,
    });
  });

  test('unknown dosesPerDay yields null shortFillDoses but a real gap', () => {
    const plan = medSyncPlan([
      cand('a', 'Sertraline', '2026-07-20', null),
      cand('b', 'Donepezil', '2026-07-30', 1),
    ]);
    expect(plan!.perMed[0]).toEqual({
      medicationId: 'a',
      name: 'Sertraline',
      gapDays: 10,
      shortFillDoses: null,
    });
  });
});
