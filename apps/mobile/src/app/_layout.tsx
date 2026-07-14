import '../lib/polyfills';
import React, { useEffect, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { bootDatabase, destroyAllData, type BootState } from '../db/client';
import { syncNotifications } from '../lib/notifications';
import { PillButton, Screen, color, space, type } from '../ds';
import { ErrorBoundary, Shields } from '../components/Shields';

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Boot-state recovery (P1 durability gate): the two key/DB mismatch states
 * get an explicit path forward instead of a crash loop, and a failed
 * migration reports itself after auto-restoring the pre-migration copy.
 */
function Recovery({ state, onReset }: { state: BootState; onReset: () => void }) {
  const copy =
    state.kind === 'db-without-key'
      ? {
          title: 'This data can no longer be unlocked',
          detail:
            'Hearth found a database on this device but its encryption key is gone from the Keychain. By design, the data cannot be read without the key. You can start fresh; a future encrypted backup will cover device moves.',
          action: 'Start fresh',
        }
      : state.kind === 'key-without-db'
        ? {
            title: 'No data found on this device',
            detail:
              'Your encryption key survived but the database file is missing (this can happen after a restore). You can start fresh with a new circle.',
            action: 'Start fresh',
          }
        : state.kind === 'boot-error'
          ? {
              title: 'Hearth could not start',
              detail: `Something on this device blocked startup (often a Keychain or storage issue). Your data was not touched. Restart the app; if this repeats, restart the phone. (${state.error})`,
              action: 'Try again',
            }
          : {
            title: 'An update could not be applied',
            detail: `Your data was restored to its state before the update and nothing was lost. Please try again; if this repeats, reinstalling the app update will fix it. (${state.kind === 'migration-failed' ? state.error : ''})`,
            action: 'Try again',
          };
  return (
    <Screen title={copy.title}>
      <Text style={type.detail}>{copy.detail}</Text>
      <View style={{ marginTop: space.xl }}>
        <PillButton label={copy.action} onPress={onReset} />
      </View>
    </Screen>
  );
}

export default function RootLayout() {
  const [boot, setBoot] = useState<BootState | null>(null);
  const router = useRouter();

  const doBoot = React.useCallback(() => {
    bootDatabase()
      .then(setBoot)
      .catch((e) => setBoot({ kind: 'boot-error', error: e instanceof Error ? e.message : String(e) }))
      .finally(() => SplashScreen.hideAsync().catch(() => {}));
  }, []);

  useEffect(doBoot, [doBoot]);

  // Recompute pending alerts whenever the app returns to the foreground.
  useEffect(() => {
    if (boot?.kind !== 'ready') return;
    syncNotifications().catch(() => {});
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') syncNotifications().catch(() => {});
    });
    return () => sub.remove();
  }, [boot?.kind]);

  // Tapping an alert deep-links to the medication it is about.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const route = resp.notification.request.content.data?.route;
      if (typeof route === 'string') router.push(route as never);
    });
    return () => sub.remove();
  }, [router]);

  if (!boot) return <View style={{ flex: 1, backgroundColor: color.paper }} />;

  if (boot.kind !== 'ready') {
    return (
      <Recovery
        state={boot}
        onReset={() => {
          // Only the two explicit start-fresh states may destroy data;
          // transient failures (migration, keychain) must never wipe.
          if (boot.kind === 'key-without-db' || boot.kind === 'db-without-key') {
            destroyAllData().then(() => {
              setBoot(null);
              doBoot();
            });
          } else {
            setBoot(null);
            doBoot();
          }
        }}
      />
    );
  }

  return (
    <ErrorBoundary>
      <Shields>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: color.paper },
          }}
        />
      </Shields>
    </ErrorBoundary>
  );
}
