import { LocalDate, addDays, daysBetween } from '../dates';
import {
  DEFAULT_PREFS,
  DesiredNotification,
  IOS_PENDING_CAP,
  NotificationPrefs,
  PlanMedInput,
  planNotifications,
  reconcile,
} from '../notifications';
import { statusFor } from '../runway';

const TODAY: LocalDate = '2026-07-12';

// Payloads must stay PHI-free: no drug name from the demo corpus (or any
// common spelling of it) may ever appear on a lock screen.
const DRUG_CORPUS = [
  'metformin',
  'apixaban',
  'eliquis',
  'lisinopril',
  'atorvastatin',
  'donepezil',
  'sertraline',
  'amlodipine',
  'levothyroxine',
  'ibuprofen',
  'warfarin',
  'coumadin',
  'insulin',
  'glargine',
  'synthroid',
];

function assertPhiFree(plan: DesiredNotification[]): void {
  for (const n of plan) {
    const payload = `${n.title} ${n.body}`.toLowerCase();
    for (const drug of DRUG_CORPUS) {
      expect(payload).not.toContain(drug);
    }
  }
}

function med(
  medicationId: string,
  patientId: string,
  runOutDate: LocalDate | null,
  opts: { active?: boolean; prn?: boolean } = {},
): PlanMedInput {
  return {
    medicationId,
    patientId,
    active: opts.active ?? true,
    prn: opts.prn ?? false,
    runway:
      runOutDate === null
        ? null
        : {
            runOutDate,
            daysRemaining: daysBetween(TODAY, runOutDate),
            status: statusFor(daysBetween(TODAY, runOutDate)),
            fraction: 0.5,
          },
  };
}

function prefs(overrides: Partial<NotificationPrefs> = {}): NotificationPrefs {
  return { ...DEFAULT_PREFS, ...overrides };
}

describe('planNotifications trigger sets', () => {
  test('med 20 days out gets lead, urgent, and runout alerts, nearest first', () => {
    // runOut 2026-08-01: lead = -7d = 07-25, urgent = -3d = 07-29.
    const plan = planNotifications([med('m20', 'p1', '2026-08-01')], prefs(), TODAY);
    expect(plan.map((n) => n.key)).toEqual([
      'med:m20:lead:2026-07-25',
      'med:m20:urgent:2026-07-29',
      'med:m20:runout:2026-08-01',
    ]);
    expect(plan.map((n) => n.fireDate)).toEqual(['2026-07-25', '2026-07-29', '2026-08-01']);
    for (const n of plan) {
      expect(n.fireMinutes).toBe(9 * 60);
      expect(n.title).toBe('A medication needs attention');
      expect(n.route).toBe('/patient/p1/med/m20');
    }
    assertPhiFree(plan);
  });

  test('med 5 days out gets urgent and runout only; the lead day is already past', () => {
    // runOut 2026-07-17: lead would be 07-10 (past), urgent = 07-14.
    const plan = planNotifications([med('m5', 'p1', '2026-07-17')], prefs(), TODAY);
    expect(plan.map((n) => n.key)).toEqual([
      'med:m5:urgent:2026-07-14',
      'med:m5:runout:2026-07-17',
    ]);
    assertPhiFree(plan);
  });

  test('overdue med gets a single next-day overdue nudge', () => {
    const plan = planNotifications([med('mOD', 'p1', '2026-07-10')], prefs(), TODAY);
    expect(plan.map((n) => n.key)).toEqual(['med:mOD:overdue:2026-07-13']);
    expect(plan[0]!.fireDate).toBe(addDays(TODAY, 1));
    expect(plan[0]!.body).toBe('A medication is past its supply. Open RUA to resolve it.');
    assertPhiFree(plan);
  });

  test('med running out today gets nothing: foreground UI covers it', () => {
    expect(planNotifications([med('m0', 'p1', TODAY)], prefs(), TODAY)).toEqual([]);
  });

  test('leadDays below 4 is floored to 4 days before run-out', () => {
    const plan = planNotifications(
      [med('m20', 'p1', '2026-08-01')],
      prefs({ leadDays: 2 }),
      TODAY,
    );
    expect(plan.map((n) => n.key)).toEqual([
      'med:m20:lead:2026-07-28',
      'med:m20:urgent:2026-07-29',
      'med:m20:runout:2026-08-01',
    ]);
  });

  test('leadDays above the floor is respected', () => {
    const plan = planNotifications(
      [med('m20', 'p1', '2026-08-01')],
      prefs({ leadDays: 10 }),
      TODAY,
    );
    expect(plan[0]!.key).toBe('med:m20:lead:2026-07-22');
  });
});

describe('planNotifications exclusions', () => {
  test('muted patients get no alerts while unmuted patients still do', () => {
    const plan = planNotifications(
      [med('mA', 'p-muted', '2026-08-01'), med('mB', 'p-active', '2026-08-01')],
      prefs({ mutedPatientIds: ['p-muted'] }),
      TODAY,
    );
    expect(plan).toHaveLength(3);
    for (const n of plan) {
      expect(n.route).toBe('/patient/p-active/med/mB');
    }
  });

  test('PRN meds, meds without fills, and inactive meds are excluded', () => {
    const plan = planNotifications(
      [
        med('mPrn', 'p1', '2026-08-01', { prn: true }),
        med('mNoFill', 'p1', null),
        med('mInactive', 'p1', '2026-08-01', { active: false }),
      ],
      prefs(),
      TODAY,
    );
    expect(plan).toEqual([]);
  });
});

describe('quiet hours', () => {
  test('alert hour inside a same-day quiet window shifts to the window end', () => {
    const plan = planNotifications(
      [med('m1', 'p1', '2026-08-01')],
      prefs({ hour: 9, quietStart: '08:30', quietEnd: '10:00' }),
      TODAY,
    );
    expect(plan[0]!.fireMinutes).toBe(10 * 60);
  });

  test('alert hour outside the quiet window is unchanged', () => {
    const plan = planNotifications(
      [med('m1', 'p1', '2026-08-01')],
      prefs({ hour: 9, quietStart: '10:00', quietEnd: '12:00' }),
      TODAY,
    );
    expect(plan[0]!.fireMinutes).toBe(9 * 60);
  });

  test('window wrapping midnight shifts a late-evening hour to the morning end', () => {
    const plan = planNotifications(
      [med('m1', 'p1', '2026-08-01')],
      prefs({ hour: 23, quietStart: '22:00', quietEnd: '07:00' }),
      TODAY,
    );
    expect(plan[0]!.fireMinutes).toBe(7 * 60);
  });

  test('window wrapping midnight shifts an early-morning hour to the morning end', () => {
    const plan = planNotifications(
      [med('m1', 'p1', '2026-08-01')],
      prefs({ hour: 6, quietStart: '22:00', quietEnd: '07:00' }),
      TODAY,
    );
    expect(plan[0]!.fireMinutes).toBe(7 * 60);
  });

  test('midday hour is untouched by a wrapping window', () => {
    const plan = planNotifications(
      [med('m1', 'p1', '2026-08-01')],
      prefs({ hour: 12, quietStart: '22:00', quietEnd: '07:00' }),
      TODAY,
    );
    expect(plan[0]!.fireMinutes).toBe(12 * 60);
  });
});

describe('iOS pending cap', () => {
  test('caps at 64 keeping the nearest fire dates, in the deterministic order', () => {
    // 30 meds, run-outs spread from today+8 to today+37: 90 desired alerts.
    const meds: PlanMedInput[] = [];
    for (let i = 0; i < 30; i++) {
      meds.push(med(`m${String(i).padStart(2, '0')}`, 'p1', addDays(TODAY, 8 + i)));
    }
    const plan = planNotifications(meds, prefs(), TODAY);
    expect(plan).toHaveLength(IOS_PENDING_CAP);
    expect(IOS_PENDING_CAP).toBe(64);

    // Recompute the full desired set independently and apply the same
    // (fireDate, key) ordering; the plan must be its first 64 entries.
    const expected: { key: string; fireDate: string }[] = [];
    for (let i = 0; i < 30; i++) {
      const id = `m${String(i).padStart(2, '0')}`;
      const runOut = addDays(TODAY, 8 + i);
      for (const [tag, date] of [
        ['lead', addDays(runOut, -7)],
        ['urgent', addDays(runOut, -3)],
        ['runout', runOut],
      ] as const) {
        expected.push({ key: `med:${id}:${tag}:${date}`, fireDate: date });
      }
    }
    expected.sort(
      (a, b) => a.fireDate.localeCompare(b.fireDate) || a.key.localeCompare(b.key),
    );
    expect(plan.map((n) => n.key)).toEqual(expected.slice(0, 64).map((e) => e.key));

    // Everything dropped fires no earlier than everything kept.
    const lastKept = plan[plan.length - 1]!.fireDate;
    for (const e of expected.slice(64)) {
      expect(e.fireDate >= lastKept).toBe(true);
    }
    assertPhiFree(plan);
  });
});

describe('payload hygiene', () => {
  test('no plan payload ever contains a corpus drug name', () => {
    const plans = [
      planNotifications([med('metformin-id', 'p1', '2026-08-01')], prefs(), TODAY),
      planNotifications([med('m1', 'p1', '2026-07-15')], prefs(), TODAY),
      planNotifications([med('m2', 'p1', '2026-07-01')], prefs(), TODAY),
    ];
    for (const plan of plans) {
      expect(plan.length).toBeGreaterThan(0);
      assertPhiFree(plan);
    }
  });
});

describe('reconcile', () => {
  const desired = planNotifications([med('m20', 'p1', '2026-08-01')], prefs(), TODAY);
  // Keys: med:m20:lead:2026-07-25, med:m20:urgent:2026-07-29, med:m20:runout:2026-08-01.

  test('cancels keys no longer desired and schedules keys not yet pending', () => {
    const existing = [
      'med:m20:urgent:2026-07-29',
      'med:m20:runout:2026-08-01',
      'med:mGone:lead:2026-07-20',
      'med:mGone:runout:2026-07-27',
    ];
    const r = reconcile(desired, existing);
    expect(r.toCancel).toEqual(['med:mGone:lead:2026-07-20', 'med:mGone:runout:2026-07-27']);
    expect(r.toSchedule.map((n) => n.key)).toEqual(['med:m20:lead:2026-07-25']);
  });

  test('empty existing set schedules everything and cancels nothing', () => {
    const r = reconcile(desired, []);
    expect(r.toCancel).toEqual([]);
    expect(r.toSchedule).toEqual(desired);
  });

  test('identical sets are a no-op', () => {
    const r = reconcile(
      desired,
      desired.map((n) => n.key),
    );
    expect(r.toCancel).toEqual([]);
    expect(r.toSchedule).toEqual([]);
  });

  test('editing a fill date cancels the old day keys and schedules the new ones', () => {
    const moved = planNotifications([med('m20', 'p1', '2026-08-03')], prefs(), TODAY);
    const r = reconcile(
      moved,
      desired.map((n) => n.key),
    );
    expect(r.toCancel).toEqual(desired.map((n) => n.key));
    expect(r.toSchedule.map((n) => n.key)).toEqual([
      'med:m20:lead:2026-07-27',
      'med:m20:urgent:2026-07-31',
      'med:m20:runout:2026-08-03',
    ]);
  });
});
