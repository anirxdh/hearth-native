import React from 'react';
import { Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import type { RunwayStatus } from '@rua/core';
import { EmptyState, ListRow, PillButton, RunwayBar, SectionHeader, color, space, type } from '../../ds';
import { enterRow } from '../../ds/motion';
import type { MedWithRunway } from '../../db/repo';
import { BottleArt } from '../../components/EmptyArt';

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
      <Animated.View entering={enterRow(0)}>
        <SectionHeader label="Medications" meta={`${meds.length}`} />
      </Animated.View>
      {meds.length === 0 ? (
        <Animated.View entering={enterRow(1)}>
          <EmptyState
            art={<BottleArt size={72} />}
            title="No medications yet"
            detail="Add each medication with its last fill date and day supply; RUA computes the refill runway from there."
            action={<PillButton label="Add a medication" onPress={() => router.push(`/patient/${patientId}/med/new` as never)} />}
          />
        </Animated.View>
      ) : (
        <>
          {meds.map((m, i) => (
            <Animated.View key={m.id} entering={enterRow(1 + i)}>
            <ListRow
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
            </Animated.View>
          ))}
          <Animated.View entering={enterRow(Math.min(meds.length, 8) + 1)} style={{ marginTop: space.lg }}>
            <PillButton
              label="Add a medication"
              variant="outline"
              size="sm"
              onPress={() => router.push(`/patient/${patientId}/med/new` as never)}
            />
          </Animated.View>
        </>
      )}
    </View>
  );
}
