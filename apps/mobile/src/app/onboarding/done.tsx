import React from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { ListRow, PillButton, Screen, SectionHeader, space } from '../../ds';
import { enterLead, enterRow } from '../../ds/motion';
import { listDocuments, listPatients, listVitals } from '../../db/repo';
import { currentUser } from '../../lib/auth';
import { useData } from '../../lib/useData';

/**
 * Arrival: a plain reading of what now exists, straight from the repo, and
 * one door into the app.
 */
export default function OnboardingDone() {
  const router = useRouter();
  const data = useData(() => {
    const patients = listPatients();
    const documents = patients.reduce((n, p) => n + listDocuments(p.id).length, 0);
    const bandReadings = patients.reduce(
      (n, p) => n + listVitals(p.id).filter((v) => v.note === 'from band').length,
      0,
    );
    return { user: currentUser(), patients, documents, bandReadings };
  });

  return (
    <Screen title="You are set up." subline="Here is what lives in RUA now. All of it stays on this phone.">
      <Animated.View entering={enterLead}>
        <SectionHeader label="Your setup" top={space.md} />
      </Animated.View>
      <Animated.View entering={enterRow(1)}>
        <ListRow title="Account" detail={data.user ? data.user.name : 'Not created'} />
      </Animated.View>
      <Animated.View entering={enterRow(2)}>
        <ListRow
          title="Care circle"
          detail={
            data.patients.length > 0
              ? data.patients.map((p) => p.fullName).join(', ')
              : 'No one added yet'
          }
        />
      </Animated.View>
      <Animated.View entering={enterRow(3)}>
        <ListRow
          title="Documents"
          detail={data.documents > 0 ? `${data.documents} in the vault` : 'None yet'}
        />
      </Animated.View>
      <Animated.View entering={enterRow(4)}>
        <ListRow
          title="Band readings"
          detail={data.bandReadings > 0 ? `${data.bandReadings} readings` : 'No band connected'}
          last
        />
      </Animated.View>
      <Animated.View entering={enterRow(5)}>
        <View style={{ marginTop: space.xl }} testID="ob-open-rua">
          <PillButton label="Open RUA" onPress={() => router.replace('/' as never)} />
        </View>
      </Animated.View>
    </Screen>
  );
}
