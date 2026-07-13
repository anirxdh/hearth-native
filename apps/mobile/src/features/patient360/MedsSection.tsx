import React from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { RunwayStatus } from '@hearth/core';
import { EmptyState, ListRow, PillButton, RunwayBar, SectionHeader, color, space, type } from '../../ds';
import type { MedWithRunway } from '../../db/repo';

function statusToColor(s: RunwayStatus): 'red' | 'amber' | 'green' {
  return s === 'overdue' || s === 'urgent' ? 'red' : s === 'soon' ? 'amber' : 'green';
}

function runwayLabel(days: number): string {
  if (days <= 0) return 'out';
  return `${days} day${days === 1 ? '' : 's'}`;
}

/** The P5 medication list, extracted so it lives as the Meds tab of Patient 360. */
export function MedsSection({ patientId, meds }: { patientId: string; meds: MedWithRunway[] }) {
  const router = useRouter();
  return (
    <View>
      <SectionHeader label="Medications" meta={`${meds.length}`} />
      {meds.length === 0 ? (
        <EmptyState
          title="No medications yet"
          detail="Add each medication with its last fill date and day supply; Hearth computes the refill runway from there."
          action={<PillButton label="Add a medication" onPress={() => router.push(`/patient/${patientId}/med/new` as never)} />}
        />
      ) : (
        <>
          {meds.map((m, i) => (
            <ListRow
              key={m.id}
              title={[m.name, m.strength].filter(Boolean).join(' ') + (m.highAlert ? '  ·  high-alert' : '')}
              {...(m.sig ? { detail: m.sig } : {})}
              onPress={() => router.push(`/patient/${patientId}/med/${m.id}` as never)}
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
                        {
                          fontWeight: '600',
                          color: m.runway.status === 'ok' ? color.ink3 : color[statusToColor(m.runway.status)],
                        },
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
            <PillButton
              label="Add a medication"
              variant="outline"
              size="sm"
              onPress={() => router.push(`/patient/${patientId}/med/new` as never)}
            />
          </View>
        </>
      )}
    </View>
  );
}
