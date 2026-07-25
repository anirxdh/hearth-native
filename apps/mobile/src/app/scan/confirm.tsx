import React, { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { ChevronLeft, TriangleAlert } from 'lucide-react-native';
import { matchRxNorm, normalizeName } from '@rua/label-parser';
import { computeRunway, highAlertMatch, isValidLocalDate, type RunwayStatus } from '@rua/core';
import {
  Card,
  CheckRow,
  DisclaimerFootnote,
  FormField,
  PillButton,
  Screen,
  SectionHeader,
  StatusDot,
  StatusTag,
  color,
  hairline,
  radius,
  space,
  type,
} from '../../ds';
import { enterLead, enterQuiet, enterRow } from '../../ds/motion';
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

const statusToColor = (s: RunwayStatus): 'red' | 'amber' | 'green' =>
  s === 'overdue' || s === 'urgent' ? 'red' : s === 'soon' ? 'amber' : 'green';

/** 'YYYY-MM-DD' at UTC noon-free midnight, safe for calendar formatting. */
function localDateToUtc(d: string): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, day ?? 1));
}

/** 'Jun 29' */
const shortDate = (d: string): string =>
  localDateToUtc(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** 'Thu, Jul 16' */
const weekdayDate = (d: string): string =>
  localDateToUtc(d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

/**
 * The web MVP's .scanflow strip in editorial form: where this screen sits
 * in the scan story, with the middle step current.
 */
const STRIP_STEPS = [
  { n: 1, label: 'Scan the label', state: 'done' },
  { n: 2, label: 'Confirm the fields', state: 'current' },
  { n: 3, label: 'Added to their medications', state: 'todo' },
] as const;

function StepStrip() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: space.lg }}>
      {STRIP_STEPS.map((s, i) => (
        <View key={s.n} style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', height: 8 }}>
            <View
              style={{
                flex: 1,
                height: hairline,
                backgroundColor: i === 0 ? 'transparent' : color.line,
              }}
            />
            {s.state === 'current' ? (
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 3.5,
                  backgroundColor: color.ink,
                  marginHorizontal: 5,
                }}
              />
            ) : (
              <View style={{ marginHorizontal: 5 }}>
                <StatusDot status={s.state === 'done' ? 'green' : 'neutral'} />
              </View>
            )}
            <View
              style={{
                flex: 1,
                height: hairline,
                backgroundColor: i === STRIP_STEPS.length - 1 ? 'transparent' : color.line,
              }}
            />
          </View>
          <Text
            style={[
              type.label,
              {
                fontSize: 9.5,
                letterSpacing: 0.6,
                lineHeight: 14,
                textAlign: 'center',
                marginTop: 6,
                paddingHorizontal: 2,
              },
              s.state === 'current' ? { color: color.ink } : null,
            ]}
          >
            {`${s.n} · ${s.label}`}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** One cell of the result-card grid: small caps key, bold value. */
function ResultCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexBasis: '47%', flexGrow: 1 }}>
      <Text style={type.label}>{label}</Text>
      <Text style={[type.body, { fontSize: 13.5, lineHeight: 18, fontWeight: '600', marginTop: 3 }]}>
        {value}
      </Text>
    </View>
  );
}

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
  enterIndex,
  children,
}: {
  fieldKey: ScanFieldKey;
  source: string | undefined;
  verify: boolean;
  /** Position in the screen's entrance stagger; fires once at mount. */
  enterIndex: number;
  children: React.ReactNode;
}) {
  return (
    <Animated.View entering={enterRow(enterIndex)}>
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
    </Animated.View>
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

  // The result card mirrors the web MVP's .scanresult: what the save will
  // create, recomputed live from the editable fields above it.
  const supplyNum = Number(daySupply);
  const supplyOk = Number.isInteger(supplyNum) && supplyNum > 0 && supplyNum <= 365;
  const runway =
    !prn && supplyOk && isValidLocalDate(fillDate)
      ? computeRunway({ fillDate, daySupply: supplyNum }, today())
      : null;
  const medLine = [name.trim(), strength.trim()].filter(Boolean).join(' ') || 'Add the drug name';
  const whenLine = sig.trim()
    ? sig.trim()
    : prn
      ? 'As needed'
      : dosesPerDay.trim()
        ? `${dosesPerDay.trim()} ${dosesPerDay.trim() === '1' ? 'dose' : 'doses'} per day`
        : 'Not read from the label';
  const supplyLine = supplyOk
    ? `${supplyNum} days${isValidLocalDate(fillDate) ? ` · filled ${shortDate(fillDate)}` : ''}`
    : 'Check the day supply';
  const refillsLine =
    [pharmacy.trim(), prescriber.trim()].filter(Boolean).join(' · ') ||
    (rxNumber.trim() ? `Rx ${rxNumber.trim()}` : 'Not read from the label');

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

      <Animated.View entering={enterLead}>
        <StepStrip />

        <Text style={type.title} accessibilityRole="header">
          Check what was read
        </Text>
        <Text style={[type.detail, { marginTop: 6, marginBottom: space.md }]}>
          {`Each field shows the label text it came from. Correct anything before it joins ${displayName}'s record.`}
        </Text>
      </Animated.View>

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
      <ScanField fieldKey="name" source={sources.name} verify={verify('name')} enterIndex={1}>
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
      <ScanField fieldKey="strength" source={sources.strength} verify={verify('strength')} enterIndex={2}>
        <FormField label="Strength" value={strength} onChangeText={setStrength} placeholder="500 mg" />
      </ScanField>
      <ScanField fieldKey="sig" source={sources.sig} verify={verify('sig')} enterIndex={3}>
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
      <ScanField fieldKey="fillDate" source={sources.fillDate} verify={verify('fillDate')} enterIndex={4}>
        <FormField
          label="Fill date"
          value={fillDate}
          onChangeText={setFillDate}
          hint="YYYY-MM-DD, printed on the label"
          autoCapitalize="none"
        />
      </ScanField>
      <ScanField fieldKey="daySupply" source={sources.daySupply} verify={verify('daySupply')} enterIndex={5}>
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
      <ScanField fieldKey="rxNumber" source={sources.rxNumber} verify={verify('rxNumber')} enterIndex={6}>
        <FormField label="Rx number" value={rxNumber} onChangeText={setRxNumber} autoCapitalize="none" />
      </ScanField>
      <ScanField fieldKey="pharmacy" source={sources.pharmacy} verify={verify('pharmacy')} enterIndex={7}>
        <FormField label="Pharmacy" value={pharmacy} onChangeText={setPharmacy} placeholder="CVS #2213" />
        <FormField
          label="Pharmacy phone"
          value={pharmacyPhone}
          onChangeText={setPharmacyPhone}
          keyboardType="phone-pad"
          placeholder="(415) 555-0301"
        />
      </ScanField>
      <ScanField fieldKey="prescriber" source={sources.prescriber} verify={verify('prescriber')} enterIndex={8}>
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

      {/* The link between Scan and Medications (web MVP .scanresult): what
          this save creates, live from the fields above. */}
      <Animated.View entering={enterRow(8)}>
      <View testID="scan-result-card" style={{ marginTop: space.xl }}>
        <Card style={{ borderColor: color.lineStrong }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <StatusDot status="green" size={8} />
            <Text style={[type.detail, { color: color.ink, fontWeight: '600', flex: 1 }]}>
              {`Once confirmed, this is added to ${displayName}'s medications`}
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              columnGap: space.lg,
              rowGap: space.md,
              marginTop: space.lg,
            }}
          >
            <ResultCell label="Medication" value={medLine} />
            <ResultCell label="For" value={patient.fullName} />
            <ResultCell label="When to take" value={whenLine} />
            <ResultCell label="Supply" value={supplyLine} />
            <ResultCell label="Refills from" value={refillsLine} />
            <View style={{ flexBasis: '47%', flexGrow: 1 }}>
              <Text style={type.label}>Runway</Text>
              {runway ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <StatusDot status={statusToColor(runway.status)} />
                  <Text
                    style={[
                      type.body,
                      { fontSize: 13.5, lineHeight: 18, fontWeight: '600' },
                      runway.status !== 'ok'
                        ? { color: color[statusToColor(runway.status)] }
                        : null,
                    ]}
                  >
                    {runway.daysRemaining <= 0
                      ? `ran out ${weekdayDate(runway.runOutDate)}`
                      : `runs out ${weekdayDate(runway.runOutDate)}`}
                  </Text>
                </View>
              ) : (
                <Text style={[type.mini, { marginTop: 4 }]}>
                  {prn
                    ? 'No forecast for as-needed medications'
                    : 'Needs a valid fill date and day supply'}
                </Text>
              )}
            </View>
          </View>
        </Card>
      </View>
      </Animated.View>

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

      <Animated.View entering={enterQuiet}>
        <DisclaimerFootnote>{RUNWAY_DISCLAIMER}</DisclaimerFootnote>
      </Animated.View>
    </Screen>
  );
}
