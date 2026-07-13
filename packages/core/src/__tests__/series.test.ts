import { bucketSeries, summarizeSeries, type SeriesPoint } from '../series';
import { addDays, type LocalDate } from '../dates';

const TODAY: LocalDate = '2026-07-13';

function dailyPoints(count: number, value: (i: number) => number): SeriesPoint[] {
  // i = 0 is `count-1` days ago; last point is today.
  return Array.from({ length: count }, (_, i) => ({
    on: addDays(TODAY, -(count - 1 - i)),
    value: value(i),
  }));
}

describe('bucketSeries', () => {
  test('7d keeps daily points inside the window, oldest first', () => {
    const pts = dailyPoints(10, (i) => 100 + i);
    const out = bucketSeries(pts, '7d', TODAY);
    expect(out).toHaveLength(7);
    expect(out[0]).toEqual({ label: 'Jul 7', value: 103, start: '2026-07-07' });
    expect(out[6]).toEqual({ label: 'Jul 13', value: 109, start: '2026-07-13' });
  });

  test('same-day readings are averaged before bucketing', () => {
    const pts: SeriesPoint[] = [
      { on: '2026-07-12', value: 130 },
      { on: '2026-07-12', value: 140 },
      { on: '2026-07-13', value: 120 },
    ];
    const out = bucketSeries(pts, '7d', TODAY);
    expect(out).toEqual([
      { label: 'Jul 12', value: 135, start: '2026-07-12' },
      { label: 'Jul 13', value: 120, start: '2026-07-13' },
    ]);
  });

  test('90d buckets by week with means', () => {
    const pts = dailyPoints(90, () => 10);
    pts[89] = { on: TODAY, value: 24 }; // today alone shifts its week's mean
    const out = bucketSeries(pts, '90d', TODAY);
    expect(out).toHaveLength(13);
    expect(out[0]?.label).toBe('Wk of Apr 15');
    const last = out[out.length - 1]!;
    // Last bucket holds days 84..89 of the window: five 10s and one 24.
    expect(last.value).toBe(12.3);
  });

  test('1y buckets by calendar month', () => {
    const pts: SeriesPoint[] = [
      { on: '2026-03-02', value: 180 },
      { on: '2026-03-25', value: 184 },
      { on: '2026-06-10', value: 178 },
      { on: '2025-07-20', value: 190 },
    ];
    const out = bucketSeries(pts, '1y', TODAY);
    expect(out.map((b) => b.label)).toEqual(['Jul', 'Mar', 'Jun']);
    expect(out.map((b) => b.value)).toEqual([190, 182, 178]);
  });

  test('points outside the window are excluded entirely', () => {
    const pts: SeriesPoint[] = [
      { on: addDays(TODAY, -7), value: 1 },
      { on: addDays(TODAY, -6), value: 2 },
    ];
    expect(bucketSeries(pts, '7d', TODAY)).toHaveLength(1);
  });

  test('empty input returns empty output', () => {
    expect(bucketSeries([], '30d', TODAY)).toEqual([]);
  });
});

describe('summarizeSeries', () => {
  test('reports latest, delta, and direction', () => {
    const out = bucketSeries(dailyPoints(7, (i) => 70 + i), '7d', TODAY);
    expect(summarizeSeries(out)).toEqual({ latest: 76, delta: 6, direction: 'up' });
  });

  test('small drift within half a point reads as flat', () => {
    const out = bucketSeries(
      [
        { on: addDays(TODAY, -3), value: 138.2 },
        { on: TODAY, value: 138.5 },
      ],
      '7d',
      TODAY,
    );
    expect(summarizeSeries(out)?.direction).toBe('flat');
  });

  test('null on empty', () => {
    expect(summarizeSeries([])).toBeNull();
  });
});
