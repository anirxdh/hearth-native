import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Observation } from '@rua/schema';
import { FormField, PillButton, Screen, SectionHeader, Seg, space } from '../../../../ds';
import { enterLead, enterRow } from '../../../../ds/motion';
import { addObservation, getPatient } from '../../../../db/repo';
import { nowIso } from '../../../../lib/clock';

type Kind = Observation['kind'];

const KINDS: { key: Kind; label: string }[] = [
  { key: 'note', label: 'Note' },
  { key: 'mood', label: 'Mood' },
  { key: 'appetite', label: 'Appetite' },
  { key: 'sleep', label: 'Sleep' },
  { key: 'incident', label: 'Incident' },
];

const PROMPTS: Record<Kind, string> = {
  note: 'Anything worth remembering for the next visit',
  mood: 'How did they seem today',
  appetite: 'How did meals go',
  sleep: 'How was last night',
  incident: 'What happened, when, and how it resolved',
};

export default function NewObservation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const patient = getPatient(id);

  const [kind, setKind] = useState<Kind>('note');
  const [text, setText] = useState('');

  if (!patient) {
    return (
      <Screen title="Not found">
        <PillButton label="Back" variant="outline" onPress={() => router.back()} />
      </Screen>
    );
  }

  function save() {
    if (text.trim().length < 3) {
      Alert.alert('A few words are needed', 'Write a short line; it becomes a question for the next visit.');
      return;
    }
    addObservation({ patientId: id, kind, text: text.trim(), at: nowIso() });
    router.back();
  }

  const name = patient.preferredName ?? patient.fullName;

  return (
    <Screen
      title="Log an observation"
      subline={`About ${name}. Two sentences now beat a fuzzy memory at the appointment.`}
    >
      <Animated.View entering={enterLead}>
        <SectionHeader label="What kind" />
        <Seg options={KINDS} value={kind} onChange={setKind} scroll />
      </Animated.View>

      <Animated.View entering={enterRow(1)} style={{ marginTop: space.lg }}>
        <FormField
          label={PROMPTS[kind]}
          value={text}
          onChangeText={setText}
          placeholder="Dizzy this morning getting up, passed in a minute..."
          multiline
        />
      </Animated.View>

      <Animated.View entering={enterRow(2)} style={{ flexDirection: 'row', gap: 10, marginTop: space.xl }}>
        <PillButton label="Save" onPress={save} />
        <PillButton label="Cancel" variant="outline" onPress={() => router.back()} />
      </Animated.View>
    </Screen>
  );
}
