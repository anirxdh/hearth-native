import React from 'react';
import { Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import type { LabResult } from '@rua/schema';
import { EmptyState, PillButton, SectionHeader, color, radius, space, type } from '../../ds';
import { enterRow } from '../../ds/motion';

function fmtDate(on: string): string {
  const d = new Date(`${on}T12:00:00Z`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function refRange(l: LabResult): string | null {
  if (l.refLow && l.refHigh) return `ref ${l.refLow} to ${l.refHigh}`;
  if (l.refHigh) return `ref under ${l.refHigh}`;
  if (l.refLow) return `ref over ${l.refLow}`;
  return null;
}

export function RecordsTab({ patientId, labs }: { patientId: string; labs: LabResult[] }) {
  const router = useRouter();

  // Group by collection date, newest first (repo already orders desc).
  const groups: { on: string; source: string | null; rows: LabResult[] }[] = [];
  for (const lab of labs) {
    const last = groups[groups.length - 1];
    if (last && last.on === lab.collectedOn) last.rows.push(lab);
    else groups.push({ on: lab.collectedOn, source: lab.source, rows: [lab] });
  }

  return (
    <View>
      {labs.length === 0 ? (
        <Animated.View entering={enterRow(0)} style={{ marginTop: space.lg }}>
          <EmptyState
            title="No lab results yet"
            detail="Type in the handful of numbers that matter from each lab report. Out-of-range values are flagged."
            action={<PillButton label="Add a result" onPress={() => router.push(`/patient/${patientId}/lab/new` as never)} />}
          />
        </Animated.View>
      ) : (
        groups.map((g, gi) => (
          <Animated.View key={g.on} entering={enterRow(gi)}>
            <SectionHeader label={fmtDate(g.on)} {...(g.source ? { meta: g.source } : {})} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {g.rows.map((l) => (
                <View
                  key={l.id}
                  accessible
                  accessibilityLabel={`${l.name}: ${l.value}${l.unit ? ` ${l.unit}` : ''}${l.abnormal ? ', out of range' : ''}`}
                  style={{
                    flexBasis: '47%',
                    flexGrow: 1,
                    borderWidth: 1,
                    borderColor: l.abnormal ? color.red : color.line,
                    borderRadius: radius.md,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                  }}
                >
                  <Text style={type.label}>{l.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 6 }}>
                    <Text
                      style={{
                        fontSize: 24,
                        fontWeight: '600',
                        letterSpacing: -0.4,
                        color: l.abnormal ? color.red : color.ink,
                      }}
                    >
                      {l.value}
                    </Text>
                    {l.unit ? <Text style={type.mini}>{l.unit}</Text> : null}
                  </View>
                  <Text style={[type.mini, { marginTop: 3 }]}>
                    {[refRange(l), l.abnormal ? 'out of range' : null].filter(Boolean).join(' · ') || ' '}
                  </Text>
                  {l.note ? <Text style={[type.mini, { marginTop: 4, color: color.ink2 }]}>{l.note}</Text> : null}
                </View>
              ))}
            </View>
          </Animated.View>
        ))
      )}

      <Animated.View entering={enterRow(groups.length)} style={{ marginTop: space.lg, flexDirection: 'row' }}>
        <PillButton
          label="Add a result"
          variant="outline"
          size="sm"
          icon={<Plus size={14} color={color.ink} strokeWidth={2} />}
          onPress={() => router.push(`/patient/${patientId}/lab/new` as never)}
        />
      </Animated.View>
    </View>
  );
}
