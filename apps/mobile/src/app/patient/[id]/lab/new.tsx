import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { isValidLocalDate } from '@hearth/core';
import { CheckRow, FormField, PillButton, Screen, space } from '../../../../ds';
import { addLab, getPatient } from '../../../../db/repo';
import { today } from '../../../../lib/clock';

export default function NewLab() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const patient = getPatient(id);

  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('');
  const [refLow, setRefLow] = useState('');
  const [refHigh, setRefHigh] = useState('');
  const [abnormal, setAbnormal] = useState(false);
  const [collectedOn, setCollectedOn] = useState(today());
  const [source, setSource] = useState('');
  const [note, setNote] = useState('');

  if (!patient) {
    return (
      <Screen title="Not found">
        <PillButton label="Back" variant="outline" onPress={() => router.back()} />
      </Screen>
    );
  }

  function save() {
    if (!name.trim() || !value.trim()) {
      Alert.alert('Name and value are required', 'For example: HbA1c, 7.1.');
      return;
    }
    if (!isValidLocalDate(collectedOn)) {
      Alert.alert('Check the collection date', 'Use the format YYYY-MM-DD.');
      return;
    }
    addLab({
      patientId: id,
      name: name.trim(),
      value: value.trim(),
      unit: unit.trim() || null,
      refLow: refLow.trim() || null,
      refHigh: refHigh.trim() || null,
      abnormal,
      collectedOn,
      source: source.trim() || null,
      note: note.trim() || null,
    });
    router.back();
  }

  const displayName = patient.preferredName ?? patient.fullName;

  return (
    <Screen
      title="Add a lab result"
      subline={`For ${displayName}. Type the handful of numbers that matter from the report.`}
    >
      <View style={{ gap: space.md }}>
        <FormField label="Test name" value={name} onChangeText={setName} placeholder="HbA1c" />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <FormField label="Value" value={value} onChangeText={setValue} placeholder="7.1" />
          </View>
          <View style={{ flex: 1 }}>
            <FormField label="Unit (optional)" value={unit} onChangeText={setUnit} placeholder="%" />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <FormField label="Ref low (optional)" value={refLow} onChangeText={setRefLow} placeholder="4.0" />
          </View>
          <View style={{ flex: 1 }}>
            <FormField label="Ref high (optional)" value={refHigh} onChangeText={setRefHigh} placeholder="5.6" />
          </View>
        </View>
        <CheckRow
          label="Flagged out of range on the report"
          checked={abnormal}
          onToggle={() => setAbnormal((v) => !v)}
        />
        <FormField label="Collected on" value={collectedOn} onChangeText={setCollectedOn} placeholder={today()} />
        <FormField label="Lab (optional)" value={source} onChangeText={setSource} placeholder="Quest Diagnostics" />
        <FormField
          label="Note (optional)"
          value={note}
          onChangeText={setNote}
          placeholder="Dr. Okafor said to recheck in three months."
          multiline
        />
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: space.xl }}>
        <PillButton label="Save result" onPress={save} />
        <PillButton label="Cancel" variant="outline" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
