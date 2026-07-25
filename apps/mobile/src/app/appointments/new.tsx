import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { isValidLocalDate } from '@rua/core';
import { FormField, PillButton, Screen, SectionHeader, Seg, color, space, type } from '../../ds';
import { enterLead, enterRow } from '../../ds/motion';
import { createAppointment } from '../../db/apptRepo';
import { listPatients } from '../../db/repo';
import { today } from '../../lib/clock';

const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

export default function NewAppointment() {
  const { patientId: preselect } = useLocalSearchParams<{ patientId?: string }>();
  const router = useRouter();
  const patients = listPatients();

  const [patientId, setPatientId] = useState<string>(
    patients.some((p) => p.id === preselect) ? preselect! : (patients[0]?.id ?? ''),
  );
  const [provider, setProvider] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');
  const [onDate, setOnDate] = useState(today());
  const [atTime, setAtTime] = useState('');
  const [driver, setDriver] = useState('');
  const [bring, setBring] = useState('');
  const [purpose, setPurpose] = useState('');
  const [errors, setErrors] = useState<{ provider?: string; onDate?: string; atTime?: string }>({});

  if (patients.length === 0) {
    return (
      <Screen title="No one to book for" subline="Add a person to your circle first.">
        <Animated.View entering={enterLead}>
          <PillButton label="Back" variant="outline" onPress={() => router.back()} />
        </Animated.View>
      </Screen>
    );
  }

  const submittingRef = React.useRef(false);
  function save() {
    if (submittingRef.current) return;
    const next: typeof errors = {};
    if (!provider.trim()) next.provider = 'Who is the visit with?';
    if (!isValidLocalDate(onDate)) next.onDate = 'Use the format YYYY-MM-DD.';
    if (atTime.trim() && !TIME_RE.test(atTime.trim())) next.atTime = 'Use a time like 09:30 or 14:00.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    submittingRef.current = true;

    createAppointment({
      patientId,
      provider: provider.trim(),
      specialty: specialty.trim() || null,
      location: location.trim() || null,
      phone: phone.trim() || null,
      onDate,
      atTime: atTime.trim() || null,
      driver: driver.trim() || null,
      bring: bring.trim() || null,
      purpose: purpose.trim() || null,
    });
    router.back();
  }

  return (
    <Screen>
      <Pressable
        onPress={() => router.back()}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={{ marginBottom: space.md, flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 }}
      >
        <ChevronLeft size={18} color={color.ink2} strokeWidth={1.8} />
        <Text style={type.mini}>Appointments</Text>
      </Pressable>

      <Animated.View entering={enterLead}>
        <Text style={type.title} accessibilityRole="header">
          Add appointment
        </Text>
        <Text style={[type.detail, { marginTop: 6, marginBottom: space.lg }]}>
          RUA drafts the prep sheet from the record as the visit gets close.
        </Text>
      </Animated.View>

      <Animated.View entering={enterRow(1)}>
        <Text style={[type.label, { marginBottom: 8 }]}>For</Text>
        <Seg
          options={patients.map((p) => ({ key: p.id, label: p.preferredName ?? p.fullName }))}
          value={patientId}
          onChange={setPatientId}
          scroll
        />
      </Animated.View>

      <Animated.View entering={enterRow(2)}>
      <FormField
        label="Provider"
        value={provider}
        onChangeText={setProvider}
        placeholder="Dr. S. Chen"
        testID="appt-provider"
        {...(errors.provider ? { error: errors.provider } : {})}
      />
      <FormField
        label="Specialty"
        value={specialty}
        onChangeText={setSpecialty}
        placeholder="cardiology"
        testID="appt-specialty"
      />
      <FormField
        label="Location"
        value={location}
        onChangeText={setLocation}
        placeholder="Mission Cardiology Clinic"
        hint="Clinic or practice name; it powers the directions links"
        testID="appt-location"
      />
      <FormField
        label="Clinic phone"
        value={phone}
        onChangeText={setPhone}
        placeholder="(415) 555-0128"
        keyboardType="phone-pad"
        testID="appt-phone"
      />
      </Animated.View>

      <Animated.View entering={enterRow(3)}>
      <SectionHeader label="When" />
      <FormField
        label="Date"
        value={onDate}
        onChangeText={setOnDate}
        hint="YYYY-MM-DD"
        autoCapitalize="none"
        testID="appt-date"
        {...(errors.onDate ? { error: errors.onDate } : {})}
      />
      <FormField
        label="Time"
        value={atTime}
        onChangeText={setAtTime}
        placeholder="09:30"
        hint="Optional, 24-hour or H:MM"
        autoCapitalize="none"
        testID="appt-time"
        {...(errors.atTime ? { error: errors.atTime } : {})}
      />
      </Animated.View>

      <Animated.View entering={enterRow(4)}>
      <SectionHeader label="Plan" meta="optional" />
      <FormField
        label="Who drives"
        value={driver}
        onChangeText={setDriver}
        placeholder="Maria"
        testID="appt-driver"
      />
      <FormField
        label="Bring"
        value={bring}
        onChangeText={setBring}
        placeholder="sleep log, reading glasses"
        hint="Separate items with commas"
        testID="appt-bring"
      />
      <FormField
        label="Purpose"
        value={purpose}
        onChangeText={setPurpose}
        placeholder="Heart rate has been creeping up"
        testID="appt-purpose"
      />
      </Animated.View>

      <Animated.View entering={enterRow(5)}>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: space.xl }}>
          <PillButton label="Add appointment" onPress={save} />
          <PillButton label="Cancel" variant="outline" onPress={() => router.back()} />
        </View>
      </Animated.View>
    </Screen>
  );
}
