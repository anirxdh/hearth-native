import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Lock } from 'lucide-react-native';
import { PillButton, color, space, type } from '../ds';
import { getSetting } from '../db/repo';

/**
 * P13/P18 shields, both in one place:
 *
 * PrivacyShield covers the UI with plain paper the moment the app leaves the
 * foreground, so the iOS app switcher snapshot never shows care records.
 *
 * AppLockGate (opt-in, Settings) requires Face ID / passcode when the app
 * opens or returns from the background.
 */
export function Shields({ children }: { children: React.ReactNode }) {
  const [covered, setCovered] = useState(false);
  const [locked, setLocked] = useState(() => getSetting<boolean>('appLock', false));
  const authInFlight = useRef(false);

  const tryUnlock = useCallback(async () => {
    if (authInFlight.current) return;
    authInFlight.current = true;
    try {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock RUA',
      });
      if (res.success) setLocked(false);
    } finally {
      authInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    if (locked) void tryUnlock();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        setCovered(false);
      } else {
        setCovered(true);
        if (getSetting<boolean>('appLock', false)) setLocked(true);
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {covered || locked ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: color.paper,
            alignItems: 'center',
            justifyContent: 'center',
            gap: space.lg,
          }}
        >
          <Lock size={28} color={color.ink3} strokeWidth={1.6} />
          {locked && !covered ? (
            <>
              <Text style={type.detail}>RUA is locked.</Text>
              <PillButton label="Unlock with Face ID" onPress={() => void tryUnlock()} />
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** P18: a calm catch-all so no error ever strands a caregiver on a white screen. */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override render() {
    if (this.state.error) {
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: color.paper,
            alignItems: 'center',
            justifyContent: 'center',
            padding: space.xl,
            gap: space.md,
          }}
        >
          <Text style={type.title}>Something went wrong</Text>
          <Text style={[type.detail, { textAlign: 'center' }]}>
            Your data is safe on this phone. Try again; if this keeps happening, force-quit RUA and reopen it.
          </Text>
          <View style={{ marginTop: space.md }}>
            <PillButton label="Try again" onPress={() => this.setState({ error: null })} />
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}
