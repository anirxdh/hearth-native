import React, { useState } from 'react';
import { Alert, Linking, Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Pencil, Phone, TriangleAlert } from 'lucide-react-native';
import {
  Card,
  DisclaimerFootnote,
  FormField,
  Hairline,
  ListRow,
  PillButton,
  RunwayBar,
  Screen,
  SectionHeader,
  StatusTag,
  color,
  radius,
  space,
  type,
} from '../../../../../ds';
import { addFill, archiveMedication, getMedication, getPatient } from '../../../../../db/repo';
import { enterLead, enterQuiet, enterRow } from '../../../../../ds/motion';
import { syncNotifications } from '../../../../../lib/notifications';
import { useData } from '../../../../../lib/useData';
import { RUNWAY_DISCLAIMER } from '../../../../../lib/copy';
import { isValidLocalDate, type RunwayStatus } from '@hearth/core';
import { today } from '../../../../../lib/clock';

const statusToColor = (s: RunwayStatus): 'red' | 'amber' | 'green' =>
  s === 'overdue' || s === 'urgent' ? 'red' : s === 'soon' ? 'amber' : 'green';

const STATUS_LABEL: Record<RunwayStatus, string> = {
  overdue: 'Out of supply',
  urgent: 'Refill now',
  soon: 'Refill soon',
  ok: 'On track',
};

export default function MedicationDetail() {
  const { id, medId } = useLocalSearchParams<{ id: string; medId: string }>();
  const router = useRouter();
  const [showFill, setShowFill] = useState(false);
  const [fillDate, setFillDate] = useState(today());
  const [daySupply, setDaySupply] = useState('30');

  const data = useData(() => {
    const med = getMedication(medId);
    const patient = getPatient(id);
    return med && patient ? { med, patient } : null;
  });

  if (!data) {
    return (
      <Screen title="Not found">
        <PillButton label="Back" variant="outline" onPress={() => router.back()} />
      </Screen>
    );
  }
  const { med, patient } = data;
  const displayName = patient.preferredName ?? patient.fullName;

  function saveFill() {
    const supply = Number(daySupply);
    if (!isValidLocalDate(fillDate)) {
      Alert.alert('Check the fill date', 'Use the format YYYY-MM-DD.');
      return;
    }
    if (!Number.isInteger(supply) || supply <= 0 || supply > 365) {
      Alert.alert('Check the day supply', 'Use the number of days on the label.');
      return;
    }
    addFill(medId, { fillDate, daySupply: supply }, 'manual');
    setShowFill(false);
    syncNotifications().catch(() => {});
  }

  function archive() {
    Alert.alert(`Archive ${med.name}?`, 'It leaves the active list; its history is kept.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: () => {
          archiveMedication(medId);
          syncNotifications().catch(() => {});
          router.back();
        },
      },
    ]);
  }

  return (
    <Screen>
      <Animated.View entering={enterLead}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={{ marginBottom: space.md, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <ChevronLeft size={18} color={color.ink2} strokeWidth={1.8} />
          <Text style={type.mini}>{displayName}</Text>
        </Pressable>

        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={type.title}>
              {med.name}
              {med.strength ? <Text style={{ color: color.ink2 }}>{`  ${med.strength}`}</Text> : null}
            </Text>
            {med.sig ? <Text style={[type.detail, { marginTop: 5 }]}>{med.sig}</Text> : null}
          </View>
          <Pressable onPress={() => router.push(`/patient/${id}/med/${medId}/edit` as never)} hitSlop={10} accessibilityLabel="Edit medication">
            <Pencil size={19} color={color.ink2} strokeWidth={1.8} />
          </Pressable>
        </View>
      </Animated.View>

      <Animated.View entering={enterRow(1)}>
        {med.highAlert ? (
          <View
            style={{
              marginTop: space.lg,
              borderWidth: 1,
              borderColor: color.red,
              borderRadius: radius.md,
              paddingHorizontal: 14,
              paddingVertical: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <TriangleAlert size={15} color={color.red} strokeWidth={2} />
            <Text style={[type.mini, { color: color.red, fontWeight: '600', flex: 1 }]}>
              High-alert medication. Changes deserve a second look against the label.
            </Text>
          </View>
        ) : null}
      </Animated.View>

      <Animated.View entering={enterRow(2)}>
      <SectionHeader label="Runway" />
      {med.prn ? (
        <Card>
          <Text style={type.heading}>As needed</Text>
          <Text style={[type.detail, { marginTop: 4 }]}>
            No forecast for as-needed medications; that is honest forecasting.
          </Text>
        </Card>
      ) : med.runway ? (
        <Card {...(med.runway.status !== 'ok' ? { accent: statusToColor(med.runway.status) } : {})}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={type.stat}>
                {med.runway.daysRemaining <= 0
                  ? 'Out of supply'
                  : `${med.runway.daysRemaining} day${med.runway.daysRemaining === 1 ? '' : 's'} left`}
              </Text>
              <Text style={[type.mini, { marginTop: 3 }]}>
                {med.runway.daysRemaining <= 0 ? `Supply ended ${med.runway.runOutDate}` : `Supply ends ${med.runway.runOutDate}`}
              </Text>
            </View>
            <StatusTag status={statusToColor(med.runway.status)} label={STATUS_LABEL[med.runway.status]} />
          </View>
          <View style={{ marginTop: space.md }}>
            <RunwayBar fraction={med.runway.fraction} status={statusToColor(med.runway.status)} />
          </View>
          {med.pharmacyPhone ? (
            <View style={{ marginTop: space.lg, flexDirection: 'row', gap: 10 }}>
              <PillButton
                label={`Call ${med.pharmacy ?? 'pharmacy'}`}
                size="sm"
                onPress={() => Linking.openURL(`tel:${med.pharmacyPhone!.replace(/[^\d+]/g, '')}`)}
              />
            </View>
          ) : null}
        </Card>
      ) : (
        <Card accent="amber">
          <Text style={type.heading}>No fill on record</Text>
          <Text style={[type.detail, { marginTop: 4 }]}>
            Add the last fill date and day supply from the label to start the runway.
          </Text>
        </Card>
      )}
      </Animated.View>

      <Animated.View entering={enterRow(3)}>
        <SectionHeader label="Fill history" meta={med.fills.length ? `${med.fills.length}` : 'none yet'} />
        {med.fills.map((f, i) => (
          <ListRow
            key={f.id}
            title={`Filled ${f.fillDate}`}
            detail={`${f.daySupply}-day supply${f.quantity ? ` · qty ${f.quantity}` : ''} · ${f.source === 'scan' ? 'from scan' : 'entered by hand'}`}
            last={i === med.fills.length - 1}
          />
        ))}
        {!med.prn ? (
          showFill ? (
            <View>
              <FormField label="Fill date" value={fillDate} onChangeText={setFillDate} hint="YYYY-MM-DD" autoCapitalize="none" />
              <FormField label="Day supply" value={daySupply} onChangeText={setDaySupply} keyboardType="number-pad" />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: space.lg }}>
                <PillButton label="Save fill" onPress={saveFill} />
                <PillButton label="Cancel" variant="outline" onPress={() => setShowFill(false)} />
              </View>
            </View>
          ) : (
            <View style={{ marginTop: space.lg }}>
              <PillButton label="Record a fill" variant="outline" size="sm" onPress={() => setShowFill(true)} />
            </View>
          )
        ) : null}
      </Animated.View>

      {(med.prescriber || med.pharmacy) ? (
        <Animated.View entering={enterRow(4)}>
          <SectionHeader label="Refills come from" />
          {med.prescriber ? <ListRow title={med.prescriber} detail="Prescriber" last={!med.pharmacy} /> : null}
          {med.pharmacy ? (
            <ListRow
              title={med.pharmacy}
              detail="Pharmacy"
              last
              right={
                med.pharmacyPhone ? (
                  <Pressable
                    onPress={() => Linking.openURL(`tel:${med.pharmacyPhone!.replace(/[^\d+]/g, '')}`)}
                    hitSlop={8}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  >
                    <Phone size={14} color={color.ink2} strokeWidth={1.8} />
                    <Text style={[type.mini, { fontWeight: '600', color: color.ink }]}>{med.pharmacyPhone}</Text>
                  </Pressable>
                ) : undefined
              }
            />
          ) : null}
        </Animated.View>
      ) : null}

      <Animated.View entering={enterRow(5)} style={{ marginTop: space.xxl }}>
        <Hairline />
        <View style={{ marginTop: space.lg }}>
          <PillButton label="Archive medication" variant="danger" size="sm" onPress={archive} />
        </View>
      </Animated.View>
      <Animated.View entering={enterQuiet}>
        <DisclaimerFootnote>{RUNWAY_DISCLAIMER}</DisclaimerFootnote>
      </Animated.View>
    </Screen>
  );
}
