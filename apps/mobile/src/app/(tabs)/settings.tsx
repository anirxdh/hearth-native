import React, { useEffect, useState } from 'react';
import { Alert, Platform, Switch, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
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
} from '../../ds';
import { enterLead, enterQuiet, enterRow } from '../../ds/motion';
import { getNotificationPrefs, getSetting, listPatients, setNotificationPrefs, setSetting } from '../../db/repo';
import { destroyAllData, getDb } from '../../db/client';
import { requestAppReboot } from '../../lib/reboot';
import { syncNotifications } from '../../lib/notifications';
import { useData } from '../../lib/useData';
import { ONBOARDING_DISCLAIMER } from '../../lib/copy';
import { seedDemoFamily } from '@hearth/schema';
import { exportBackup, importBackup, validPassphrase } from '../../lib/backup';
import { infoDialog, promptDialog } from '../../lib/dialogs';
import { confirmLoadDemoFamily } from '../../lib/demo';
import { today } from '../../lib/clock';
import { bumpDataVersion } from '../../lib/events';

export default function Settings() {
  const router = useRouter();
  const patients = useData(listPatients);
  const [prefs, setPrefs] = useState(getNotificationPrefs);
  const [pending, setPending] = useState<number | null>(null);
  const [appLock, setAppLock] = useState(() => getSetting<boolean>('appLock', false));
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

  const seed = confirmLoadDemoFamily;

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
              // Unmounts every screen and boots again; the app returns to
              // the threshold. No alert needed - the reset IS the feedback.
              requestAppReboot();
            }),
        },
      ],
    );
  }

  function askPassphrase(title: string, message: string, onOk: (p: string) => void) {
    void promptDialog({ title, message, secure: true }).then((p) => {
      if (p === null) return;
      const err = validPassphrase(p);
      if (err) infoDialog('Passphrase too short', err);
      else onOk(p);
    });
  }

  function doExport() {
    askPassphrase(
      'Choose a backup passphrase',
      'The backup file is encrypted with this passphrase. Without it, the file is unreadable; store it somewhere safe.',
      (p) => {
        exportBackup(p).catch((e) => Alert.alert('Backup failed', String(e)));
      },
    );
  }

  function doImport() {
    Alert.alert(
      'Restore from a backup?',
      'This REPLACES everything currently in Hearth on this phone with the backup contents.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Choose file',
          style: 'destructive',
          onPress: () =>
            askPassphrase('Backup passphrase', 'The passphrase chosen when this backup was exported.', (p) => {
              importBackup(p)
                .then((r) => {
                  if (r === 'done') {
                    bumpDataVersion();
                    syncNotifications().catch(() => {});
                    Alert.alert('Restored', 'The backup has been loaded.');
                  }
                })
                .catch((e) => Alert.alert('Restore failed', String(e)));
            }),
        },
      ],
    );
  }

  return (
    <Screen>
      <Animated.View entering={enterLead}>
        <Text style={type.title}>Settings</Text>
      </Animated.View>

      <Animated.View entering={enterRow(1)}>
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
      </Animated.View>

      <Animated.View entering={enterRow(2)}>
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
      </Animated.View>

      <Animated.View entering={enterRow(3)}>
      <SectionHeader label="Privacy" />
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11 }}>
        <View style={{ flex: 1 }}>
          <Text style={type.body}>Require Face ID to open Hearth</Text>
          <Text style={[type.mini, { marginTop: 2 }]}>Also asks after the app has been in the background</Text>
        </View>
        <Switch
          value={appLock}
          onValueChange={(on) => {
            setAppLock(on);
            setSetting('appLock', on);
          }}
          trackColor={{ true: color.ink, false: color.line }}
          thumbColor={color.paper}
        />
      </View>
      <Hairline />
      <ListRow
        title="Access log"
        detail="Every print, share, export, and sensitive read, newest first"
        onPress={() => router.push('/access-log' as never)}
      />
      <ListRow
        title="Export encrypted backup"
        detail="One file, locked with a passphrase you choose"
        onPress={doExport}
      />
      <ListRow
        title="Restore from backup"
        detail="Replaces what is on this phone"
        onPress={doImport}
        last
      />
      </Animated.View>

      <Animated.View entering={enterRow(4)}>
      <SectionHeader label="Data" />
      <ListRow title="Load the demo family" detail="Three fictional people to explore with" onPress={seed} />
      <ListRow title="Design gallery" detail="Every component in every state" onPress={() => router.push('/gallery' as never)} last />
      <View style={{ marginTop: space.xl }}>
        <PillButton label="Delete everything" variant="danger" size="sm" onPress={wipe} />
      </View>
      </Animated.View>

      <Animated.View entering={enterQuiet}>
      <SectionHeader label="About" />
      <Text style={type.detail}>
        Hearth {`0.1.0`} · Everything you enter stays on this phone, encrypted with a key that never leaves the iOS
        Keychain. No account, no analytics on health data, no sharing.
      </Text>
      <DisclaimerFootnote>{ONBOARDING_DISCLAIMER}</DisclaimerFootnote>
      </Animated.View>
      {Platform.OS === 'ios' ? (
        // Breathing room so the floating tab capsule never traps the last row.
        <View style={{ height: 128 }} />
      ) : null}
    </Screen>
  );
}
