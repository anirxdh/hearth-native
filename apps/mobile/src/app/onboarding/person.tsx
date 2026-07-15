import React, { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { isValidLocalDate } from '@hearth/core';
import {
  CheckRow,
  DisclaimerFootnote,
  FormField,
  PillButton,
  Screen,
  color,
  space,
  type,
} from '../../ds';
import { createPatient } from '../../db/repo';
import { infoDialog } from '../../lib/dialogs';
import { nowIso } from '../../lib/clock';
import { ATTESTATION_EXPLAINER, ATTESTATION_TEXT, ONBOARDING_DISCLAIMER } from '../../lib/copy';
import { OnboardingSteps } from './ui';

/**
 * Step 3: the first person in the circle. Same validation and the same
 * caregiver-authority attestation as app/patient/new.tsx, plus an optional
 * photo picked from the library (a file input on the web preview).
 */
export default function OnboardingPerson() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [dob, setDob] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [attested, setAttested] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; dob?: string }>({});

  async function pickPhoto() {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      });
      const asset = res.assets?.[0];
      if (res.canceled || !asset) return;
      setPhotoUri(asset.uri);
    } catch (e) {
      infoDialog('Could not add the photo', String(e));
    }
  }

  function save() {
    const errs: typeof errors = {};
    if (!fullName.trim()) errs.name = 'A name is required.';
    if (dob && !isValidLocalDate(dob)) errs.dob = 'Use YYYY-MM-DD.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    if (!attested) {
      infoDialog(
        'One confirmation needed',
        'Please confirm you have permission to manage this person’s information.',
      );
      return;
    }
    const p = createPatient({
      fullName: fullName.trim(),
      preferredName: null,
      relationship: relationship.trim() || null,
      dob: dob || null,
      photoUri,
      conditions: [],
      allergies: [],
      attestationText: ATTESTATION_TEXT,
      attestationAt: nowIso(),
    });
    router.push(`/onboarding/uploads?patientId=${p.id}` as never);
  }

  const firstName = fullName.trim().split(/\s+/)[0] || 'them';

  return (
    <Screen
      title="Who do you care for?"
      subline="Start with one person. You can add more detail, and more people, any time."
    >
      <OnboardingSteps step={3} />
      <FormField
        label="Full name"
        value={fullName}
        onChangeText={setFullName}
        placeholder="Robert Alvarez"
        testID="ob-person-name"
        {...(errors.name ? { error: errors.name } : {})}
      />
      <FormField
        label="Relationship"
        value={relationship}
        onChangeText={setRelationship}
        placeholder="Dad"
        testID="ob-person-relationship"
      />
      <FormField
        label="Date of birth"
        value={dob}
        onChangeText={setDob}
        placeholder="1945-02-14"
        hint="YYYY-MM-DD, optional"
        autoCapitalize="none"
        testID="ob-person-dob"
        {...(errors.dob ? { error: errors.dob } : {})}
      />

      {photoUri ? (
        <View
          testID="ob-photo-set"
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg }}
        >
          <Image
            source={{ uri: photoUri }}
            accessibilityLabel="Photo preview"
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: color.lineStrong,
            }}
          />
          <Text style={type.mini}>Photo added</Text>
        </View>
      ) : (
        <View style={{ marginTop: space.lg }} testID="ob-photo">
          <PillButton label="Add a photo" variant="outline" size="sm" onPress={() => void pickPhoto()} />
        </View>
      )}

      <View testID="ob-attest">
        <CheckRow checked={attested} onToggle={() => setAttested(!attested)} label={ATTESTATION_TEXT} />
      </View>
      <Text style={[type.mini, { marginTop: 8 }]}>{ATTESTATION_EXPLAINER}</Text>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: space.xl }}>
        <View testID="ob-person-save">
          <PillButton label={fullName.trim() ? `Add ${firstName}` : 'Add person'} onPress={save} />
        </View>
        <View testID="ob-skip-person">
          <PillButton
            label="Skip"
            variant="outline"
            onPress={() => router.push('/onboarding/uploads' as never)}
          />
        </View>
      </View>
      <DisclaimerFootnote>{ONBOARDING_DISCLAIMER}</DisclaimerFootnote>
    </Screen>
  );
}
