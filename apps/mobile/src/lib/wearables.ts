import { requireOptionalNativeModule } from 'expo-modules-core';
import { addDays, daysBetween, type LocalDate } from '@hearth/core';
import { addVital, getSetting, listPatients, setSetting } from '../db/repo';
import { bumpDataVersion } from './events';
import { today } from './clock';

/**
 * Wearable ingestion: bands and watches feed the SAME vitals table the
 * caregiver types into, so charts, prep sheets, and the digest need no new
 * plumbing. Signals are awareness trends, never clinical alerts.
 *
 * How band data is actually obtainable (researched, honest):
 * - HealthKit (free, on-device): DEVICE-OWNER ONLY. It works when the
 *   patient's own iPhone/Watch runs Hearth; iOS offers no API to read
 *   another person's Health data remotely. The adapter below calls an
 *   optional native module ('HearthHealthKit'); packaging that Swift module
 *   into the dev client is a TODO item alongside HearthVision.
 * - Vendor cloud APIs (Fitbit, Withings, Oura): the real cross-person path.
 *   The patient consents once via OAuth and the caregiver's app reads from
 *   the vendor cloud. Needs the P29 backend for token custody; documented
 *   in TODO.md, slots in as another adapter here.
 * - There is no MCP for this: MCP is a desktop/agent protocol, not an
 *   on-device health API.
 * - Demo band: a deterministic generator so the product (charts, digest,
 *   onboarding) is fully exercisable today and in E2E.
 */

export type WearableSource = 'none' | 'demo-band' | 'healthkit';

export type DailySummary = {
  date: LocalDate;
  restingHr?: number; // bpm
  steps?: number;
  sleepMinutes?: number;
};

const sourceKey = (patientId: string) => `wearables.source.${patientId}`;
const syncKey = (patientId: string) => `wearables.lastSync.${patientId}`;

export function getPatientWearableSource(patientId: string): WearableSource {
  return getSetting<WearableSource>(sourceKey(patientId), 'none');
}

export function setPatientWearableSource(patientId: string, source: WearableSource): void {
  setSetting(sourceKey(patientId), source);
  if (source === 'none') setSetting(syncKey(patientId), null);
  bumpDataVersion();
}

/* ---------- adapters ---------- */

/** Deterministic pseudo-band: same patient + date always yields the same numbers. */
function demoSummary(patientId: string, date: LocalDate): DailySummary {
  let h = 0;
  const s = `${patientId}:${date}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const pick = (span: number, base: number, shift: number) =>
    base + ((h >>> shift) % span);
  return {
    date,
    restingHr: pick(18, 64, 3), // 64-81 bpm
    steps: 1800 + ((h >>> 7) % 4800), // 1800-6599
    sleepMinutes: 330 + ((h >>> 11) % 180), // 5.5h-8.5h
  };
}

type HealthKitModule = {
  dailySummaries(sinceDate: string): Promise<DailySummary[]>;
};

/** Device-owner HealthKit, when the native module ships (TODO: packaging). */
function healthKit(): HealthKitModule | null {
  return requireOptionalNativeModule<HealthKitModule>('HearthHealthKit');
}

async function fetchSummaries(
  source: WearableSource,
  patientId: string,
  since: LocalDate,
  until: LocalDate,
): Promise<DailySummary[]> {
  if (source === 'demo-band') {
    const out: DailySummary[] = [];
    for (let d = addDays(since, 1); d <= until; d = addDays(d, 1)) {
      out.push(demoSummary(patientId, d));
    }
    return out;
  }
  if (source === 'healthkit') {
    const mod = healthKit();
    if (!mod) return []; // module not packaged yet: quietly no data
    return mod.dailySummaries(since);
  }
  return [];
}

/* ---------- ingestion ---------- */

/** How much history a fresh connection backfills. */
const BACKFILL_DAYS = 30;

/**
 * Pull new daily summaries for every connected patient into the vitals
 * table. Idempotent per day: lastSync advances only after a successful
 * write, and each day is written once.
 */
export async function syncWearables(): Promise<{ readings: number }> {
  const todayDate = today();
  let readings = 0;
  for (const p of listPatients()) {
    const source = getPatientWearableSource(p.id);
    if (source === 'none') continue;
    const last = getSetting<LocalDate | null>(syncKey(p.id), null);
    const since =
      last && daysBetween(last, todayDate) <= BACKFILL_DAYS ? last : addDays(todayDate, -BACKFILL_DAYS - 1);
    const summaries = await fetchSummaries(source, p.id, since, todayDate);
    for (const s of summaries) {
      const at = `${s.date}T08:00:00.000Z`;
      if (s.restingHr !== undefined) {
        addVital({ patientId: p.id, kind: 'hr', value: s.restingHr, value2: null, unit: 'bpm', recordedOn: s.date, recordedAt: at, note: 'from band' });
        readings++;
      }
      if (s.steps !== undefined) {
        addVital({ patientId: p.id, kind: 'steps', value: s.steps, value2: null, unit: 'steps', recordedOn: s.date, recordedAt: at, note: 'from band' });
        readings++;
      }
      if (s.sleepMinutes !== undefined) {
        addVital({ patientId: p.id, kind: 'sleep', value: s.sleepMinutes, value2: null, unit: 'min', recordedOn: s.date, recordedAt: at, note: 'from band' });
        readings++;
      }
      setSetting(syncKey(p.id), s.date);
    }
  }
  if (readings > 0) bumpDataVersion();
  return { readings };
}
