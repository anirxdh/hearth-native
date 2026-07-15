import React, { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { Card, PillButton, Screen, StatusDot, space, type } from '../../ds';
import { setSetting } from '../../db/repo';
import { OnboardingSteps } from './ui';

/**
 * Step 2: the Face ID lock. Turning it on sets the same 'appLock' setting
 * Settings uses; the Shields gate in app/_layout.tsx enforces it. The same
 * biometric also signs the caregiver back in quietly when the session
 * expires (lib/auth.ts ensureFreshSession).
 */
export default function OnboardingSecurity() {
  const router = useRouter();
  const isWeb = Platform.OS === 'web';
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  function next() {
    router.push('/onboarding/person' as never);
  }

  async function turnOn() {
    setBusy(true);
    try {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Turn on Face ID for Hearth',
        cancelLabel: 'Cancel',
      });
      if (res.success) {
        setSetting('appLock', true);
        setEnabled(true);
      }
    } catch {
      // Face ID unavailable or declined: the lock simply stays off.
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Lock it to your face" subline="One more layer between care records and anyone who picks up the phone.">
      <OnboardingSteps step={2} />
      <Card>
        <Text style={type.heading}>Face ID</Text>
        <Text style={[type.detail, { marginTop: 6 }]}>
          Require Face ID to open Hearth. Also used to sign you back in quietly when your session expires.
        </Text>
        {enabled ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: space.lg }}>
            <StatusDot status="green" />
            <Text style={type.mini}>Face ID is on</Text>
          </View>
        ) : isWeb ? (
          <Text style={[type.mini, { marginTop: space.lg }]}>
            Not available in the browser preview. On the phone, Hearth asks for Face ID here.
          </Text>
        ) : (
          <View style={{ marginTop: space.lg }} testID="ob-faceid">
            <PillButton label="Turn on Face ID" onPress={() => void turnOn()} loading={busy} />
          </View>
        )}
      </Card>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: space.xl }}>
        <View testID="ob-continue-security">
          <PillButton label="Continue" onPress={next} />
        </View>
        <View testID="ob-skip-security">
          <PillButton label="Skip for now" variant="outline" onPress={next} />
        </View>
      </View>
      <Text style={[type.mini, { marginTop: space.lg }]}>
        You can turn this on or off any time in Settings.
      </Text>
    </Screen>
  );
}
