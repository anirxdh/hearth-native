import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FormField, PillButton, Screen, SectionHeader, Seg, space, type } from '../../../ds';
import { enterLead, enterQuiet, enterRow } from '../../../ds/motion';
import { archivePatient, getPatient, updatePatient } from '../../../db/repo';
import { isValidLocalDate } from '@rua/core';

export default function EditPatient() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const patient = getPatient(id);

  const [fullName, setFullName] = useState(patient?.fullName ?? '');
  const [preferredName, setPreferredName] = useState(patient?.preferredName ?? '');
  const [relationship, setRelationship] = useState(patient?.relationship ?? '');
  const [dob, setDob] = useState(patient?.dob ?? '');
  const [sex, setSex] = useState<'male' | 'female' | null>(patient?.sex ?? null);
  const [conditions, setConditions] = useState(patient?.conditions.join(', ') ?? '');
  const [allergies, setAllergies] = useState(
    patient?.allergies.map((a) => (a.reaction ? `${a.name} (${a.reaction})` : a.name)).join(', ') ?? '',
  );
  const [notes, setNotes] = useState(patient?.notes ?? '');

  if (!patient) {
    return (
      <Screen title="Not found">
        <PillButton label="Back" variant="outline" onPress={() => router.back()} />
      </Screen>
    );
  }

  function save() {
    if (!fullName.trim()) return;
    if (dob && !isValidLocalDate(dob)) {
      Alert.alert('Check the date of birth', 'Use the format YYYY-MM-DD.');
      return;
    }
    updatePatient(id, {
      fullName: fullName.trim(),
      preferredName: preferredName.trim() || null,
      relationship: relationship.trim() || null,
      dob: dob || null,
      sex,
      conditions: conditions.split(',').map((c) => c.trim()).filter(Boolean),
      allergies: allergies
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean)
        .map((raw) => {
          const m = /^(.*?)\s*\((.+)\)\s*$/.exec(raw);
          const name = (m?.[1] ?? raw).trim();
          const reaction = m?.[2]?.trim() ?? '';
          return { name, reaction, severe: /anaphylaxis|severe/i.test(reaction) };
        }),
      notes: notes.trim() || null,
    });
    router.back();
  }

  function remove() {
    Alert.alert(
      `Remove ${patient!.preferredName ?? patient!.fullName}?`,
      'Their record is archived and disappears from your circle. This does not delete the underlying audit history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            archivePatient(id);
            router.dismissAll();
          },
        },
      ],
    );
  }

  return (
    <Screen title={`Edit ${patient.preferredName ?? patient.fullName}`}>
      <Animated.View entering={enterLead}>
        <FormField label="Full name" value={fullName} onChangeText={setFullName} />
        <FormField label="What you call them" value={preferredName} onChangeText={setPreferredName} />
        <FormField label="Relationship" value={relationship} onChangeText={setRelationship} />
        <FormField label="Date of birth" value={dob} onChangeText={setDob} hint="YYYY-MM-DD" autoCapitalize="none" />
      </Animated.View>
      <Animated.View entering={enterRow(1)}>
        <SectionHeader label="Health basics" />
        <View style={{ marginTop: space.lg }}>
          <Text style={[type.label, { marginBottom: 6 }]}>Sex</Text>
          <Seg
            options={[
              { key: 'male', label: 'Male', testID: 'patient-sex-male' },
              { key: 'female', label: 'Female', testID: 'patient-sex-female' },
              { key: 'unset', label: 'Prefer not to say' },
            ]}
            value={sex ?? 'unset'}
            onChange={(k) => setSex(k === 'unset' ? null : k)}
          />
          <Text style={[type.mini, { marginTop: 4 }]}>
            Only used to pick the right daily-needs table on the one-pager.
          </Text>
        </View>
        <FormField label="Conditions" value={conditions} onChangeText={setConditions} hint="Comma separated" />
        <FormField
          label="Allergies"
          value={allergies}
          onChangeText={setAllergies}
          hint="Comma separated; add the reaction in parentheses, e.g. Penicillin (anaphylaxis)"
        />
        <FormField label="Notes" value={notes} onChangeText={setNotes} multiline />
      </Animated.View>
      <Animated.View entering={enterRow(2)} style={{ flexDirection: 'row', gap: 10, marginTop: space.xl }}>
        <PillButton label="Save" onPress={save} />
        <PillButton label="Cancel" variant="outline" onPress={() => router.back()} />
      </Animated.View>
      <Animated.View entering={enterQuiet} style={{ marginTop: space.xxl }}>
        <PillButton label="Remove from circle" variant="danger" size="sm" onPress={remove} />
      </Animated.View>
    </Screen>
  );
}
