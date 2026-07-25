/**
 * Prep-sheet printing (P24), following the P14 print rules exactly:
 *  - every print of a care document is a sensitive read -> access log
 *  - the HTML is pure (lib/prepSheet.ts); this module only feeds expo-print
 */
import * as Print from 'expo-print';
import type { Appointment, Patient } from '@rua/schema';
import { logAccess } from '../db/repo';
import { prepSheetHtml, type PrepSheetData } from './prepSheet';

function generatedAt(): string {
  return new Date().toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** AirPrint the prep sheet for one visit. */
export async function printPrepSheet(
  patient: Patient,
  appt: Appointment,
  sheet: PrepSheetData,
): Promise<void> {
  logAccess('prep_sheet.print', patient.id);
  const html = prepSheetHtml({
    patientName: patient.fullName,
    dob: patient.dob,
    provider: appt.provider,
    specialty: appt.specialty,
    location: appt.location,
    onDate: appt.onDate,
    atTime: appt.atTime,
    driver: appt.driver,
    purpose: appt.purpose,
    sheet,
    generatedAt: generatedAt(),
  });
  await Print.printAsync({ html });
}
