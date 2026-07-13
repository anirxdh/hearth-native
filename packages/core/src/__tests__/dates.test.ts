import {
  addDays,
  compareLocalDates,
  daysBetween,
  isValidLocalDate,
  localDateForInstant,
  maxLocalDate,
} from '../dates';

describe('daysBetween', () => {
  test('same day is zero', () => {
    expect(daysBetween('2026-07-12', '2026-07-12')).toBe(0);
  });

  test('forward and backward are symmetric', () => {
    expect(daysBetween('2026-07-01', '2026-07-12')).toBe(11);
    expect(daysBetween('2026-07-12', '2026-07-01')).toBe(-11);
  });

  test('spans DST spring-forward (2026-03-08, America/Los_Angeles) with exact whole days', () => {
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(daysBetween('2026-03-01', '2026-03-15')).toBe(14);
    expect(daysBetween('2026-03-08', '2026-03-09')).toBe(1);
  });

  test('spans DST fall-back (2026-11-01, America/Los_Angeles) with exact whole days', () => {
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
    expect(daysBetween('2026-10-25', '2026-11-08')).toBe(14);
    expect(daysBetween('2026-11-01', '2026-11-02')).toBe(1);
  });

  test('spans leap day 2024-02-29', () => {
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2);
    expect(daysBetween('2024-02-29', '2024-03-01')).toBe(1);
    expect(daysBetween('2024-02-01', '2024-03-01')).toBe(29);
  });

  test('spans leap day 2028-02-29', () => {
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
    expect(daysBetween('2028-02-01', '2028-03-01')).toBe(29);
  });

  test('non-leap February has 28 days', () => {
    expect(daysBetween('2026-02-01', '2026-03-01')).toBe(28);
  });

  test('spans year boundary', () => {
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1);
    expect(daysBetween('2025-12-25', '2026-01-05')).toBe(11);
    expect(daysBetween('2025-01-01', '2026-01-01')).toBe(365);
    expect(daysBetween('2024-01-01', '2025-01-01')).toBe(366);
  });
});

describe('addDays', () => {
  test('zero days is identity', () => {
    expect(addDays('2026-07-12', 0)).toBe('2026-07-12');
  });

  test('crosses DST spring-forward date without gaining or losing a day', () => {
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-03-07', 3)).toBe('2026-03-10');
    expect(addDays('2026-03-01', 30)).toBe('2026-03-31');
  });

  test('crosses DST fall-back date without gaining or losing a day', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
    expect(addDays('2026-10-25', 14)).toBe('2026-11-08');
  });

  test('handles leap day 2024-02-29', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01');
    expect(addDays('2024-02-29', 366)).toBe('2025-03-01');
  });

  test('handles leap day 2028-02-29', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
  });

  test('non-leap year skips Feb 29', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  test('crosses year boundaries in both directions', () => {
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2025-12-20', 30)).toBe('2026-01-19');
  });

  test('negative days cross month boundaries', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
  });

  test('round-trips with daysBetween', () => {
    const start = '2026-03-05';
    for (const n of [-400, -30, -1, 0, 1, 10, 90, 366]) {
      expect(daysBetween(start, addDays(start, n))).toBe(n);
    }
  });
});

describe('isValidLocalDate', () => {
  test('accepts real calendar dates', () => {
    expect(isValidLocalDate('2026-01-01')).toBe(true);
    expect(isValidLocalDate('2026-12-31')).toBe(true);
    expect(isValidLocalDate('2026-02-28')).toBe(true);
    expect(isValidLocalDate('2024-02-29')).toBe(true);
    expect(isValidLocalDate('2028-02-29')).toBe(true);
    expect(isValidLocalDate('2026-04-30')).toBe(true);
  });

  test('rejects impossible days', () => {
    expect(isValidLocalDate('2026-02-30')).toBe(false);
    expect(isValidLocalDate('2026-02-29')).toBe(false);
    expect(isValidLocalDate('2026-04-31')).toBe(false);
    expect(isValidLocalDate('2026-01-32')).toBe(false);
    expect(isValidLocalDate('2026-01-00')).toBe(false);
  });

  test('rejects impossible months', () => {
    expect(isValidLocalDate('2026-13-01')).toBe(false);
    expect(isValidLocalDate('2026-00-15')).toBe(false);
  });

  test('rejects malformed strings', () => {
    expect(isValidLocalDate('')).toBe(false);
    expect(isValidLocalDate('2026-1-01')).toBe(false);
    expect(isValidLocalDate('2026-01-1')).toBe(false);
    expect(isValidLocalDate('26-01-01')).toBe(false);
    expect(isValidLocalDate('2026/01/01')).toBe(false);
    expect(isValidLocalDate('2026-01-01T00:00:00Z')).toBe(false);
    expect(isValidLocalDate('20260101')).toBe(false);
  });
});

describe('compareLocalDates and maxLocalDate', () => {
  test('compareLocalDates orders dates', () => {
    expect(compareLocalDates('2026-07-01', '2026-07-02')).toBeLessThan(0);
    expect(compareLocalDates('2026-07-02', '2026-07-01')).toBeGreaterThan(0);
    expect(compareLocalDates('2026-07-01', '2026-07-01')).toBe(0);
  });

  test('maxLocalDate picks the latest date and handles empty input', () => {
    expect(maxLocalDate(['2026-07-01', '2026-08-01', '2026-07-15'])).toBe('2026-08-01');
    expect(maxLocalDate(['2026-07-01'])).toBe('2026-07-01');
    expect(maxLocalDate([])).toBeNull();
  });
});

describe('localDateForInstant', () => {
  test('UTC midnight is that day in UTC but the previous day in America/Los_Angeles', () => {
    expect(localDateForInstant('2026-07-12T00:00:00Z', 'UTC')).toBe('2026-07-12');
    expect(localDateForInstant('2026-07-12T00:00:00Z', 'America/Los_Angeles')).toBe('2026-07-11');
  });

  test('early-UTC-morning instants stay previous day on the US west coast', () => {
    expect(localDateForInstant('2026-07-12T03:00:00Z', 'America/Los_Angeles')).toBe('2026-07-11');
    expect(localDateForInstant('2026-01-15T05:00:00Z', 'America/Los_Angeles')).toBe('2026-01-14');
  });

  test('once past the UTC offset the local day matches', () => {
    expect(localDateForInstant('2026-07-12T08:00:00Z', 'America/Los_Angeles')).toBe('2026-07-12');
    expect(localDateForInstant('2026-01-15T09:00:00Z', 'America/Los_Angeles')).toBe('2026-01-15');
  });

  test('zones ahead of UTC can already be on the next day', () => {
    expect(localDateForInstant('2026-07-12T20:00:00Z', 'Asia/Tokyo')).toBe('2026-07-13');
    expect(localDateForInstant('2026-07-12T11:00:00Z', 'Pacific/Kiritimati')).toBe('2026-07-13');
    expect(localDateForInstant('2026-07-12T20:00:00Z', 'UTC')).toBe('2026-07-12');
  });

  test('DST transition instants resolve to the right local day', () => {
    // 10:30 UTC on spring-forward day is 03:30 PDT.
    expect(localDateForInstant('2026-03-08T10:30:00Z', 'America/Los_Angeles')).toBe('2026-03-08');
    // 08:30 UTC on fall-back day is 01:30 PDT (first pass through 1am).
    expect(localDateForInstant('2026-11-01T08:30:00Z', 'America/Los_Angeles')).toBe('2026-11-01');
  });
});
