import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { TimelineEvent } from '@hearth/schema';
import { FormField, PillButton, Screen, SectionHeader, Seg, space } from '../../../../ds';
import { enterLead, enterRow } from '../../../../ds/motion';
import { addTimelineEvent, getPatient } from '../../../../db/repo';

type Kind = Exclude<TimelineEvent['kind'], 'med_change'>;

const KINDS: { key: Kind; label: string }[] = [
  { key: 'diagnosis', label: 'Diagnosis' },
  { key: 'hospitalization', label: 'Hospital stay' },
  { key: 'procedure', label: 'Procedure' },
  { key: 'other', label: 'Other' },
];

export default function NewTimelineEvent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const patient = getPatient(id);

  const [kind, setKind] = useState<Kind>('diagnosis');
  const [title, setTitle] = useState('');
  const [happenedOn, setHappenedOn] = useState('');
  const [detail, setDetail] = useState('');

  if (!patient) {
    return (
      <Screen title="Not found">
        <PillButton label="Back" variant="outline" onPress={() => router.back()} />
      </Screen>
    );
  }

  function save() {
    if (!title.trim()) {
      Alert.alert('A title is required', 'For example: "Atrial fibrillation diagnosed".');
      return;
    }
    const on = happenedOn.trim();
    if (!/^\d{4}$/.test(on) && !/^\d{4}-\d{2}-\d{2}$/.test(on)) {
      Alert.alert('Check the date', 'Use a year like 2022, or a full date like 2026-05-03.');
      return;
    }
    addTimelineEvent({
      patientId: id,
      kind,
      title: title.trim(),
      detail: detail.trim() || null,
      happenedOn: on,
    });
    router.back();
  }

  const name = patient.preferredName ?? patient.fullName;

  return (
    <Screen
      title="Add a history event"
      subline={`${name}'s story, the version a new clinician needs in one glance.`}
    >
      <Animated.View entering={enterLead}>
        <SectionHeader label="What kind" />
        <Seg options={KINDS} value={kind} onChange={setKind} scroll />
      </Animated.View>

      <Animated.View entering={enterRow(1)} style={{ marginTop: space.lg, gap: space.md }}>
        <FormField
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="Atrial fibrillation diagnosed"
        />
        <FormField
          label="When (a year, or YYYY-MM-DD)"
          value={happenedOn}
          onChangeText={setHappenedOn}
          placeholder="2022"
        />
        <FormField
          label="Detail (optional)"
          value={detail}
          onChangeText={setDetail}
          placeholder="Started apixaban, a blood thinner."
          multiline
        />
      </Animated.View>

      <Animated.View entering={enterRow(2)} style={{ flexDirection: 'row', gap: 10, marginTop: space.xl }}>
        <PillButton label="Save event" onPress={save} />
        <PillButton label="Cancel" variant="outline" onPress={() => router.back()} />
      </Animated.View>
    </Screen>
  );
}
