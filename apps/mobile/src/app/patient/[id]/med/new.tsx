import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { TriangleAlert } from 'lucide-react-native';
import {
  CheckRow,
  DisclaimerFootnote,
  FormField,
  PillButton,
  Screen,
  SectionHeader,
  color,
  radius,
  space,
  type,
} from '../../../../ds';
import { createMedication, getPatient } from '../../../../db/repo';
import { RUNWAY_DISCLAIMER } from '../../../../lib/copy';
import { highAlertMatch, isValidLocalDate } from '@hearth/core';
import { today } from '../../../../lib/clock';

export default function NewMedication() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const patient = getPatient(id);

  const [name, setName] = useState('');
  const [strength, setStrength] = useState('');
  const [sig, setSig] = useState('');
  const [dosesPerDay, setDosesPerDay] = useState('');
  const [prn, setPrn] = useState(false);
  const [prescriber, setPrescriber] = useState('');
  const [pharmacy, setPharmacy] = useState('');
  const [pharmacyPhone, setPharmacyPhone] = useState('');
  const [fillDate, setFillDate] = useState(today());
  const [daySupply, setDaySupply] = useState('30');
  const [noFillYet, setNoFillYet] = useState(false);

  const alert = name.trim() ? highAlertMatch(name) : null;

  if (!patient) {
    return (
      <Screen title="Not found">
        <PillButton label="Back" variant="outline" onPress={() => router.back()} />
      </Screen>
    );
  }

  function save() {
    if (!name.trim()) {
      Alert.alert('A medication name is required');
      return;
    }
    const doses = dosesPerDay ? Number(dosesPerDay) : null;
    if (dosesPerDay && (!Number.isInteger(doses) || doses! <= 0 || doses! > 24)) {
      Alert.alert('Check doses per day', 'Use a whole number like 1 or 2.');
      return;
    }
    let fill: { fillDate: string; daySupply: number } | undefined;
    if (!prn && !noFillYet) {
      const supply = Number(daySupply);
      if (!isValidLocalDate(fillDate)) {
        Alert.alert('Check the fill date', 'Use the format YYYY-MM-DD.');
        return;
      }
      if (!Number.isInteger(supply) || supply <= 0 || supply > 365) {
        Alert.alert('Check the day supply', 'Use the number of days on the label, like 30 or 90.');
        return;
      }
      fill = { fillDate, daySupply: supply };
    }
    const saveIt = () => {
      const med = createMedication(
        {
          patientId: id,
          name: name.trim(),
          strength: strength.trim() || null,
          sig: sig.trim() || null,
          dosesPerDay: doses,
          prn,
          prescriber: prescriber.trim() || null,
          pharmacy: pharmacy.trim() || null,
          pharmacyPhone: pharmacyPhone.trim() || null,
        },
        fill,
      );
      router.replace(`/patient/${id}/med/${med.id}` as never);
    };
    if (alert) {
      // High-alert gate: an extra deliberate confirmation, every time.
      Alert.alert(
        'High-alert medication',
        `${name.trim()} matches: ${alert.label}. Please double-check the name, strength, and schedule against the label before saving.`,
        [
          { text: 'Review again', style: 'cancel' },
          { text: 'I checked the label. Save.', onPress: saveIt },
        ],
      );
    } else {
      saveIt();
    }
  }

  return (
    <Screen
      title="Add a medication"
      subline={`For ${patient.preferredName ?? patient.fullName}. Copy the label; Hearth does the arithmetic.`}
    >
      <FormField label="Name" value={name} onChangeText={setName} placeholder="Metformin" autoFocus />
      {alert ? (
        <View
          style={{
            marginTop: 10,
            borderWidth: 1,
            borderColor: color.red,
            borderRadius: radius.md,
            paddingHorizontal: 12,
            paddingVertical: 9,
            flexDirection: 'row',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <TriangleAlert size={14} color={color.red} strokeWidth={2} />
          <Text style={[type.mini, { color: color.red, fontWeight: '600', flex: 1 }]}>
            {alert.label}. Hearth will ask for an extra confirmation.
          </Text>
        </View>
      ) : null}
      <FormField label="Strength" value={strength} onChangeText={setStrength} placeholder="500 mg" />
      <FormField label="Schedule (from the label)" value={sig} onChangeText={setSig} placeholder="1 tablet, twice daily with meals" />
      <FormField
        label="Doses per day"
        value={dosesPerDay}
        onChangeText={setDosesPerDay}
        placeholder="2"
        keyboardType="number-pad"
        hint="Used for med-sync math; leave blank if unsure"
      />
      <CheckRow checked={prn} onToggle={() => setPrn(!prn)} label="As needed (PRN). No runway is forecast for as-needed medications." />

      {!prn ? (
        <>
          <SectionHeader label="Last fill" meta="drives the runway" />
          <CheckRow checked={noFillYet} onToggle={() => setNoFillYet(!noFillYet)} label="I don't have the fill information yet" />
          {!noFillYet ? (
            <>
              <FormField label="Fill date" value={fillDate} onChangeText={setFillDate} hint="YYYY-MM-DD, printed on the label" autoCapitalize="none" />
              <FormField label="Day supply" value={daySupply} onChangeText={setDaySupply} keyboardType="number-pad" hint="Days on the label, e.g. 30 or 90" />
            </>
          ) : null}
        </>
      ) : null}

      <SectionHeader label="Refills" meta="optional" />
      <FormField label="Prescriber" value={prescriber} onChangeText={setPrescriber} placeholder="Dr. S. Chen" />
      <FormField label="Pharmacy" value={pharmacy} onChangeText={setPharmacy} placeholder="CVS #2213" />
      <FormField label="Pharmacy phone" value={pharmacyPhone} onChangeText={setPharmacyPhone} placeholder="(415) 555-0301" keyboardType="phone-pad" />

      <View style={{ flexDirection: 'row', gap: 10, marginTop: space.xl }}>
        <PillButton label="Add medication" onPress={save} />
        <PillButton label="Cancel" variant="outline" onPress={() => router.back()} />
      </View>
      <DisclaimerFootnote>{RUNWAY_DISCLAIMER}</DisclaimerFootnote>
    </Screen>
  );
}
