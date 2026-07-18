import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
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
import { enterQuiet, enterRow } from '../../ds/motion';
import { ChartArt, NotebookArt } from '../../components/EmptyArt';

const KIND_OPTIONS: { key: Vital['kind']; label: string; unit: string }[] = [
  { key: 'weight', label: 'Weight', unit: 'lb' },
  { key: 'bp', label: 'BP', unit: 'mmHg' },
  { key: 'glucose', label: 'Glucose', unit: 'mg/dL' },
  { key: 'hr', label: 'Heart rate', unit: 'bpm' },
  { key: 'steps', label: 'Steps', unit: 'steps' },
  { key: 'sleep', label: 'Sleep', unit: 'min' },
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
  const [kind, setKind] = useState<Vital['kind']>('weight');
  const [range, setRange] = useState<ChartRange>('30d');

  const activeKind = KIND_OPTIONS.find((k) => k.key === kind)!;
  const bucketed = useMemo(() => {
    const pts: SeriesPoint[] = vitals
      .filter((v) => v.kind === kind)
      .map((v) => ({ on: v.recordedOn as LocalDate, value: v.value }));
    return bucketSeries(pts, range, today);
  }, [vitals, kind, range, today]);
  // BP stores systolic in value and diastolic in value2; every other kind
  // plots a single series and this stays empty.
  const bucketedDiastolic = useMemo(() => {
    if (kind !== 'bp') return [];
    const pts: SeriesPoint[] = vitals
      .filter((v) => v.kind === 'bp' && v.value2 != null)
      .map((v) => ({ on: v.recordedOn as LocalDate, value: v.value2! }));
    return bucketSeries(pts, range, today);
  }, [vitals, kind, range, today]);
  const summary = summarizeSeries(bucketed);

  const hasAny = vitals.length > 0;

  return (
    <View>
      {!hasAny ? (
        <Animated.View entering={enterRow(0)} style={{ marginTop: space.lg }}>
          <EmptyState
            art={<ChartArt size={72} />}
            title="No activity yet"
            detail="Readings you add appear here as trends: weight, blood pressure, glucose, heart rate."
            action={<PillButton label="Add a reading" onPress={() => router.push(`/patient/${patientId}/vital/new` as never)} />}
          />
        </Animated.View>
      ) : (
        <>
          <Animated.View entering={enterRow(0)} style={{ marginTop: space.lg }}>
            <Seg options={KIND_OPTIONS.map(({ key, label }) => ({ key, label }))} value={kind} onChange={setKind} scroll />
          </Animated.View>
          <Animated.View
            entering={enterRow(1)}
            style={{ marginTop: space.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Seg options={RANGES} value={range} onChange={setRange} />
            {summary ? (
              <Text style={type.mini}>
                {summary.direction === 'flat'
                  ? 'steady'
                  : `${summary.direction === 'up' ? 'up' : 'down'} ${Math.abs(summary.delta)} ${activeKind.unit}`}
              </Text>
            ) : null}
          </Animated.View>
          <Animated.View entering={enterRow(2)} style={{ marginTop: space.lg }}>
            <HearthChart
              data={bucketed}
              unit={activeKind.unit}
              {...(bucketedDiastolic.length > 0
                ? { data2: bucketedDiastolic, seriesLabel: 'systolic', series2Label: 'diastolic' }
                : {})}
            />
          </Animated.View>
          <Animated.View entering={enterQuiet}>
            {kind === 'bp' ? (
              <Text style={[type.mini, { marginTop: 6 }]}>
                {bucketedDiastolic.length > 0
                  ? "Each point is the day's reading."
                  : "Showing systolic (top number). Each point is the day's reading."}
              </Text>
            ) : null}
          </Animated.View>
        </>
      )}

      <Animated.View entering={enterRow(3)}>
        <SectionHeader label="Observations" meta={observations.length ? `${observations.length}` : 'the soft signals'} />
      </Animated.View>
      {observations.length === 0 ? (
        <Animated.View entering={enterRow(4)}>
          <EmptyState
            art={<NotebookArt size={72} />}
            title="Nothing logged yet"
            detail="Short notes about mood, appetite, sleep, and incidents. These become the questions for the next visit."
            action={
              <PillButton label="Log an observation" onPress={() => router.push(`/patient/${patientId}/observation/new` as never)} />
            }
          />
        </Animated.View>
      ) : (
        <>
          {observations.slice(0, 20).map((o, i) => (
            <Animated.View
              key={o.id}
              entering={enterRow(4 + i)}
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
            </Animated.View>
          ))}
          <Animated.View entering={enterRow(5)} style={{ marginTop: space.lg, flexDirection: 'row' }}>
            <PillButton
              label="Log an observation"
              variant="outline"
              size="sm"
              icon={<Plus size={14} color={color.ink} strokeWidth={2} />}
              onPress={() => router.push(`/patient/${patientId}/observation/new` as never)}
            />
          </Animated.View>
        </>
      )}
    </View>
  );
}
