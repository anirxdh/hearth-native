import React, { useState } from 'react';
import { Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Card, PillButton, Screen, StatusDot, space, type } from '../../ds';
import { enterLead, enterRow } from '../../ds/motion';
import { getPatient } from '../../db/repo';
import { setPatientWearableSource, syncWearables } from '../../lib/wearables';
import { infoDialog } from '../../lib/dialogs';
import { OnboardingSteps } from './ui';

/**
 * Step 5: the band. The demo band is a deterministic generator
 * (lib/wearables.ts) that feeds the same vitals table a real device would,
 * so charts and the digest are exercisable today; real devices connect on
 * the phone.
 */
export default function OnboardingWearables() {
  const router = useRouter();
  const { patientId } = useLocalSearchParams<{ patientId?: string }>();
  const patient = patientId ? getPatient(patientId) : undefined;
  const [readings, setReadings] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  function next() {
    router.push('/onboarding/done' as never);
  }

  async function connect() {
    if (!patient) return;
    setBusy(true);
    try {
      setPatientWearableSource(patient.id, 'demo-band');
      const result = await syncWearables();
      setReadings(result.readings);
    } catch (e) {
      infoDialog('Could not connect the band', String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!patient) {
    return (
      <Screen
        title="The daily rhythm"
        subline="Bands and watches can feed steps, sleep, and resting heart rate into a person's record."
      >
        <OnboardingSteps step={4} />
        <Animated.View entering={enterLead}>
          <Card>
            <Text style={type.detail}>
              A band connects to a person's record, and you have not added anyone yet. You can connect one
              later from a person's Activity tab.
            </Text>
          </Card>
        </Animated.View>
        <Animated.View entering={enterRow(1)}>
          <View style={{ marginTop: space.xl }} testID="ob-continue-wearables">
            <PillButton label="Continue" onPress={next} />
          </View>
        </Animated.View>
      </Screen>
    );
  }

  const name = patient.preferredName ?? patient.fullName.split(/\s+/)[0]!;

  return (
    <Screen
      title="The daily rhythm"
      subline="Awareness trends, never clinical alerts: steps, sleep, and resting heart rate."
    >
      <OnboardingSteps step={4} />
      <Animated.View entering={enterLead}>
        <Card>
          <Text style={type.heading}>A band or watch</Text>
          <Text style={[type.detail, { marginTop: 6 }]}>
            If {name} wears a band or watch, its daily rhythm can appear here. On this preview a demo band
            shows how it looks; real devices connect on the phone.
          </Text>
          {readings !== null ? (
            <View
              testID="ob-band-done"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: space.lg }}
            >
              <StatusDot status="green" />
              <Text style={type.mini}>{`Connected: ${readings} readings arrived`}</Text>
            </View>
          ) : (
            <View style={{ marginTop: space.lg }} testID="ob-connect-band">
              <PillButton label="Connect the demo band" onPress={() => void connect()} loading={busy} />
            </View>
          )}
        </Card>
      </Animated.View>
      <Animated.View entering={enterRow(1)}>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: space.xl }}>
          <View testID="ob-continue-wearables">
            <PillButton label="Continue" onPress={next} />
          </View>
          {readings === null ? (
            <View testID="ob-skip-wearables">
              <PillButton label="Skip" variant="outline" onPress={next} />
            </View>
          ) : null}
        </View>
      </Animated.View>
    </Screen>
  );
}
