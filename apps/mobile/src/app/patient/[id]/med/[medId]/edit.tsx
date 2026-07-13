import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckRow, FormField, PillButton, Screen, SectionHeader, space } from '../../../../../ds';
import { getMedication, updateMedication } from '../../../../../db/repo';
import { syncNotifications } from '../../../../../lib/notifications';

export default function EditMedication() {
  const { medId } = useLocalSearchParams<{ id: string; medId: string }>();
  const router = useRouter();
  const med = getMedication(medId);

  const [name, setName] = useState(med?.name ?? '');
  const [strength, setStrength] = useState(med?.strength ?? '');
  const [sig, setSig] = useState(med?.sig ?? '');
  const [dosesPerDay, setDosesPerDay] = useState(med?.dosesPerDay?.toString() ?? '');
  const [prn, setPrn] = useState(med?.prn ?? false);
  const [prescriber, setPrescriber] = useState(med?.prescriber ?? '');
  const [pharmacy, setPharmacy] = useState(med?.pharmacy ?? '');
  const [pharmacyPhone, setPharmacyPhone] = useState(med?.pharmacyPhone ?? '');
  const [notes, setNotes] = useState(med?.notes ?? '');

  if (!med) {
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
    updateMedication(medId, {
      name: name.trim(),
      strength: strength.trim() || null,
      sig: sig.trim() || null,
      dosesPerDay: doses,
      prn,
      prescriber: prescriber.trim() || null,
      pharmacy: pharmacy.trim() || null,
      pharmacyPhone: pharmacyPhone.trim() || null,
      notes: notes.trim() || null,
    });
    syncNotifications().catch(() => {});
    router.back();
  }

  return (
    <Screen title={`Edit ${med.name}`}>
      <FormField label="Name" value={name} onChangeText={setName} />
      <FormField label="Strength" value={strength} onChangeText={setStrength} />
      <FormField label="Schedule (from the label)" value={sig} onChangeText={setSig} />
      <FormField label="Doses per day" value={dosesPerDay} onChangeText={setDosesPerDay} keyboardType="number-pad" />
      <CheckRow checked={prn} onToggle={() => setPrn(!prn)} label="As needed (PRN)" />
      <SectionHeader label="Refills" />
      <FormField label="Prescriber" value={prescriber} onChangeText={setPrescriber} />
      <FormField label="Pharmacy" value={pharmacy} onChangeText={setPharmacy} />
      <FormField label="Pharmacy phone" value={pharmacyPhone} onChangeText={setPharmacyPhone} keyboardType="phone-pad" />
      <FormField label="Notes" value={notes} onChangeText={setNotes} multiline />
      <View style={{ flexDirection: 'row', gap: 10, marginTop: space.xl }}>
        <PillButton label="Save" onPress={save} />
        <PillButton label="Cancel" variant="outline" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
