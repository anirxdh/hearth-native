import React, { useMemo, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import {
  bucketSeries,
  summarizeSeries,
  type ChartRange,
  type LocalDate,
  type SeriesPoint,
} from '@hearth/core';
import type { Observation, Vital } from '@hearth/schema';
import {
  EmptyState,
  HearthChart,
  PillButton,
  SectionHeader,
  Seg,
  color,
  space,
  type,
} from '../../ds';

const KIND_OPTIONS: { key: Vital['kind']; label: string; unit: string }[] = [
  { key: 'weight', label: 'Weight', unit: 'lb' },
  { key: 'bp', label: 'BP', unit: 'mmHg' },
  { key: 'glucose', label: 'Glucose', unit: 'mg/dL' },
  { key: 'hr', label: 'Heart rate', unit: 'bpm' },
];

const RANGES: { key: ChartRange; label: string }[] = [
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: '1y', label: '1y' },
];

const OBS_LABEL: Record<Observation['kind'], string> = {
  mood: 'Mood',
  appetite: 'Appetite',
  sleep: 'Sleep',
  incident: 'Incident',
  note: 'Note',
};

function fmtObsDay(at: string): string {
  const d = new Date(at);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function ActivityTab({
  patientId,
  vitals,
  observations,
  today,
}: {
  patientId: string;
  vitals: Vital[];
  observations: Observation[];
  today: LocalDate;
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [kind, setKind] = useState<Vital['kind']>('weight');
  const [range, setRange] = useState<ChartRange>('30d');

  const activeKind = KIND_OPTIONS.find((k) => k.key === kind)!;
  const bucketed = useMemo(() => {
    const pts: SeriesPoint[] = vitals
      .filter((v) => v.kind === kind)
      .map((v) => ({ on: v.recordedOn as LocalDate, value: v.value }));
    return bucketSeries(pts, range, today);
  }, [vitals, kind, range, today]);
  const summary = summarizeSeries(bucketed);

  const hasAny = vitals.length > 0;

  return (
    <View>
      {!hasAny ? (
        <View style={{ marginTop: space.lg }}>
          <EmptyState
            title="No activity yet"
            detail="Readings you add appear here as trends: weight, blood pressure, glucose, heart rate."
            action={<PillButton label="Add a reading" onPress={() => router.push(`/patient/${patientId}/vital/new` as never)} />}
          />
        </View>
      ) : (
        <>
          <View style={{ marginTop: space.lg }}>
            <Seg options={KIND_OPTIONS.map(({ key, label }) => ({ key, label }))} value={kind} onChange={setKind} />
          </View>
          <View style={{ marginTop: space.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Seg options={RANGES} value={range} onChange={setRange} />
            {summary ? (
              <Text style={type.mini}>
                {summary.direction === 'flat'
                  ? 'steady'
                  : `${summary.direction === 'up' ? 'up' : 'down'} ${Math.abs(summary.delta)} ${activeKind.unit}`}
              </Text>
            ) : null}
          </View>
          <View style={{ marginTop: space.lg }}>
            <HearthChart data={bucketed} width={width - space.xl * 2} unit={activeKind.unit} />
          </View>
          {kind === 'bp' ? (
            <Text style={[type.mini, { marginTop: 6 }]}>Showing systolic (top number). Each point is the day's reading.</Text>
          ) : null}
        </>
      )}

      <SectionHeader label="Observations" meta={observations.length ? `${observations.length}` : 'the soft signals'} />
      {observations.length === 0 ? (
        <EmptyState
          title="Nothing logged yet"
          detail="Short notes about mood, appetite, sleep, and incidents. These become the questions for the next visit."
          action={
            <PillButton label="Log an observation" onPress={() => router.push(`/patient/${patientId}/observation/new` as never)} />
          }
        />
      ) : (
        <>
          {observations.slice(0, 20).map((o, i) => (
            <View
              key={o.id}
              style={{
                paddingVertical: 12,
                borderBottomWidth: i === Math.min(observations.length, 20) - 1 ? 0 : 1,
                borderBottomColor: color.line,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[type.mini, { fontWeight: '700', letterSpacing: 0.4 }]}>
                  {OBS_LABEL[o.kind].toUpperCase()}
                </Text>
                <Text style={type.mini}>{fmtObsDay(o.at)}</Text>
              </View>
              <Text style={[type.body, { marginTop: 4 }]}>{o.text}</Text>
            </View>
          ))}
          <View style={{ marginTop: space.lg, flexDirection: 'row' }}>
            <PillButton
              label="Log an observation"
              variant="outline"
              size="sm"
              icon={<Plus size={14} color={color.ink} strokeWidth={2} />}
              onPress={() => router.push(`/patient/${patientId}/observation/new` as never)}
            />
          </View>
        </>
      )}
    </View>
  );
}
