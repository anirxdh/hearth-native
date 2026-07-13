import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { seedDemoFamily } from '@hearth/schema';
import { getDb } from '../../db/client';
import { listAllMedications, listPatients } from '../../db/repo';
import { bumpDataVersion } from '../../lib/events';
import { setSuppressPermissionRequest, syncNotifications } from '../../lib/notifications';
import { today } from '../../lib/clock';
import { Screen, type } from '../../ds';

/**
 * Dev-only helper for QA and screenshot automation: seeds the demo family
 * (if the circle is empty) and deep-links to a named screen, e.g.
 *   hearth:///dev/seed?go=home | patient | med | settings | gallery
 * Not part of any production flow; guarded by __DEV__.
 */
export default function DevSeed() {
  const router = useRouter();
  const { go } = useLocalSearchParams<{ go?: string }>();
  const [msg, setMsg] = useState('Seeding…');

  useEffect(() => {
    if (!__DEV__) {
      router.replace('/');
      return;
    }
    (async () => {
      try {
        setSuppressPermissionRequest(true);
        if (listPatients().length === 0) {
          await seedDemoFamily(getDb(), today());
          bumpDataVersion();
          await syncNotifications().catch(() => {});
        }
        const patients = listPatients();
        const robert = patients.find((p) => p.fullName.includes('Robert')) ?? patients[0];
        const meds = listAllMedications();
        const metformin =
          meds.find((m) => m.name.toLowerCase().includes('metformin')) ?? meds[0];
        const target =
          go === 'patient' && robert
            ? `/patient/${robert.id}`
            : go === 'med' && metformin
              ? `/patient/${metformin.patientId}/med/${metformin.id}`
              : go === 'settings'
                ? '/settings'
                : go === 'gallery'
                  ? '/gallery'
                  : '/';
        router.replace(target as never);
      } catch (e) {
        setMsg(`Seed failed: ${String(e)}`);
      }
    })();
  }, [go, router]);

  return (
    <Screen title="Dev seed">
      <Text style={type.detail}>{msg}</Text>
    </Screen>
  );
}
