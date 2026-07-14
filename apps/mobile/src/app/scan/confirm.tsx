import React, { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, TriangleAlert } from 'lucide-react-native';
import { matchRxNorm, normalizeName } from '@hearth/label-parser';
import { highAlertMatch, isValidLocalDate } from '@hearth/core';
import {
  Card,
  CheckRow,
  DisclaimerFootnote,
  FormField,
  PillButton,
  Screen,
  SectionHeader,
  StatusTag,
  color,
  radius,
  space,
  type,
} from '../../ds';
import { getPatient } from '../../db/repo';
import { createMedicationFromScan } from '../../db/scanRepo';
import { bumpDataVersion } from '../../lib/events';
import { infoDialog } from '../../lib/dialogs';
import { syncNotifications } from '../../lib/notifications';
import { RUNWAY_DISCLAIMER } from '../../lib/copy';
import { today } from '../../lib/clock';
import {
  clearPendingScan,
  formatPhone,
  getPendingScan,
  inferDosesPerDay,
  inferPrn,
  titleCase,
  type ScanFieldKey,
} from '../../lib/scanSession';

/** Below this parse confidence a field earns the amber Verify tag. */
const VERIFY_BELOW = 0.8;

const mono = {
  fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  fontSize: 12,
  lineHeight: 17,
  color: color.ink2,
} as const;

/**
 * Does the name printed on the label belong to the selected patient?
 * Last names must agree (case-insensitive, comma forms normalized), and
 * when both sides carry a first name those must agree too: a last-name-only
 * rule would wave through a spouse's bottle, which is exactly the household
 * mix-up this gate exists to catch.
 */
function namesMatch(labelRaw: string, patientFullName: string): boolean {
  const label = normalizeName(labelRaw).split(/\s+/).filter(Boolean);
  const mine = patientFullName.toUpperCase().replace(/\./g, '').split(/\s+/).filter(Boolean);
  if (label.length === 0 || mine.length === 0) return false;
  if (label[label.length - 1] !== mine[mine.length - 1]) return false;
  if (label.length === 1 || mine.length === 1) return true;
  const lf = label[0]!;
  const mf = mine[0]!;
  return lf === mf || lf.startsWith(mf) || mf.startsWith(lf);
}

/** One verification card: the raw line the value was read from, then the editable field. */
function ScanField({
  fieldKey,
  source,
  verify,
  children,
}: {
  fieldKey: ScanFieldKey;
  source: string | undefined;
  verify: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card style={{ marginTop: space.md }}>
      {verify ? (
        <View testID={`verify-${fieldKey}`} style={{ alignSelf: 'flex-end' }}>
          <StatusTag status="amber" label="Verify" />
        </View>
      ) : null}
      {source ? (
        <View
          style={{
            backgroundColor: color.hover,
            borderRadius: radius.sm,
            paddingHorizontal: 10,
            paddingVertical: 7,
            marginTop: verify ? space.sm : 0,
          }}
        >
          <Text style={mono} accessibilityLabel={`Read from the label: ${source}`}>
            {source}
          </Text>
        </View>
      ) : (
        <Text style={[type.mini, { marginTop: verify ? space.sm : 0 }]}>
          Not read from the label. Fill it in from the bottle if it matters.
        </Text>
      )}
      {children}
    </Card>
  );
}

export default function ScanConfirm() {
  const router = useRouter();
  const pending = getPendingScan();
  const patient = pending ? getPatient(pending.patientId) : undefined;

  const parsed = pending?.parsed ?? {};
  const sources = pending?.sources ?? {};

  const [name, setName] = useState(titleCase(parsed.drugName?.value ?? ''));
  const [strength, setStrength] = useState(() => {
    const v = parsed.strength?.value ?? '';
    return v === v.toUpperCase() ? v.toLowerCase() : v;
  });
  const [sig, setSig] = useState(() => {
    const v = parsed.sig?.value ?? '';
    return v === v.toUpperCase() ? v.charAt(0) + v.slice(1).toLowerCase() : v;
  });
  const [dosesPerDay, setDosesPerDay] = useState(() => {
    const d = inferDosesPerDay(parsed.sig?.value);
    return d == null ? '' : String(d);
  });
  const [prn, setPrn] = useState(() => inferPrn(parsed.sig?.value));
  const [fillDate, setFillDate] = useState(parsed.fillDate?.value ?? today());
  const [daySupply, setDaySupply] = useState(
    parsed.daySupply?.value != null ? String(parsed.daySupply.value) : '30',
  );
  const [quantity, setQuantity] = useState(
    parsed.quantity?.value != null ? String(parsed.quantity.value) : '',
  );
  const [rxNumber, setRxNumber] = useState(parsed.rxNumber?.value ?? '');
  const [pharmacy, setPharmacy] = useState(sources.pharmacy ?? '');
  const [pharmacyPhone, setPharmacyPhone] = useState(
    parsed.pharmacyPhone?.value ? formatPhone(parsed.pharmacyPhone.value) : '',
  );
  const [prescriber, setPrescriber] = useState(titleCase(sources.prescriber ?? ''));
  const [patientOverride, setPatientOverride] = useState(false);
  const [highAlertChecked, setHighAlertChecked] = useState(false);

  if (!pending || !patient) {
    return (
      <Screen title="Nothing to confirm">
        <Text style={type.detail}>Scan a label first; its fields land here for checking.</Text>
        <View style={{ marginTop: space.xl }}>
          <PillButton label="Go to scan" onPress={() => router.replace('/scan' as never)} />
        </View>
      </Screen>
    );
  }

  const displayName = patient.preferredName ?? patient.fullName;
  const labelName = parsed.patientName?.value;
  const mismatch = labelName ? !namesMatch(labelName, patient.fullName) : false;
  const saveBlocked = mismatch && !patientOverride;

  const rxMatch = name.trim() ? matchRxNorm(name) : null;
  const alert = name.trim() ? highAlertMatch(`${name} ${strength}`) : null;
  const highAlert = alert !== null || rxMatch?.entry.highAlertClass != null;
  const highAlertLabel =
    alert?.label ??
    (rxMatch?.entry.highAlertClass ? `High-alert class: ${rxMatch.entry.highAlertClass}` : null);

  /** Parse confidence per rendered card, for the Verify tags. */
  const confidence: Partial<Record<ScanFieldKey, number>> = {
    ...(parsed.drugName ? { name: parsed.drugName.confidence } : {}),
    ...(parsed.strength ? { strength: parsed.strength.confidence } : {}),
    ...(parsed.sig ? { sig: parsed.sig.confidence } : {}),
    ...(parsed.fillDate ? { fillDate: parsed.fillDate.confidence } : {}),
    ...(parsed.daySupply ? { daySupply: parsed.daySupply.confidence } : {}),
    ...(parsed.rxNumber ? { rxNumber: parsed.rxNumber.confidence } : {}),
    // Pharmacy and prescriber are positional guesses, never labeled
    // extractions; they always deserve a second look.
    ...(sources.pharmacy ? { pharmacy: 0.5 } : {}),
    ...(sources.prescriber ? { prescriber: 0.5 } : {}),
  };
  const verify = (k: ScanFieldKey): boolean => (confidence[k] ?? 0) < VERIFY_BELOW;

  function save() {
    if (!pending || !patient) return;
    if (!name.trim()) {
      infoDialog('Add the medication name', 'The name printed on the label is required.');
      return;
    }
    if (!isValidLocalDate(fillDate)) {
      infoDialog('Check the fill date', 'Use the format YYYY-MM-DD.');
      return;
    }
    const supply = Number(daySupply);
    if (!Number.isInteger(supply) || supply <= 0 || supply > 365) {
      infoDialog('Check the day supply', 'Use the number of days on the label, like 30 or 90.');
      return;
    }
    const doses = dosesPerDay.trim() ? Number(dosesPerDay) : null;
    if (doses != null && (!Number.isInteger(doses) || doses <= 0 || doses > 24)) {
      infoDialog('Check doses per day', 'Use a whole number like 1 or 2, or leave it blank.');
      return;
    }
    const qty = quantity.trim() ? Number(quantity) : null;
    if (qty != null && (!Number.isInteger(qty) || qty <= 0 || qty > 5000)) {
      infoDialog('Check the quantity', 'Use the count printed on the label, or leave it blank.');
      return;
    }
    const result = createMedicationFromScan(pending.patientId, {
      name: name.trim(),
      strength: strength.trim() || null,
      sig: sig.trim() || null,
      dosesPerDay: doses,
      prn,
      fillDate,
      daySupply: supply,
      quantity: qty,
      rxNumber: rxNumber.trim() || null,
      pharmacy: pharmacy.trim() || null,
      pharmacyPhone: pharmacyPhone.trim() || null,
      prescriber: prescriber.trim() || null,
      rxcui: rxMatch && rxMatch.entry.rxcui !== 'pending-verify' ? rxMatch.entry.rxcui : null,
      highAlert,
    });
    clearPendingScan();
    bumpDataVersion();
    syncNotifications().catch(() => {});
    infoDialog(
      result.kind === 'refill' ? 'Refill recorded' : 'Medication added',
      result.kind === 'refill'
        ? `${displayName} already takes this; the new fill now drives the runway.`
        : `Added to ${displayName}'s medications with its first fill.`,
    );
    router.replace(`/patient/${pending.patientId}/med/${result.medicationId}` as never);
  }

  return (
    <Screen>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/scan' as never))}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={{ marginBottom: space.md, flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 }}
      >
        <ChevronLeft size={18} color={color.ink2} strokeWidth={1.8} />
        <Text style={type.mini}>Scan</Text>
      </Pressable>

      <Text style={type.title} accessibilityRole="header">
        Check what was read
      </Text>
      <Text style={[type.detail, { marginTop: 6, marginBottom: space.md }]}>
        {`Each field shows the label text it came from. Correct anything before it joins ${displayName}'s record.`}
      </Text>

      {/* Patient-match gate (P22): a wrong-person save is the worst outcome. */}
      {labelName && !mismatch ? (
        <Text style={[type.mini, { marginBottom: 2 }]}>
          The label reads {labelName}, which matches {patient.fullName}.
        </Text>
      ) : null}
      {mismatch ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: color.red,
            borderRadius: radius.md,
            paddingHorizontal: 14,
            paddingVertical: 12,
            marginBottom: space.md,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TriangleAlert size={15} color={color.red} strokeWidth={2} />
            <Text style={[type.mini, { color: color.red, fontWeight: '600', flex: 1 }]}>
              {`The label reads ${labelName}, but you chose ${patient.fullName}.`}
            </Text>
          </View>
          <View testID="patient-override">
            <CheckRow
              checked={patientOverride}
              onToggle={() => setPatientOverride(!patientOverride)}
              label={`This is still ${displayName}'s medication`}
            />
          </View>
        </View>
      ) : null}

      <SectionHeader label="Medication" top={space.md} />
      <ScanField fieldKey="name" source={sources.name} verify={verify('name')}>
        <FormField label="Drug name" value={name} onChangeText={setName} placeholder="Metformin" />
        <View testID="rxnorm-status" style={{ marginTop: space.sm }}>
          {rxMatch ? (
            <StatusTag
              status="green"
              label={`RxNorm match: ${rxMatch.entry.name}, ${rxMatch.confidence}`}
            />
          ) : (
            <Text style={type.mini}>No RxNorm match, saved as typed</Text>
          )}
        </View>
      </ScanField>
      <ScanField fieldKey="strength" source={sources.strength} verify={verify('strength')}>
        <FormField label="Strength" value={strength} onChangeText={setStrength} placeholder="500 mg" />
      </ScanField>
      <ScanField fieldKey="sig" source={sources.sig} verify={verify('sig')}>
        <FormField
          label="Schedule (from the label)"
          value={sig}
          onChangeText={setSig}
          placeholder="1 tablet, twice daily with meals"
        />
        <FormField
          label="Doses per day"
          value={dosesPerDay}
          onChangeText={setDosesPerDay}
          keyboardType="number-pad"
          hint="Used for med-sync math; leave blank if unsure"
        />
        <CheckRow
          checked={prn}
          onToggle={() => setPrn(!prn)}
          label="As needed (PRN). No runway is forecast for as-needed medications."
        />
      </ScanField>

      <SectionHeader label="This fill" meta="drives the runway" />
      <ScanField fieldKey="fillDate" source={sources.fillDate} verify={verify('fillDate')}>
        <FormField
          label="Fill date"
          value={fillDate}
          onChangeText={setFillDate}
          hint="YYYY-MM-DD, printed on the label"
          autoCapitalize="none"
        />
      </ScanField>
      <ScanField fieldKey="daySupply" source={sources.daySupply} verify={verify('daySupply')}>
        <FormField
          label="Day supply"
          value={daySupply}
          onChangeText={setDaySupply}
          keyboardType="number-pad"
          hint="Days on the label, e.g. 30 or 90"
        />
        <FormField
          label="Quantity"
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="number-pad"
          hint="Count dispensed; optional"
        />
      </ScanField>

      <SectionHeader label="Refills come from" />
      <ScanField fieldKey="rxNumber" source={sources.rxNumber} verify={verify('rxNumber')}>
        <FormField label="Rx number" value={rxNumber} onChangeText={setRxNumber} autoCapitalize="none" />
      </ScanField>
      <ScanField fieldKey="pharmacy" source={sources.pharmacy} verify={verify('pharmacy')}>
        <FormField label="Pharmacy" value={pharmacy} onChangeText={setPharmacy} placeholder="CVS #2213" />
        <FormField
          label="Pharmacy phone"
          value={pharmacyPhone}
          onChangeText={setPharmacyPhone}
          keyboardType="phone-pad"
          placeholder="(415) 555-0301"
        />
      </ScanField>
      <ScanField fieldKey="prescriber" source={sources.prescriber} verify={verify('prescriber')}>
        <FormField label="Prescriber" value={prescriber} onChangeText={setPrescriber} placeholder="Dr. S. Chen" />
      </ScanField>

      {/* High-alert gate (P22): one more deliberate look, every time. */}
      {highAlert ? (
        <View
          style={{
            marginTop: space.xl,
            borderWidth: 1,
            borderColor: color.red,
            borderRadius: radius.md,
            paddingHorizontal: 14,
            paddingVertical: 12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TriangleAlert size={15} color={color.red} strokeWidth={2} />
            <Text style={[type.mini, { color: color.red, fontWeight: '600', flex: 1 }]}>
              {`High-alert medication${highAlertLabel ? `: ${highAlertLabel}` : ''}. A wrong entry here matters more than most.`}
            </Text>
          </View>
          <View testID="highalert-check">
            <CheckRow
              checked={highAlertChecked}
              onToggle={() => setHighAlertChecked(!highAlertChecked)}
              label="I checked this against the bottle, twice."
            />
          </View>
        </View>
      ) : null}

      {saveBlocked ? (
        <View
          testID="patient-mismatch"
          style={{ marginTop: space.xl }}
          accessible
          accessibilityLabel="Saving is paused until the patient name is confirmed"
        >
          <Text style={type.detail}>
            {`Saving is paused: the name on the label does not match ${patient.fullName}. If this really is ${displayName}'s medication, confirm that above.`}
          </Text>
        </View>
      ) : (
        <View style={{ marginTop: space.xl, alignSelf: 'flex-start' }} testID="scan-save">
          <PillButton
            label={`Add to ${displayName}'s medications`}
            onPress={save}
            disabled={highAlert && !highAlertChecked}
          />
          {highAlert && !highAlertChecked ? (
            <Text style={[type.mini, { marginTop: 6 }]}>
              Check the high-alert confirmation above to save.
            </Text>
          ) : null}
        </View>
      )}

      <DisclaimerFootnote>{RUNWAY_DISCLAIMER}</DisclaimerFootnote>
    </Screen>
  );
}
