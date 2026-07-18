import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { isValidLocalDate } from '@hearth/core';
import { FormField, Hairline, PillButton, Screen, SectionHeader, Seg, color, space, type } from '../../../ds';
import { enterLead, enterQuiet, enterRow } from '../../../ds/motion';
import { archiveAppointment, getAppointment, updateAppointment } from '../../../db/apptRepo';
import { listPatients } from '../../../db/repo';
import { confirmDialog } from '../../../lib/dialogs';

const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

export default function EditAppointment() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const appt = getAppointment(id);
  const patients = listPatients();

  const [patientId, setPatientId] = useState(appt?.patientId ?? '');
  const [provider, setProvider] = useState(appt?.provider ?? '');
  const [specialty, setSpecialty] = useState(appt?.specialty ?? '');
  const [location, setLocation] = useState(appt?.location ?? '');
  const [phone, setPhone] = useState(appt?.phone ?? '');
  const [onDate, setOnDate] = useState(appt?.onDate ?? '');
  const [atTime, setAtTime] = useState(appt?.atTime ?? '');
  const [driver, setDriver] = useState(appt?.driver ?? '');
  const [bring, setBring] = useState(appt?.bring ?? '');
  const [purpose, setPurpose] = useState(appt?.purpose ?? '');
  const [errors, setErrors] = useState<{ provider?: string; onDate?: string; atTime?: string }>({});

  if (!appt) {
    return (
      <Screen title="Not found">
        <PillButton label="Back" variant="outline" onPress={() => router.back()} />
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

    updateAppointment(id, {
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

  function removeAppointment() {
    confirmDialog({
      title: 'Remove this appointment?',
      message: 'It leaves the list; the audit trail keeps a record that it existed.',
      confirmText: 'Remove',
      destructive: true,
      onConfirm: () => {
        archiveAppointment(id);
        router.back();
      },
    });
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
        <Text style={type.mini}>{appt.provider}</Text>
      </Pressable>

      <Animated.View entering={enterLead}>
        <Text style={type.title} accessibilityRole="header">
          Edit appointment
        </Text>
      </Animated.View>

      <Animated.View entering={enterRow(1)}>
        <View style={{ marginTop: space.lg }}>
          <Text style={[type.label, { marginBottom: 8 }]}>For</Text>
          <Seg
            options={patients.map((p) => ({ key: p.id, label: p.preferredName ?? p.fullName }))}
            value={patientId}
            onChange={setPatientId}
            scroll
          />
        </View>
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
      <FormField label="Specialty" value={specialty} onChangeText={setSpecialty} placeholder="cardiology" />
      <FormField
        label="Location"
        value={location}
        onChangeText={setLocation}
        placeholder="Mission Cardiology Clinic"
        hint="Clinic or practice name; it powers the directions links"
      />
      <FormField
        label="Clinic phone"
        value={phone}
        onChangeText={setPhone}
        placeholder="(415) 555-0128"
        keyboardType="phone-pad"
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
        {...(errors.atTime ? { error: errors.atTime } : {})}
      />
      </Animated.View>

      <Animated.View entering={enterRow(4)}>
      <SectionHeader label="Plan" meta="optional" />
      <FormField label="Who drives" value={driver} onChangeText={setDriver} placeholder="Maria" />
      <FormField
        label="Bring"
        value={bring}
        onChangeText={setBring}
        placeholder="sleep log, reading glasses"
        hint="Separate items with commas"
      />
      <FormField
        label="Purpose"
        value={purpose}
        onChangeText={setPurpose}
        placeholder="Heart rate has been creeping up"
      />
      </Animated.View>

      <Animated.View entering={enterRow(5)}>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: space.xl }}>
          <PillButton label="Save changes" onPress={save} />
          <PillButton label="Cancel" variant="outline" onPress={() => router.back()} />
        </View>
      </Animated.View>

      <Animated.View entering={enterQuiet}>
        <View style={{ marginTop: space.xxl }}>
          <Hairline />
          <View style={{ marginTop: space.lg }}>
            <PillButton label="Remove appointment" variant="danger" size="sm" onPress={removeAppointment} />
          </View>
        </View>
      </Animated.View>
    </Screen>
  );
}
