import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, FormField, PillButton, Screen, space, type } from '../../ds';
import { authProvider, currentUser } from '../../lib/auth';
import { infoDialog } from '../../lib/dialogs';
import { OnboardingSteps } from './ui';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Step 1: welcome and the account. The account lives on this device today
 * (lib/auth.ts LocalAuthProvider); the signUp call is shaped exactly like
 * the hosted provider that replaces it, so this screen never changes.
 */
export default function OnboardingWelcome() {
  const router = useRouter();
  const existing = currentUser();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  function next() {
    router.push('/onboarding/security' as never);
  }

  async function create() {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = 'Your name is required.';
    if (!EMAIL_RE.test(email.trim())) errs.email = 'Enter a valid email address.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setBusy(true);
    try {
      await authProvider.signUp({ name: name.trim(), email: email.trim() });
      next();
    } catch (e) {
      infoDialog('Could not create the account', String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      title="Welcome to Hearth"
      subline="A calm command center for everyone you care for: medications, visits, papers, and the daily rhythm, all in one quiet place."
    >
      <OnboardingSteps step={1} />
      <Text style={type.detail}>
        Everything you enter stays on this phone, encrypted.
      </Text>

      {existing ? (
        <Card style={{ marginTop: space.xl }}>
          <Text style={type.heading}>Welcome back, {existing.name}</Text>
          <Text style={[type.detail, { marginTop: 6 }]}>
            Your account is already on this device. Pick up the setup where you left off.
          </Text>
          <View style={{ marginTop: space.lg }} testID="ob-continue-account">
            <PillButton label="Continue" onPress={next} />
          </View>
        </Card>
      ) : (
        <Card style={{ marginTop: space.xl }}>
          <Text style={type.heading}>Your account</Text>
          <Text style={[type.detail, { marginTop: 6 }]}>
            The account is how Hearth knows it is you. It is created on this phone, not on a server.
          </Text>
          <FormField
            label="Full name"
            value={name}
            onChangeText={setName}
            placeholder="Maria Alvarez"
            testID="ob-name"
            {...(errors.name ? { error: errors.name } : {})}
          />
          <FormField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="maria@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            testID="ob-email"
            {...(errors.email ? { error: errors.email } : {})}
          />
          <View style={{ marginTop: space.xl }} testID="ob-create">
            <PillButton label="Create account" onPress={() => void create()} loading={busy} />
          </View>
        </Card>
      )}
    </Screen>
  );
}
