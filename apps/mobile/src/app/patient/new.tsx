import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  CheckRow,
  DisclaimerFootnote,
  FormField,
  PillButton,
  Screen,
  SectionHeader,
  space,
  type,
} from '../../ds';
import { createPatient } from '../../db/repo';
import { nowIso } from '../../lib/clock';
import { ATTESTATION_EXPLAINER, ATTESTATION_TEXT, ONBOARDING_DISCLAIMER } from '../../lib/copy';
import { isValidLocalDate } from '@hearth/core';

export default function NewPatient() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [dob, setDob] = useState('');
  const [conditions, setConditions] = useState('');
  const [allergies, setAllergies] = useState('');
  const [attested, setAttested] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; dob?: string }>({});

  function save() {
    const errs: typeof errors = {};
    if (!fullName.trim()) errs.name = 'A name is required.';
    if (dob && !isValidLocalDate(dob)) errs.dob = 'Use YYYY-MM-DD.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    if (!attested) {
      Alert.alert('One confirmation needed', 'Please confirm you have permission to manage this person’s information.');
      return;
    }
    const p = createPatient({
      fullName: fullName.trim(),
      preferredName: preferredName.trim() || null,
      relationship: relationship.trim() || null,
      dob: dob || null,
      conditions: conditions
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
      allergies: allergies
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean)
        .map((name) => ({ name, reaction: '', severe: false })),
      attestationText: ATTESTATION_TEXT,
      attestationAt: nowIso(),
    });
    router.replace(`/patient/${p.id}` as never);
  }

  return (
    <Screen title="Add a person" subline="Someone you care for. You can add more detail any time.">
      <FormField
        label="Full name"
        value={fullName}
        onChangeText={setFullName}
        placeholder="Robert Alvarez"
        autoFocus
        {...(errors.name ? { error: errors.name } : {})}
      />
      <FormField label="What you call them" value={preferredName} onChangeText={setPreferredName} placeholder="Dad" />
      <FormField label="Relationship" value={relationship} onChangeText={setRelationship} placeholder="Father" />
      <FormField
        label="Date of birth"
        value={dob}
        onChangeText={setDob}
        placeholder="1945-02-14"
        hint="YYYY-MM-DD, optional"
        autoCapitalize="none"
        {...(errors.dob ? { error: errors.dob } : {})}
      />
      <SectionHeader label="Health basics" meta="optional" />
      <FormField
        label="Conditions"
        value={conditions}
        onChangeText={setConditions}
        placeholder="Type 2 diabetes, hypertension"
        hint="Comma separated"
      />
      <FormField
        label="Allergies"
        value={allergies}
        onChangeText={setAllergies}
        placeholder="Penicillin"
        hint="Comma separated"
      />

      <CheckRow checked={attested} onToggle={() => setAttested(!attested)} label={ATTESTATION_TEXT} />
      <Text style={[type.mini, { marginTop: 8 }]}>{ATTESTATION_EXPLAINER}</Text>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: space.xl }}>
        <PillButton label="Add person" onPress={save} />
        <PillButton label="Cancel" variant="outline" onPress={() => router.back()} />
      </View>
      <DisclaimerFootnote>{ONBOARDING_DISCLAIMER}</DisclaimerFootnote>
    </Screen>
  );
}
