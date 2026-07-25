/**
 * Scan-to-medication writes (P23). One entry point: the confirm screen
 * hands over caregiver-verified fields and this decides refill-vs-new.
 *
 * Everything goes through the exported repo.ts write paths, so the
 * append-only change log, timeline events, and high-alert flags stay
 * consistent with every other write in the app; nothing here touches
 * tables directly.
 */
import type { NewMedication } from '@rua/schema';
import type { LocalDate } from '@rua/core';
import { normalizeDrugName, normalizeStrength } from '@rua/label-parser';
import { addFill, createMedication, listMedications, updateMedication } from './repo';

export interface ConfirmedScan {
  name: string;
  strength: string | null;
  sig: string | null;
  dosesPerDay: number | null;
  prn: boolean;
  fillDate: LocalDate;
  daySupply: number;
  quantity: number | null;
  rxNumber: string | null;
  pharmacy: string | null;
  pharmacyPhone: string | null;
  prescriber: string | null;
  /** RxNorm ingredient RXCUI when the name matched the bundled subset. */
  rxcui: string | null;
  /** From isHighAlert(name) or the RxNorm entry's high-alert class. */
  highAlert: boolean;
}

export type ScanSaveResult = { kind: 'refill' | 'new'; medicationId: string };

/** Same normalized name + same normalized strength = the same medication. */
function strengthKey(strength: string | null | undefined): string {
  return strength ? normalizeStrength(strength) : '';
}

/**
 * Save a confirmed scan for a patient.
 *
 * Duplicate detection: if this patient already has an active medication
 * with the same normalized drug name and strength, the scan is a REFILL
 * of that medication, not a new record: the fill is appended (source
 * 'scan') and details that changed on the label (sig, pharmacy, phone,
 * Rx number) are updated. Otherwise a new medication is created with its
 * first fill (source 'scan').
 */
export function createMedicationFromScan(
  patientId: string,
  confirmed: ConfirmedScan,
): ScanSaveResult {
  const nameKey = normalizeDrugName(confirmed.name);
  const sKey = strengthKey(confirmed.strength);
  const existing = listMedications(patientId).find(
    (m) => normalizeDrugName(m.name) === nameKey && strengthKey(m.strength) === sKey,
  );

  const fill = {
    fillDate: confirmed.fillDate,
    daySupply: confirmed.daySupply,
    ...(confirmed.quantity != null ? { quantity: confirmed.quantity } : {}),
  };

  if (existing) {
    addFill(existing.id, fill, 'scan');
    const patch: Partial<NewMedication> = {};
    if (confirmed.sig && confirmed.sig !== existing.sig) patch.sig = confirmed.sig;
    if (confirmed.pharmacy && confirmed.pharmacy !== existing.pharmacy) {
      patch.pharmacy = confirmed.pharmacy;
    }
    if (confirmed.pharmacyPhone && confirmed.pharmacyPhone !== existing.pharmacyPhone) {
      patch.pharmacyPhone = confirmed.pharmacyPhone;
    }
    if (confirmed.rxNumber && confirmed.rxNumber !== existing.rxNumber) {
      patch.rxNumber = confirmed.rxNumber;
    }
    if (confirmed.rxcui && confirmed.rxcui !== existing.rxcui) patch.rxcui = confirmed.rxcui;
    if (Object.keys(patch).length > 0) updateMedication(existing.id, patch);
    return { kind: 'refill', medicationId: existing.id };
  }

  const med = createMedication({
    patientId,
    name: confirmed.name,
    strength: confirmed.strength,
    sig: confirmed.sig,
    dosesPerDay: confirmed.dosesPerDay,
    prn: confirmed.prn,
    prescriber: confirmed.prescriber,
    pharmacy: confirmed.pharmacy,
    pharmacyPhone: confirmed.pharmacyPhone,
    rxNumber: confirmed.rxNumber,
    rxcui: confirmed.rxcui,
  });
  addFill(med.id, fill, 'scan');
  // repo.createMedication derives highAlert from the name; the scan can
  // know more (the RxNorm entry's high-alert class), so upgrade if needed.
  // Never downgrade: a name the bundled list flags stays flagged.
  if (confirmed.highAlert && !med.highAlert) {
    updateMedication(med.id, { highAlert: true });
  }
  return { kind: 'new', medicationId: med.id };
}
