import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Printer, Share2 } from 'lucide-react-native';
import { DisclaimerFootnote, PillButton, Screen, SectionHeader, color, radius, space, type } from '../../../ds';
import { getPatient, latestVitals, listContacts, listMedications } from '../../../db/repo';
import { enterLead, enterQuiet, enterRow } from '../../../ds/motion';
import { useData } from '../../../lib/useData';
import { outputErSheet } from '../../../lib/print';

/**
 * The ER sheet (P15): the one page you grab on the way to the hospital.
 * Critical facts above the fold, printable and shareable, generated fresh
 * from live data every time it opens.
 */
export default function ErSheet() {
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
  const { patient, meds, contacts } = data;
  const severe = patient.allergies.filter((a) => a.severe);
  const highAlertMeds = meds.filter((m) => m.highAlert);
  const emergency = contacts.filter((c) => c.kind === 'emergency');
  const providers = contacts.filter((c) => c.kind === 'provider');
  const weight = data.vitals.find((v) => v.kind === 'weight');
  const age = patient.dob
    ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 86400000))
    : null;

  async function run(action: 'print' | 'share') {
    setBusy(action);
    try {
      await outputErSheet(patient, action);
    } catch (e) {
      Alert.alert('Could not prepare the sheet', String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <Animated.View entering={enterLead}>
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

        <Text style={type.title}>ER sheet</Text>
        <Text style={[type.detail, { marginTop: 4 }]}>
          {patient.fullName}
          {age !== null ? `, ${age}` : ''} · generated fresh from the record, never stale.
        </Text>
      </Animated.View>

      <Animated.View entering={enterRow(1)} style={{ flexDirection: 'row', gap: 10, marginTop: space.lg }}>
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
      </Animated.View>

      {/* Critical band: what a triage nurse needs in the first ten seconds.
          It arrives with the stagger and then holds absolutely still: no loop
          on safety copy, ever. */}
      <Animated.View
        entering={enterRow(2)}
        accessible
        accessibilityLabel="Critical facts"
        style={{
          marginTop: space.xl,
          borderRadius: radius.md,
          backgroundColor: color.ink,
          paddingHorizontal: 16,
          paddingVertical: 14,
          gap: 6,
        }}
      >
        {severe.length > 0 ? (
          <Text style={{ color: color.paper, fontSize: 15, fontWeight: '700' }}>
            {severe.map((a) => `ALLERGY: ${a.name} (${a.reaction})`).join('  ·  ')}
          </Text>
        ) : (
          <Text style={{ color: color.paper, fontSize: 15, fontWeight: '700' }}>No known severe allergies</Text>
        )}
        {highAlertMeds.length > 0 ? (
          <Text style={{ color: color.paper, fontSize: 13.5 }}>
            {highAlertMeds.map((m) => `ON ${m.name.toUpperCase()}${m.strength ? ` ${m.strength}` : ''}`).join('  ·  ')}
          </Text>
        ) : null}
        <Text style={{ color: '#C9C9CE', fontSize: 12.5 }}>
          {[
            patient.dob ? `DOB ${patient.dob}` : null,
            weight ? `${weight.value} lb` : null,
            patient.conditions.slice(0, 3).join(', ') || null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </Animated.View>

      <Animated.View entering={enterRow(3)}>
        <SectionHeader label="Current medications" meta={`${meds.length}`} />
      </Animated.View>
      {meds.map((m, i) => (
        <Animated.View
          key={m.id}
          entering={enterRow(4 + i)}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingVertical: 9,
            borderBottomWidth: i === meds.length - 1 ? 0 : 1,
            borderBottomColor: color.line,
            gap: 10,
          }}
        >
          <Text style={[type.body, { fontWeight: '600', flex: 1 }]}>
            {m.name}
            {m.strength ? ` ${m.strength}` : ''}
            {m.highAlert ? '  · high-alert' : ''}
          </Text>
          <Text style={[type.mini, { maxWidth: '45%' }]} numberOfLines={1}>
            {m.prn ? 'as needed' : (m.sig ?? '')}
          </Text>
        </Animated.View>
      ))}

      <Animated.View entering={enterRow(5)}>
        <SectionHeader label="Conditions" />
        <Text style={type.body}>{patient.conditions.join(' · ') || 'None recorded'}</Text>
      </Animated.View>

      <Animated.View entering={enterRow(6)}>
        <SectionHeader label="Emergency contacts" />
        {emergency.map((c) => (
          <Text key={c.id} style={[type.body, { paddingVertical: 4 }]}>
            <Text style={{ fontWeight: '600' }}>{c.name}</Text>
            {c.relation ? ` · ${c.relation}` : ''}
            {c.phone ? ` · ${c.phone}` : ''}
          </Text>
        ))}
      </Animated.View>

      {providers.length > 0 ? (
        <Animated.View entering={enterRow(7)}>
          <SectionHeader label="Care team" />
          {providers.map((c) => (
            <Text key={c.id} style={[type.body, { paddingVertical: 4 }]}>
              <Text style={{ fontWeight: '600' }}>{c.name}</Text>
              {c.relation ? ` · ${c.relation}` : ''}
              {c.phone ? ` · ${c.phone}` : ''}
            </Text>
          ))}
        </Animated.View>
      ) : null}

      <Animated.View entering={enterQuiet}>
        <DisclaimerFootnote>
          Hearth organizes information the caregiver entered. Verify medications against the bottles. This sheet is
          not medical advice.
        </DisclaimerFootnote>
      </Animated.View>
    </Screen>
  );
}
