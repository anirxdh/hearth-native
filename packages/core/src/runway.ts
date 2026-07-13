/**
 * The medication runway engine: pure inventory arithmetic.
 *
 * runway = fill date + day supply, versus today. No inference, no AI, no
 * system clock. This is deliberately boring code with exhaustive tests,
 * because a wrong number here is the worst bug this product can have.
 */

import { LocalDate, addDays, daysBetween, maxLocalDate } from './dates';

export type RunwayStatus = 'ok' | 'soon' | 'urgent' | 'overdue';

export const RUNWAY_THRESHOLDS = {
  /** daysRemaining <= soon is "worth a look" */
  soon: 10,
  /** daysRemaining <= urgent is "act now" */
  urgent: 3,
} as const;

export interface FillInput {
  fillDate: LocalDate;
  daySupply: number;
}

export interface Runway {
  /** First calendar day the person is WITHOUT medication. */
  runOutDate: LocalDate;
  /** Days of supply left as of `today` (0 = runs out today, negative = overdue). */
  daysRemaining: number;
  status: RunwayStatus;
  /** 0..1 share of the fill still remaining, clamped. */
  fraction: number;
}

export function statusFor(daysRemaining: number): RunwayStatus {
  if (daysRemaining <= 0) return 'overdue';
  if (daysRemaining <= RUNWAY_THRESHOLDS.urgent) return 'urgent';
  if (daysRemaining <= RUNWAY_THRESHOLDS.soon) return 'soon';
  return 'ok';
}

/**
 * Compute the runway for the most recent fill.
 * Returns null for PRN/as-needed meds (no forecast is honest forecasting).
 */
export function computeRunway(fill: FillInput, today: LocalDate): Runway {
  if (!Number.isInteger(fill.daySupply) || fill.daySupply < 0) {
    throw new Error(`Invalid day supply: ${fill.daySupply}`);
  }
  const runOutDate = addDays(fill.fillDate, fill.daySupply);
  const daysRemaining = daysBetween(today, runOutDate);
  const fraction =
    fill.daySupply === 0 ? 0 : Math.min(1, Math.max(0, daysRemaining / fill.daySupply));
  return { runOutDate, daysRemaining, status: statusFor(daysRemaining), fraction };
}

/** The newest fill by fill date wins; created order breaks ties. */
export function latestFill<T extends { fillDate: LocalDate; createdAt: string }>(
  fills: T[],
): T | null {
  if (fills.length === 0) return null;
  return fills.reduce((best, f) => {
    const c = f.fillDate.localeCompare(best.fillDate);
    if (c > 0) return f;
    if (c === 0 && f.createdAt > best.createdAt) return f;
    return best;
  });
}

export interface MedSyncCandidate {
  medicationId: string;
  name: string;
  runOutDate: LocalDate;
  dosesPerDay: number | null;
}

export interface MedSyncPlan {
  /** Every med refilled on this day lands the whole regimen on one cycle. */
  alignDate: LocalDate;
  perMed: {
    medicationId: string;
    name: string;
    /** Days this med must bridge to reach the align date. */
    gapDays: number;
    /** Doses to request as a short fill (null when dosesPerDay unknown). */
    shortFillDoses: number | null;
  }[];
}

/**
 * Suggest one pickup day for a set of meds: the latest run-out date among
 * them, with per-med short-fill quantities to bridge the gap. Needs >= 2
 * meds with distinct run-out dates to be worth suggesting.
 */
export function medSyncPlan(candidates: MedSyncCandidate[]): MedSyncPlan | null {
  if (candidates.length < 2) return null;
  const align = maxLocalDate(candidates.map((c) => c.runOutDate));
  if (!align) return null;
  const distinct = new Set(candidates.map((c) => c.runOutDate));
  if (distinct.size < 2) return null;
  return {
    alignDate: align,
    perMed: candidates.map((c) => {
      const gapDays = daysBetween(c.runOutDate, align);
      return {
        medicationId: c.medicationId,
        name: c.name,
        gapDays,
        shortFillDoses: c.dosesPerDay == null ? null : gapDays * c.dosesPerDay,
      };
    }),
  };
}
