import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { EmptyState, Screen, SectionHeader, color, space, type } from '../ds';
import { enterLead, enterRow } from '../ds/motion';
import { getPatient, listAccessLog } from '../db/repo';
import { describeAccess } from '../lib/accessLabels';
import { useData } from '../lib/useData';

/**
 * P19: the access log, surfaced. Every print, share, export, and other
 * sensitive read lands here, newest first. When sharing arrives (P31),
 * a second caregiver's reads appear in this same list.
 */

function fmtAt(at: string): string {
  return new Date(at).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function AccessLogScreen() {
  const router = useRouter();
  const entries = useData(() => listAccessLog(200));

  return (
    <Screen>
      <Pressable
        onPress={() => router.back()}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Back to settings"
        style={{ marginBottom: space.md, flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 }}
      >
        <ChevronLeft size={18} color={color.ink2} strokeWidth={1.8} />
        <Text style={type.mini}>Settings</Text>
      </Pressable>

      <Animated.View entering={enterLead}>
        <Text style={type.title}>Access log</Text>
        <Text style={[type.detail, { marginTop: 4 }]}>
          Every time care information leaves the app: printed, shared, or exported. The log is append-only; nothing
          can be edited or removed.
        </Text>
      </Animated.View>

      <Animated.View entering={enterRow(1)}>
        <SectionHeader label="Recent" meta={entries.length ? `${entries.length}` : undefined} />
      </Animated.View>
      {entries.length === 0 ? (
        <Animated.View entering={enterRow(2)}>
          <EmptyState
            title="Nothing yet"
            detail="Print an ER sheet or share a one-pager and the event appears here with its time."
          />
        </Animated.View>
      ) : (
        entries.map((e, i) => {
          const patient = e.patientId ? getPatient(e.patientId) : undefined;
          const row = (
            <View
              style={{
                paddingVertical: 11,
                borderBottomWidth: i === entries.length - 1 ? 0 : 1,
                borderBottomColor: color.line,
                flexDirection: 'row',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[type.body, { fontWeight: '600' }]}>{describeAccess(e.what)}</Text>
                <Text style={[type.mini, { marginTop: 2 }]}>
                  {[patient ? (patient.preferredName ?? patient.fullName) : null, `by ${e.actor}`]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <Text style={type.mini}>{fmtAt(e.at)}</Text>
            </View>
          );
          /* The first eight rows stagger in; deeper history renders at rest. */
          return i < 8 ? (
            <Animated.View key={e.id} entering={enterRow(2 + i)}>
              {row}
            </Animated.View>
          ) : (
            <View key={e.id}>{row}</View>
          );
        })
      )}
    </Screen>
  );
}
