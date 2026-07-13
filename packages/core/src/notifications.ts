/**
 * Write-time notification planning.
 *
 * The runway is arithmetic, so every future refill alert is knowable the
 * moment a fill is saved. We therefore PRE-SCHEDULE local notifications and
 * reconcile by diff on every med write and app foreground - iOS background
 * execution is never load-bearing.
 *
 * Everything here is pure: the app layer owns expo-notifications calls.
 */

import { LocalDate, addDays, compareLocalDates } from './dates';
import { Runway } from './runway';

export interface NotificationPrefs {
  /** Days before run-out for the first heads-up. */
  leadDays: number;
  /** Local hour (0-23) alerts fire at. */
  hour: number;
  /** Optional quiet window; alerts inside it shift to quietEnd. 'HH:mm'. */
  quietStart: string | null;
  quietEnd: string | null;
  /** Patients with alerts turned off. */
  mutedPatientIds: string[];
}

export const DEFAULT_PREFS: NotificationPrefs = {
  leadDays: 7,
  hour: 9,
  quietStart: null,
  quietEnd: null,
  mutedPatientIds: [],
};

export interface PlanMedInput {
  medicationId: string;
  patientId: string;
  active: boolean;
  prn: boolean;
  runway: Runway | null;
}

export interface DesiredNotification {
  /**
   * Stable identity: same med + same trigger day => same key, so reconciling
   * is a set-diff and editing a fill date reschedules cleanly.
   */
  key: string;
  /** Local calendar day the alert fires. */
  fireDate: LocalDate;
  /** Local minutes-into-day the alert fires (after quiet-hours shift). */
  fireMinutes: number;
  /** PHI-free by rule: never a drug name, dose, or condition on the lock screen. */
  title: string;
  body: string;
  route: string;
}

/** iOS silently caps pending local notifications at 64. */
export const IOS_PENDING_CAP = 64;

function parseHm(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function fireMinutesFor(prefs: NotificationPrefs): number {
  let minutes = prefs.hour * 60;
  if (prefs.quietStart && prefs.quietEnd) {
    const qs = parseHm(prefs.quietStart);
    const qe = parseHm(prefs.quietEnd);
    const inQuiet =
      qs <= qe ? minutes >= qs && minutes < qe : minutes >= qs || minutes < qe; // window may wrap midnight
    if (inQuiet) minutes = qe;
  }
  return minutes;
}

const GENERIC_TITLE = 'A medication needs attention';

/**
 * Plan the full desired set of pending alerts as of `today`.
 * Per runnable med: one alert at leadDays out, one at 3 days (urgent), one on
 * the run-out day. Past trigger days are skipped except run-out, which fires
 * next-day as an overdue nudge if still unresolved.
 */
export function planNotifications(
  meds: PlanMedInput[],
  prefs: NotificationPrefs,
  today: LocalDate,
): DesiredNotification[] {
  const minutes = fireMinutesFor(prefs);
  const out: DesiredNotification[] = [];

  for (const m of meds) {
    if (!m.active || m.prn || !m.runway) continue;
    if (prefs.mutedPatientIds.includes(m.patientId)) continue;

    const route = `/patient/${m.patientId}/med/${m.medicationId}`;
    const triggers: { tag: string; date: LocalDate; body: string }[] = [];

    const lead = addDays(m.runway.runOutDate, -Math.max(prefs.leadDays, 4));
    const urgent = addDays(m.runway.runOutDate, -3);
    const runout = m.runway.runOutDate;

    triggers.push({ tag: 'lead', date: lead, body: 'A refill is coming up. Open Hearth to see the runway.' });
    triggers.push({ tag: 'urgent', date: urgent, body: 'A refill is needed in the next few days.' });
    triggers.push({ tag: 'runout', date: runout, body: 'A medication runs out today. Open Hearth to act.' });
    if (compareLocalDates(runout, today) < 0) {
      triggers.push({
        tag: 'overdue',
        date: addDays(today, 1),
        body: 'A medication is past its supply. Open Hearth to resolve it.',
      });
    }

    for (const t of triggers) {
      if (compareLocalDates(t.date, today) <= 0 && t.tag !== 'overdue') continue; // past; foreground UI covers it
      if (t.tag === 'urgent' && compareLocalDates(t.date, lead) <= 0) continue; // collapsed windows
      out.push({
        key: `med:${m.medicationId}:${t.tag}:${t.date}`,
        fireDate: t.date,
        fireMinutes: minutes,
        title: GENERIC_TITLE,
        body: t.body,
        route,
      });
    }
  }

  // Nearest-first inside the iOS cap; ties by key for determinism.
  out.sort((a, b) => compareLocalDates(a.fireDate, b.fireDate) || a.key.localeCompare(b.key));
  return out.slice(0, IOS_PENDING_CAP);
}

export interface ReconcilePlan {
  toCancel: string[]; // existing keys no longer desired
  toSchedule: DesiredNotification[]; // desired keys not yet scheduled
}

export function reconcile(
  desired: DesiredNotification[],
  existingKeys: string[],
): ReconcilePlan {
  const want = new Map(desired.map((d) => [d.key, d]));
  const have = new Set(existingKeys);
  return {
    toCancel: existingKeys.filter((k) => !want.has(k)),
    toSchedule: desired.filter((d) => !have.has(d.key)),
  };
}
