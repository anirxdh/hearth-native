import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { ChevronLeft } from 'lucide-react-native';
import {
  DisclaimerFootnote,
  FormField,
  Hairline,
  ListRow,
  PillButton,
  Screen,
  SectionHeader,
  color,
  space,
  type,
} from '../ds';
import { getNotificationPrefs, listPatients, setNotificationPrefs } from '../db/repo';
import { destroyAllData, getDb } from '../db/client';
import { syncNotifications } from '../lib/notifications';
import { useData } from '../lib/useData';
import { ONBOARDING_DISCLAIMER } from '../lib/copy';
import { seedDemoFamily } from '@hearth/schema';
import { today } from '../lib/clock';
import { bumpDataVersion } from '../lib/events';

export default function Settings() {
  const router = useRouter();
  const patients = useData(listPatients);
  const [prefs, setPrefs] = useState(getNotificationPrefs);
  const [pending, setPending] = useState<number | null>(null);
  const [leadDays, setLeadDays] = useState(String(prefs.leadDays));
  const [hour, setHour] = useState(String(prefs.hour));

  useEffect(() => {
    Notifications.getAllScheduledNotificationsAsync().then((n) => setPending(n.length));
  }, [prefs]);

  function commit(next: typeof prefs) {
    setPrefs(next);
    setNotificationPrefs(next);
    syncNotifications()
      .then(() => Notifications.getAllScheduledNotificationsAsync())
      .then((n) => setPending(n.length))
      .catch(() => {});
  }

  function commitNumbers() {
    const ld = Number(leadDays);
    const h = Number(hour);
    const next = {
      ...prefs,
      leadDays: Number.isInteger(ld) && ld >= 4 && ld <= 30 ? ld : prefs.leadDays,
      hour: Number.isInteger(h) && h >= 0 && h <= 23 ? h : prefs.hour,
    };
    setLeadDays(String(next.leadDays));
    setHour(String(next.hour));
    commit(next);
  }

  function seed() {
    Alert.alert('Load the demo family?', 'Adds three fictional people with realistic medications. For trying Hearth out.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Load demo',
        onPress: () => {
          seedDemoFamily(getDb(), today())
            .then(() => {
              bumpDataVersion();
              return syncNotifications();
            })
            .catch((e) => Alert.alert('Demo load failed', String(e)));
        },
      },
    ]);
  }

  function wipe() {
    Alert.alert(
      'Delete everything?',
      'Every person, medication, and log on this phone is permanently erased, along with the encryption key. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: () =>
            destroyAllData().then(async () => {
              await Notifications.cancelAllScheduledNotificationsAsync();
              Alert.alert('Erased', 'Hearth will restart empty.', [{ text: 'OK' }]);
            }),
        },
      ],
    );
  }

  return (
    <Screen>
      <Pressable onPress={() => router.back()} hitSlop={10} style={{ marginBottom: space.md, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <ChevronLeft size={18} color={color.ink2} strokeWidth={1.8} />
        <Text style={type.mini}>Home</Text>
      </Pressable>
      <Text style={type.title}>Settings</Text>

      <SectionHeader label="Refill alerts" meta={pending === null ? undefined : `${pending} scheduled`} />
      <Text style={type.detail}>
        Alerts are computed from each label's fill date and day supply, and pre-scheduled on this phone. Lock-screen
        text never includes a medication or person's name.
      </Text>
      <FormField
        label="First heads-up (days before run-out)"
        value={leadDays}
        onChangeText={setLeadDays}
        onBlur={commitNumbers}
        keyboardType="number-pad"
        hint="Minimum 4, so there is always time to act"
      />
      <FormField
        label="Alert hour (0-23)"
        value={hour}
        onChangeText={setHour}
        onBlur={commitNumbers}
        keyboardType="number-pad"
        hint="9 means alerts arrive at 9:00 AM"
      />

      {patients.length > 0 ? (
        <>
          <SectionHeader label="Per person" />
          {patients.map((p, i) => {
            const muted = prefs.mutedPatientIds.includes(p.id);
            return (
              <View key={p.id}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11 }}>
                  <Text style={[type.body, { flex: 1 }]}>{p.preferredName ?? p.fullName}</Text>
                  <Switch
                    value={!muted}
                    onValueChange={(on) =>
                      commit({
                        ...prefs,
                        mutedPatientIds: on
                          ? prefs.mutedPatientIds.filter((x) => x !== p.id)
                          : [...prefs.mutedPatientIds, p.id],
                      })
                    }
                    trackColor={{ true: color.ink, false: color.line }}
                    thumbColor={color.paper}
                  />
                </View>
                {i < patients.length - 1 ? <Hairline /> : null}
              </View>
            );
          })}
        </>
      ) : null}

      <SectionHeader label="Data" />
      <ListRow title="Load the demo family" detail="Three fictional people to explore with" onPress={seed} />
      <ListRow title="Design gallery" detail="Every component in every state" onPress={() => router.push('/gallery' as never)} last />
      <View style={{ marginTop: space.xl }}>
        <PillButton label="Delete everything" variant="danger" size="sm" onPress={wipe} />
      </View>

      <SectionHeader label="About" />
      <Text style={type.detail}>
        Hearth {`0.1.0`} · Everything you enter stays on this phone, encrypted with a key that never leaves the iOS
        Keychain. No account, no analytics on health data, no sharing.
      </Text>
      <DisclaimerFootnote>{ONBOARDING_DISCLAIMER}</DisclaimerFootnote>
    </Screen>
  );
}
