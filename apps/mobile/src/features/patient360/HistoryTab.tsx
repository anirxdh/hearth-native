import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import type { TimelineEvent } from '@hearth/schema';
import { EmptyState, PillButton, SectionHeader, Seg, color, space, type } from '../../ds';

type Filter = 'all' | TimelineEvent['kind'];

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'diagnosis', label: 'Diagnoses' },
  { key: 'hospitalization', label: 'Hospital' },
  { key: 'procedure', label: 'Procedures' },
  { key: 'med_change', label: 'Med changes' },
];

const KIND_LABEL: Record<TimelineEvent['kind'], string> = {
  diagnosis: 'Diagnosis',
  hospitalization: 'Hospitalization',
  procedure: 'Procedure',
  med_change: 'Medication',
  other: 'Event',
};

/** "2022" stays a year; "2026-05-03" renders as May 3, 2026. */
function fmtHappened(on: string): string {
  if (/^\d{4}$/.test(on)) return on;
  const d = new Date(`${on}T12:00:00Z`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function yearOf(on: string): string {
  return on.slice(0, 4);
}

export function HistoryTab({
  patientId,
  events,
}: {
  patientId: string;
  events: TimelineEvent[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(
    () => (filter === 'all' ? events : events.filter((e) => e.kind === filter)),
    [events, filter],
  );

  let lastYear = '';

  return (
    <View>
      <View style={{ marginTop: space.lg }}>
        <Seg options={FILTERS} value={filter} onChange={setFilter} scroll />
      </View>

      {filtered.length === 0 ? (
        <View style={{ marginTop: space.lg }}>
          <EmptyState
            title={filter === 'all' ? 'No history yet' : 'Nothing in this category'}
            detail="Diagnoses, hospital stays, and procedures build the story a new clinician needs. Medication changes appear here automatically."
            action={
              filter === 'all' ? (
                <PillButton label="Add an event" onPress={() => router.push(`/patient/${patientId}/event/new` as never)} />
              ) : undefined
            }
          />
        </View>
      ) : (
        <View style={{ marginTop: space.sm }}>
          {filtered.map((e) => {
            const yr = yearOf(e.happenedOn);
            const showYear = yr !== lastYear;
            lastYear = yr;
            return (
              <View key={e.id}>
                {showYear ? <SectionHeader label={yr} /> : null}
                <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 10 }}>
                  <View style={{ width: 8, alignItems: 'center' }}>
                    <View
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 4,
                        marginTop: 6,
                        backgroundColor: e.kind === 'hospitalization' ? color.red : e.kind === 'med_change' ? color.ink3 : color.ink,
                      }}
                    />
                    <View style={{ flex: 1, width: 1, backgroundColor: color.line, marginTop: 4 }} />
                  </View>
                  <View style={{ flex: 1, paddingBottom: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                      <Text style={[type.body, { fontWeight: '600', flex: 1 }]}>{e.title}</Text>
                      <Text style={type.mini}>{fmtHappened(e.happenedOn)}</Text>
                    </View>
                    <Text style={[type.mini, { marginTop: 2 }]}>
                      {KIND_LABEL[e.kind]}
                      {e.detail ? ` · ${e.detail}` : ''}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View style={{ marginTop: space.lg, flexDirection: 'row' }}>
        <PillButton
          label="Add an event"
          variant="outline"
          size="sm"
          icon={<Plus size={14} color={color.ink} strokeWidth={2} />}
          onPress={() => router.push(`/patient/${patientId}/event/new` as never)}
        />
      </View>
    </View>
  );
}
