import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Pencil, TriangleAlert } from 'lucide-react-native';
import {
  Avatar,
  DisclaimerFootnote,
  PillButton,
  Screen,
  Seg,
  color,
  radius,
  space,
  type,
} from '../../../ds';
import {
  getPatient,
  latestVitals,
  listContacts,
  listDocuments,
  listLabs,
  listMedications,
  listObservations,
  listTimeline,
  listVitals,
} from '../../../db/repo';
import { enterLead, enterQuiet, enterRow } from '../../../ds/motion';
import { useData } from '../../../lib/useData';
import { RUNWAY_DISCLAIMER } from '../../../lib/copy';
import { today } from '../../../lib/clock';
import { OverviewTab } from '../../../features/patient360/OverviewTab';
import { ActivityTab } from '../../../features/patient360/ActivityTab';
import { HistoryTab } from '../../../features/patient360/HistoryTab';
import { RecordsTab } from '../../../features/patient360/RecordsTab';
import { DocumentsTab } from '../../../features/patient360/DocumentsTab';
import { MedsSection } from '../../../features/patient360/MedsSection';

type Tab = 'overview' | 'meds' | 'activity' | 'history' | 'records' | 'documents';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'meds', label: 'Meds' },
  { key: 'activity', label: 'Activity' },
  { key: 'history', label: 'History' },
  { key: 'records', label: 'Records' },
  { key: 'documents', label: 'Documents' },
];

export default function Patient360() {
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(
    TABS.some((t) => t.key === tabParam) ? (tabParam as Tab) : 'overview',
  );

  const data = useData(() => {
    const patient = getPatient(id);
    if (!patient) return null;
    return {
      patient,
      meds: listMedications(id),
      contacts: listContacts(id),
      latest: latestVitals(id),
      vitals: listVitals(id),
      observations: listObservations(id),
      events: listTimeline(id),
      labs: listLabs(id),
      documents: listDocuments(id),
    };
  });

  if (!data) {
    return (
      <Screen title="Not found">
        <PillButton label="Back" variant="outline" onPress={() => router.back()} />
      </Screen>
    );
  }
  const { patient } = data;
  const severeAllergies = patient.allergies.filter((a) => a.severe);
  const displayName = patient.preferredName ?? patient.fullName;
  const age = patient.dob
    ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 86400000))
    : null;

  return (
    <Screen>
      <Animated.View entering={enterLead}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back to home"
          style={{ marginBottom: space.md, flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 }}
        >
          <ChevronLeft size={18} color={color.ink2} strokeWidth={1.8} />
          <Text style={type.mini}>Home</Text>
        </Pressable>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          <Avatar name={patient.fullName} size={52} />
          <View style={{ flex: 1 }}>
            <Text style={type.title}>{patient.fullName}</Text>
            <Text style={[type.mini, { marginTop: 3 }]}>
              {[patient.relationship, age !== null ? `${age}` : null, patient.pronouns]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push(`/patient/${id}/edit` as never)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${displayName}`}
            style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Pencil size={19} color={color.ink2} strokeWidth={1.8} />
          </Pressable>
        </View>
      </Animated.View>

      {/* The allergy banner stays visible on every tab. That is the point. */}
      <Animated.View entering={enterRow(1)}>
        {patient.allergies.length > 0 ? (
          <View
            accessible
            accessibilityLabel={`Allergies: ${patient.allergies.map((a) => a.name).join(', ')}`}
            style={{
              marginTop: space.lg,
              borderWidth: 1,
              borderColor: severeAllergies.length ? color.red : color.line,
              borderRadius: radius.md,
              paddingHorizontal: 14,
              paddingVertical: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <TriangleAlert size={15} color={severeAllergies.length ? color.red : color.ink2} strokeWidth={2} />
            <Text
              style={[
                type.mini,
                { flex: 1, fontWeight: '600', color: severeAllergies.length ? color.red : color.ink2 },
              ]}
              numberOfLines={2}
            >
              {'ALLERGY: ' +
                patient.allergies.map((a) => a.name + (a.reaction ? ` (${a.reaction})` : '')).join(' · ')}
            </Text>
          </View>
        ) : null}
      </Animated.View>

      <Animated.View entering={enterRow(2)} style={{ marginTop: space.lg }}>
        <Seg options={TABS} value={tab} onChange={setTab} scroll />
      </Animated.View>

      {/* Keyed by tab so every switch replays a gentle arrival, not just first mount. */}
      <Animated.View key={tab} entering={enterLead}>
        {tab === 'overview' ? (
          <OverviewTab
            patient={patient}
            meds={data.meds}
            vitals={data.latest}
            contacts={data.contacts}
            today={today()}
          />
        ) : tab === 'meds' ? (
          <MedsSection patientId={id} meds={data.meds} />
        ) : tab === 'activity' ? (
          <ActivityTab patientId={id} vitals={data.vitals} observations={data.observations} today={today()} />
        ) : tab === 'history' ? (
          <HistoryTab patientId={id} events={data.events} />
        ) : tab === 'records' ? (
          <RecordsTab patientId={id} labs={data.labs} />
        ) : (
          <DocumentsTab patientId={id} documents={data.documents} />
        )}
      </Animated.View>

      <Animated.View entering={enterQuiet}>
        <DisclaimerFootnote>{RUNWAY_DISCLAIMER}</DisclaimerFootnote>
      </Animated.View>
    </Screen>
  );
}
