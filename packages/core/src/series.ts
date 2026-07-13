/**
 * Chart series preparation: pure date-window filtering and bucketing so the
 * Activity charts render exactly what the data says. No React, no rendering,
 * no clock reads; `today` is always passed in.
 */
import { LocalDate, addDays, daysBetween } from './dates';

export type SeriesPoint = { on: LocalDate; value: number };
export type ChartRange = '7d' | '30d' | '90d' | '1y';

export type BucketedPoint = {
  /** Short axis label, e.g. "Jul 8", "Wk of Jun 15", "Mar". */
  label: string;
  /** Bucket mean, rounded to one decimal. */
  value: number;
  /** Inclusive bucket start, for stable keys and tests. */
  start: LocalDate;
};

export const RANGE_DAYS: Record<ChartRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function shortLabel(d: LocalDate): string {
  const [, m, day] = d.split('-');
  return `${MONTHS[Number(m) - 1]} ${Number(day)}`;
}

function monthLabel(d: LocalDate): string {
  const [, m] = d.split('-');
  return MONTHS[Number(m) - 1] ?? '';
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Filter points to the window ending at `today` (inclusive) and bucket:
 * 7d and 30d keep daily points; 90d averages by week; 1y averages by month.
 * Points on the same day are averaged first so duplicates never skew a mean.
 * Output is oldest-first, ready for a left-to-right line chart.
 */
export function bucketSeries(
  points: SeriesPoint[],
  range: ChartRange,
  today: LocalDate,
): BucketedPoint[] {
  const windowStart = addDays(today, -(RANGE_DAYS[range] - 1));
  const inWindow = points.filter((p) => p.on >= windowStart && p.on <= today);
  if (inWindow.length === 0) return [];

  // Collapse same-day readings to their mean.
  const byDay = new Map<LocalDate, number[]>();
  for (const p of inWindow) {
    const arr = byDay.get(p.on) ?? [];
    arr.push(p.value);
    byDay.set(p.on, arr);
  }
  const daily: SeriesPoint[] = [...byDay.entries()]
    .map(([on, vals]) => ({ on, value: vals.reduce((a, b) => a + b, 0) / vals.length }))
    .sort((a, b) => (a.on < b.on ? -1 : 1));

  if (range === '7d' || range === '30d') {
    return daily.map((p) => ({ label: shortLabel(p.on), value: round1(p.value), start: p.on }));
  }

  if (range === '90d') {
    const buckets = new Map<number, { start: LocalDate; vals: number[] }>();
    for (const p of daily) {
      const idx = Math.floor(daysBetween(windowStart, p.on) / 7);
      const start = addDays(windowStart, idx * 7);
      const b = buckets.get(idx) ?? { start, vals: [] };
      b.vals.push(p.value);
      buckets.set(idx, b);
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, b]) => ({
        label: `Wk of ${shortLabel(b.start)}`,
        value: round1(b.vals.reduce((x, y) => x + y, 0) / b.vals.length),
        start: b.start,
      }));
  }

  // 1y: bucket by calendar month.
  const buckets = new Map<string, { start: LocalDate; vals: number[] }>();
  for (const p of daily) {
    const key = p.on.slice(0, 7); // YYYY-MM
    const b = buckets.get(key) ?? { start: `${key}-01` as LocalDate, vals: [] };
    b.vals.push(p.value);
    buckets.set(key, b);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([, b]) => ({
      label: monthLabel(b.start),
      value: round1(b.vals.reduce((x, y) => x + y, 0) / b.vals.length),
      start: b.start,
    }));
}

export type SeriesSummary = {
  latest: number;
  /** Signed change from the first bucket to the last, rounded to one decimal. */
  delta: number;
  direction: 'up' | 'down' | 'flat';
};

/** Summary line for a chart header: latest value and window trend. */
export function summarizeSeries(bucketed: BucketedPoint[]): SeriesSummary | null {
  const first = bucketed[0];
  const last = bucketed[bucketed.length - 1];
  if (!first || !last) return null;
  const delta = round1(last.value - first.value);
  return {
    latest: last.value,
    delta,
    direction: delta > 0.5 ? 'up' : delta < -0.5 ? 'down' : 'flat',
  };
}
