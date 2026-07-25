import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { isValidLocalDate } from '@rua/core';
import type { Vital } from '@rua/schema';
import { FormField, PillButton, Screen, SectionHeader, Seg, space } from '../../../../ds';
import { enterLead, enterRow } from '../../../../ds/motion';
import { addVital, getPatient } from '../../../../db/repo';
import { nowIso, today } from '../../../../lib/clock';

type Kind = Vital['kind'];

const KINDS: { key: Kind; label: string; unit: string; placeholder: string }[] = [
  { key: 'bp', label: 'BP', unit: 'mmHg', placeholder: '128' },
  { key: 'weight', label: 'Weight', unit: 'lb', placeholder: '182' },
  { key: 'glucose', label: 'Glucose', unit: 'mg/dL', placeholder: '110' },
  { key: 'hr', label: 'Heart rate', unit: 'bpm', placeholder: '72' },
  { key: 'spo2', label: 'Oxygen', unit: '%', placeholder: '97' },
  { key: 'temp', label: 'Temp', unit: 'F', placeholder: '98.6' },
];

export default function NewVital() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const patient = getPatient(id);

  const [kind, setKind] = useState<Kind>('bp');
  const [value, setValue] = useState('');
  const [value2, setValue2] = useState('');
  const [recordedOn, setRecordedOn] = useState(today());
  const [note, setNote] = useState('');

  const active = KINDS.find((k) => k.key === kind)!;

  if (!patient) {
    return (
      <Screen title="Not found">
        <PillButton label="Back" variant="outline" onPress={() => router.back()} />
      </Screen>
    );
  }

  function save() {
    const v = Number(value);
    if (!Number.isFinite(v) || v <= 0) {
      Alert.alert('Check the reading', `Enter the ${active.label} number, like ${active.placeholder}.`);
      return;
    }
    let v2: number | null = null;
    if (kind === 'bp') {
      v2 = Number(value2);
      if (!Number.isFinite(v2) || v2 <= 0) {
        Alert.alert('Check the bottom number', 'Blood pressure needs both numbers, like 128 over 78.');
        return;
      }
    }
    if (!isValidLocalDate(recordedOn)) {
      Alert.alert('Check the date', 'Use the format YYYY-MM-DD.');
      return;
    }
    addVital({
      patientId: id,
      kind,
      value: v,
      value2: v2,
      unit: active.unit,
      recordedOn,
      recordedAt: recordedOn === today() ? nowIso() : `${recordedOn}T12:00:00.000Z`,
      note: note.trim() || null,
    });
    router.back();
  }

  const name = patient.preferredName ?? patient.fullName;

  return (
    <Screen title="Add a reading" subline={`For ${name}. Recorded readings feed the Activity trends.`}>
      <Animated.View entering={enterLead}>
        <SectionHeader label="What did you check" />
        <Seg options={KINDS.map(({ key, label }) => ({ key, label }))} value={kind} onChange={setKind} scroll />
      </Animated.View>

      <Animated.View entering={enterRow(1)} style={{ marginTop: space.lg, gap: space.md }}>
        <FormField
          label={kind === 'bp' ? `Top number (systolic), ${active.unit}` : `${active.label}, ${active.unit}`}
          value={value}
          onChangeText={setValue}
          placeholder={active.placeholder}
          keyboardType="decimal-pad"
        />
        {kind === 'bp' ? (
          <FormField
            label="Bottom number (diastolic), mmHg"
            value={value2}
            onChangeText={setValue2}
            placeholder="78"
            keyboardType="decimal-pad"
          />
        ) : null}
        <FormField label="Date checked" value={recordedOn} onChangeText={setRecordedOn} placeholder={today()} />
        <FormField label="Note (optional)" value={note} onChangeText={setNote} placeholder="After breakfast, left arm" />
      </Animated.View>

      <Animated.View entering={enterRow(2)} style={{ flexDirection: 'row', gap: 10, marginTop: space.xl }}>
        <PillButton label="Save reading" onPress={save} />
        <PillButton label="Cancel" variant="outline" onPress={() => router.back()} />
      </Animated.View>
    </Screen>
  );
}
