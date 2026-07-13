import React from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Pencil, Phone, TriangleAlert } from 'lucide-react-native';
import {
  Avatar,
  Card,
  DisclaimerFootnote,
  EmptyState,
  Hairline,
  ListRow,
  PillButton,
  RunwayBar,
  Screen,
  SectionHeader,
  StatusTag,
  color,
  radius,
  space,
  type,
} from '../../../ds';
import { getPatient, listContacts, listMedications } from '../../../db/repo';
import { useData } from '../../../lib/useData';
import { RUNWAY_DISCLAIMER } from '../../../lib/copy';
import type { RunwayStatus } from '@hearth/core';

function statusToColor(s: RunwayStatus): 'red' | 'amber' | 'green' {
  return s === 'overdue' || s === 'urgent' ? 'red' : s === 'soon' ? 'amber' : 'green';
}

function runwayLabel(days: number): string {
  if (days <= 0) return 'out';
  return `${days} day${days === 1 ? '' : 's'}`;
}

export default function PatientRecord() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const data = useData(() => {
    const patient = getPatient(id);
    return patient
      ? { patient, meds: listMedications(id), contacts: listContacts(id) }
      : null;
  });

  if (!data) {
    return (
      <Screen title="Not found">
        <PillButton label="Back" variant="outline" onPress={() => router.back()} />
      </Screen>
    );
  }
  const { patient, meds, contacts } = data;
  const severeAllergies = patient.allergies.filter((a) => a.severe);
  const displayName = patient.preferredName ?? patient.fullName;
  const age = patient.dob
    ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 86400000))
    : null;

  return (
    <Screen>
      <Pressable onPress={() => router.back()} hitSlop={10} style={{ marginBottom: space.md, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
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
        <Pressable onPress={() => router.push(`/patient/${id}/edit` as never)} hitSlop={10} accessibilityLabel={`Edit ${displayName}`}>
          <Pencil size={19} color={color.ink2} strokeWidth={1.8} />
        </Pressable>
      </View>

      {patient.allergies.length > 0 ? (
        <View
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
            {'ALLERGY: ' + patient.allergies.map((a) => a.name + (a.reaction ? ` (${a.reaction})` : '')).join(' · ')}
          </Text>
        </View>
      ) : null}

      {patient.conditions.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: space.lg }}>
          {patient.conditions.map((c) => (
            <View
              key={c}
              style={{
                borderWidth: 1,
                borderColor: color.line,
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 5,
              }}
            >
              <Text style={type.mini}>{c}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <SectionHeader label="Medications" meta={`${meds.length}`} />
      {meds.length === 0 ? (
        <EmptyState
          title="No medications yet"
          detail="Add each medication with its last fill date and day supply; Hearth computes the refill runway from there."
          action={<PillButton label="Add a medication" onPress={() => router.push(`/patient/${id}/med/new` as never)} />}
        />
      ) : (
        <>
          {meds.map((m, i) => (
            <ListRow
              key={m.id}
              title={[m.name, m.strength].filter(Boolean).join(' ') + (m.highAlert ? '  ·  high-alert' : '')}
              {...(m.sig ? { detail: m.sig } : {})}
              onPress={() => router.push(`/patient/${id}/med/${m.id}` as never)}
              last={i === meds.length - 1}
              right={
                m.prn ? (
                  <Text style={type.mini}>as needed</Text>
                ) : m.runway ? (
                  <View style={{ alignItems: 'flex-end', gap: 5 }}>
                    <RunwayBar fraction={m.runway.fraction} status={statusToColor(m.runway.status)} />
                    <Text
                      style={[
                        type.mini,
                        { fontWeight: '600', color: m.runway.status === 'ok' ? color.ink3 : color[statusToColor(m.runway.status)] },
                      ]}
                    >
                      {runwayLabel(m.runway.daysRemaining)}
                    </Text>
                  </View>
                ) : (
                  <Text style={[type.mini, { color: color.amber, fontWeight: '600' }]}>add fill</Text>
                )
              }
            />
          ))}
          <View style={{ marginTop: space.lg }}>
            <PillButton label="Add a medication" variant="outline" size="sm" onPress={() => router.push(`/patient/${id}/med/new` as never)} />
          </View>
        </>
      )}

      <SectionHeader label="Contacts" meta={contacts.length ? undefined : 'none yet'} />
      {contacts.map((c, i) => (
        <ListRow
          key={c.id}
          title={c.name}
          {...(c.relation ? { detail: c.relation } : {})}
          last={i === contacts.length - 1}
          right={
            c.phone ? (
              <Pressable
                onPress={() => Linking.openURL(`tel:${c.phone!.replace(/[^\d+]/g, '')}`)}
                hitSlop={8}
                accessibilityLabel={`Call ${c.name}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <Phone size={14} color={color.ink2} strokeWidth={1.8} />
                <Text style={[type.mini, { fontWeight: '600', color: color.ink }]}>{c.phone}</Text>
              </Pressable>
            ) : undefined
          }
        />
      ))}
      <View style={{ marginTop: contacts.length ? space.lg : 0 }}>
        <PillButton label="Add a contact" variant="outline" size="sm" onPress={() => router.push(`/patient/${id}/contact/new` as never)} />
      </View>

      <DisclaimerFootnote>{RUNWAY_DISCLAIMER}</DisclaimerFootnote>
    </Screen>
  );
}
