import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { ListRow, PillButton, Screen, SectionHeader, space } from '../../ds';
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
    <Screen title="You are set up." subline="Here is what lives in Hearth now. All of it stays on this phone.">
      <SectionHeader label="Your setup" top={space.md} />
      <ListRow title="Account" detail={data.user ? data.user.name : 'Not created'} />
      <ListRow
        title="Care circle"
        detail={
          data.patients.length > 0
            ? data.patients.map((p) => p.fullName).join(', ')
            : 'No one added yet'
        }
      />
      <ListRow
        title="Documents"
        detail={data.documents > 0 ? `${data.documents} in the vault` : 'None yet'}
      />
      <ListRow
        title="Band readings"
        detail={data.bandReadings > 0 ? `${data.bandReadings} readings` : 'No band connected'}
        last
      />
      <View style={{ marginTop: space.xl }} testID="ob-open-hearth">
        <PillButton label="Open Hearth" onPress={() => router.replace('/' as never)} />
      </View>
    </Screen>
  );
}
