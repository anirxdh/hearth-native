import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Printer, Share2 } from 'lucide-react-native';
import { dailyNeeds } from '@hearth/core';
import {
  DisclaimerFootnote,
  PillButton,
  Screen,
  SectionHeader,
  StatCard,
  color,
  space,
  type,
} from '../../../ds';
import { getPatient, latestVitals, listContacts, listMedications } from '../../../db/repo';
import { useData } from '../../../lib/useData';
import { outputOnePager } from '../../../lib/print';

const VITAL_LABEL: Record<string, string> = {
  bp: 'Blood pressure',
  weight: 'Weight',
  glucose: 'Fasting glucose',
  spo2: 'Oxygen',
  temp: 'Temperature',
  hr: 'Resting heart rate',
};

/**
 * The one-pager (P15): a single printable page that summarizes a person,
 * plus their personalized daily-needs table. General guidance only; the
 * framing is deliberate and repeated on the page itself.
 */
export default function OnePager() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [busy, setBusy] = useState<'print' | 'share' | null>(null);

  const data = useData(() => {
    const patient = getPatient(id);
    if (!patient) return null;
    return {
      patient,
      meds: listMedications(id),
      contacts: listContacts(id),
      vitals: latestVitals(id),
    };
  });

  if (!data) {
    return (
      <Screen title="Not found">
        <PillButton label="Back" variant="outline" onPress={() => router.back()} />
      </Screen>
    );
  }
  const { patient, meds, contacts, vitals } = data;
  const age = patient.dob
    ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 86400000))
    : null;
  const weight = vitals.find((v) => v.kind === 'weight');
  // Explicit profile field wins; pronoun inference remains the fallback for
  // records created before the sex field existed.
  const sex = patient.sex ?? (patient.pronouns?.toLowerCase().startsWith('he') ? 'male' : 'female');
  const nutrition =
    age !== null ? dailyNeeds({ ageYears: age, sex, ...(weight ? { weightLb: weight.value } : {}) }) : [];

  async function run(action: 'print' | 'share') {
    setBusy(action);
    try {
      await outputOnePager(patient, action);
    } catch (e) {
      Alert.alert('Could not prepare the one-pager', String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <Pressable
        onPress={() => router.back()}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={{ marginBottom: space.md, flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 }}
      >
        <ChevronLeft size={18} color={color.ink2} strokeWidth={1.8} />
        <Text style={type.mini}>Back</Text>
      </Pressable>

      <Text style={type.title}>One-pager</Text>
      <Text style={[type.detail, { marginTop: 4 }]}>
        Everything about {patient.preferredName ?? patient.fullName} on a single page: conditions, medications,
        latest readings, contacts, and daily needs.
      </Text>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: space.lg }}>
        <PillButton
          label="Print"
          icon={<Printer size={14} color={color.paper} strokeWidth={2} />}
          onPress={() => void run('print')}
          loading={busy === 'print'}
        />
        <PillButton
          label="Share PDF"
          variant="outline"
          icon={<Share2 size={14} color={color.ink} strokeWidth={2} />}
          onPress={() => void run('share')}
          loading={busy === 'share'}
        />
      </View>

      <SectionHeader label="Who" />
      <Text style={type.body}>
        <Text style={{ fontWeight: '600' }}>{patient.fullName}</Text>
        {age !== null ? `, ${age}` : ''}
        {patient.relationship ? ` · ${patient.relationship}` : ''}
      </Text>
      {patient.conditions.length > 0 ? (
        <Text style={[type.detail, { marginTop: 4 }]}>{patient.conditions.join(' · ')}</Text>
      ) : null}
      {patient.allergies.length > 0 ? (
        <Text style={[type.detail, { marginTop: 4, color: color.red, fontWeight: '600' }]}>
          Allergies: {patient.allergies.map((a) => a.name).join(', ')}
        </Text>
      ) : null}

      <SectionHeader label="Medications" meta={`${meds.length}`} />
      {meds.map((m, i) => (
        <View
          key={m.id}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingVertical: 8,
            borderBottomWidth: i === meds.length - 1 ? 0 : 1,
            borderBottomColor: color.line,
            gap: 10,
          }}
        >
          <Text style={[type.body, { fontWeight: '600', flex: 1 }]}>
            {m.name}
            {m.strength ? ` ${m.strength}` : ''}
          </Text>
          <Text style={[type.mini, { maxWidth: '48%' }]} numberOfLines={1}>
            {m.prn ? 'as needed' : (m.sig ?? '')}
          </Text>
        </View>
      ))}

      {vitals.length > 0 ? (
        <>
          <SectionHeader label="Latest readings" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {vitals.map((v) => (
              <StatCard
                key={v.id}
                label={VITAL_LABEL[v.kind] ?? v.kind}
                value={v.kind === 'bp' && v.value2 != null ? `${v.value}/${v.value2}` : String(v.value)}
                unit={v.unit}
                meta={v.recordedOn}
              />
            ))}
          </View>
        </>
      ) : null}

      {nutrition.length > 0 ? (
        <>
          <SectionHeader label="Daily needs" meta="general guidance" />
          {nutrition.map((row, i) => (
            <View
              key={row.nutrient}
              style={{
                flexDirection: 'row',
                paddingVertical: 9,
                borderBottomWidth: i === nutrition.length - 1 ? 0 : 1,
                borderBottomColor: color.line,
                gap: 12,
              }}
            >
              <Text style={[type.body, { fontWeight: '600', width: 110 }]}>{row.nutrient}</Text>
              <View style={{ flex: 1 }}>
                <Text style={type.body}>{row.target}</Text>
                <Text style={[type.mini, { marginTop: 2 }]}>{row.why}</Text>
              </View>
            </View>
          ))}
          <Text style={[type.mini, { marginTop: space.md }]}>
            Based on published dietary reference values for {sex === 'male' ? 'men' : 'women'}
            {age !== null ? ` around ${age}` : ''}
            {weight ? `, ${weight.value} lb` : ''}.{' '}
            {patient.sex
              ? 'Sex comes from their profile.'
              : 'No sex on their profile yet, so this is a best guess; set it in Edit to be sure.'}{' '}
            General guidance, not a prescription; their clinician's advice wins.
          </Text>
        </>
      ) : null}

      <SectionHeader label="Contacts" />
      {contacts.map((c) => (
        <Text key={c.id} style={[type.body, { paddingVertical: 4 }]}>
          <Text style={{ fontWeight: '600' }}>{c.name}</Text>
          {c.relation ? ` · ${c.relation}` : ''}
          {c.phone ? ` · ${c.phone}` : ''}
        </Text>
      ))}

      <DisclaimerFootnote>
        Hearth organizes information the caregiver entered. This page is not medical advice and never includes
        dosing decisions.
      </DisclaimerFootnote>
    </Screen>
  );
}
