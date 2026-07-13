import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FormField, PillButton, Screen, space } from '../../../../ds';
import { createContact, getPatient, listContacts } from '../../../../db/repo';

export default function NewContact() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const patient = getPatient(id);
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const [phone, setPhone] = useState('');

  if (!patient) {
    return (
      <Screen title="Not found">
        <PillButton label="Back" variant="outline" onPress={() => router.back()} />
      </Screen>
    );
  }

  function save() {
    if (!name.trim()) {
      Alert.alert('A name is required');
      return;
    }
    const kind = /dr\.?|doctor|md|cardiolog|neurolog|primary|clinic/i.test(relation)
      ? 'provider'
      : /pharmac|cvs|walgreens/i.test(`${name} ${relation}`)
        ? 'pharmacy'
        : 'emergency';
    createContact({
      patientId: id,
      name: name.trim(),
      relation: relation.trim() || null,
      phone: phone.trim() || null,
      kind,
      sortOrder: listContacts(id).length,
    });
    router.back();
  }

  return (
    <Screen
      title="Add a contact"
      subline={`For ${patient.preferredName ?? patient.fullName}: family, doctors, or the pharmacy.`}
    >
      <FormField label="Name" value={name} onChangeText={setName} placeholder="Maria Alvarez" autoFocus />
      <FormField label="Role" value={relation} onChangeText={setRelation} placeholder="Daughter, POA · or: Cardiology" />
      <FormField label="Phone" value={phone} onChangeText={setPhone} placeholder="(415) 555-0182" keyboardType="phone-pad" />
      <View style={{ flexDirection: 'row', gap: 10, marginTop: space.xl }}>
        <PillButton label="Add contact" onPress={save} />
        <PillButton label="Cancel" variant="outline" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
