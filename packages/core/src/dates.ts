/**
 * Calendar-date math on 'YYYY-MM-DD' local-date strings.
 *
 * All arithmetic goes through Date.UTC so a fill date never gains or loses a
 * day across DST transitions or timezones. "Today" is always supplied by the
 * caller (the app layer resolves the caregiver's wall clock); nothing in
 * @rua/core reads the system clock.
 */

export type LocalDate = string; // 'YYYY-MM-DD'

const RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidLocalDate(d: string): d is LocalDate {
  const m = RE.exec(d);
  if (!m) return false;
  const [y, mo, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12) return false;
  const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate(); // handles leap years
  return day >= 1 && day <= dim;
}

function toUtcMs(d: LocalDate): number {
  const m = RE.exec(d);
  if (!m) throw new Error(`Invalid local date: ${d}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function fromUtcMs(ms: number): LocalDate {
  const dt = new Date(ms);
  const y = dt.getUTCFullYear();
  const mo = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const da = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

const DAY_MS = 86_400_000;

/** Whole days from a to b (positive when b is after a). */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / DAY_MS);
}

export function addDays(d: LocalDate, days: number): LocalDate {
  return fromUtcMs(toUtcMs(d) + days * DAY_MS);
}

export function compareLocalDates(a: LocalDate, b: LocalDate): number {
  return toUtcMs(a) - toUtcMs(b);
}

export function maxLocalDate(dates: LocalDate[]): LocalDate | null {
  if (dates.length === 0) return null;
  return dates.reduce((m, d) => (compareLocalDates(d, m) > 0 ? d : m));
}

/** The caregiver-local calendar date for an instant, in a given IANA zone. */
export function localDateForInstant(instantIso: string, timeZone: string): LocalDate {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date(instantIso)) as LocalDate;
}
