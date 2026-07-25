import React from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { FileText, Phone, Plus, ShieldAlert } from 'lucide-react-native';
import type { Contact, Patient, Vital } from '@rua/schema';
import { enterRow } from '../../ds/motion';
import {
  EmptyState,
  ListRow,
  PillButton,
  RunwayBar,
  SectionHeader,
  StatCard,
  color,
  space,
  type,
} from '../../ds';
import type { MedWithRunway } from '../../db/repo';

const VITAL_LABEL: Record<Vital['kind'], string> = {
  bp: 'Blood pressure',
  weight: 'Weight',
  glucose: 'Fasting glucose',
  spo2: 'Oxygen',
  temp: 'Temperature',
  steps: 'Steps',
  sleep: 'Sleep',
  active_min: 'Active minutes',
  hr: 'Resting heart rate',
};

function fmtVital(v: Vital): string {
  if (v.kind === 'bp' && v.value2 != null) return `${v.value}/${v.value2}`;
  return String(v.value);
}

function relDay(recordedOn: string, today: string): string {
  if (recordedOn === today) return 'today';
  const d = Math.round((Date.parse(today) - Date.parse(recordedOn)) / 86400000);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

function statusToColor(s: string): 'red' | 'amber' | 'green' {
  return s === 'overdue' || s === 'urgent' ? 'red' : s === 'soon' ? 'amber' : 'green';
}

export function OverviewTab({
  patient,
  meds,
  vitals,
  contacts,
  today,
}: {
  patient: Patient;
  meds: MedWithRunway[];
  vitals: Vital[];
  contacts: Contact[];
  today: string;
}) {
  const router = useRouter();
  const providers = contacts.filter((c) => c.kind === 'provider' || c.kind === 'pharmacy');
  const emergency = contacts.filter((c) => c.kind === 'emergency');
  const urgentMeds = meds.filter((m) => m.runway && (m.runway.status === 'urgent' || m.runway.status === 'overdue'));

  return (
    <View>
      {/* Paper layer shortcuts: the two documents an emergency actually needs. */}
      <Animated.View entering={enterRow(0)} style={{ flexDirection: 'row', gap: 10, marginTop: space.lg }}>
        <PillButton
          label="ER sheet"
          size="sm"
          icon={<ShieldAlert size={14} color={color.paper} strokeWidth={2} />}
          onPress={() => router.push(`/patient/${patient.id}/er` as never)}
        />
        <PillButton
          label="One-pager"
          variant="outline"
          size="sm"
          icon={<FileText size={14} color={color.ink} strokeWidth={2} />}
          onPress={() => router.push(`/patient/${patient.id}/onepager` as never)}
        />
      </Animated.View>

      <Animated.View entering={enterRow(1)}>
        <SectionHeader label="Latest vitals" meta={vitals.length ? undefined : 'none yet'} />
      </Animated.View>
      {vitals.length === 0 ? (
        <Animated.View entering={enterRow(2)}>
          <EmptyState
            title="No readings yet"
            detail="Record what you check at home: blood pressure, weight, glucose. Trends live in the Activity tab."
            action={
              <PillButton label="Add a reading" onPress={() => router.push(`/patient/${patient.id}/vital/new` as never)} />
            }
          />
        </Animated.View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {vitals.map((v, i) => (
              <Animated.View key={v.id} entering={enterRow(2 + i)} style={{ flexBasis: '47%', flexGrow: 1 }}>
                <StatCard
                  label={VITAL_LABEL[v.kind]}
                  value={fmtVital(v)}
                  unit={v.unit}
                  meta={relDay(v.recordedOn, today)}
                />
              </Animated.View>
            ))}
          </View>
          <Animated.View entering={enterRow(3)} style={{ marginTop: space.lg, flexDirection: 'row' }}>
            <PillButton
              label="Add a reading"
              variant="outline"
              size="sm"
              icon={<Plus size={14} color={color.ink} strokeWidth={2} />}
              onPress={() => router.push(`/patient/${patient.id}/vital/new` as never)}
            />
          </Animated.View>
        </>
      )}

      {urgentMeds.length > 0 ? (
        <>
          <Animated.View entering={enterRow(3)}>
            <SectionHeader label="Needs attention" meta={`${urgentMeds.length}`} />
          </Animated.View>
          {urgentMeds.map((m, i) => (
            <Animated.View key={m.id} entering={enterRow(4 + i)}>
              <ListRow
                title={`${m.name}${m.strength ? ` ${m.strength}` : ''}`}
                detail={m.runway!.daysRemaining <= 0 ? 'Supply ran out' : `Supply ends in ${m.runway!.daysRemaining} day${m.runway!.daysRemaining === 1 ? '' : 's'}`}
                onPress={() => router.push(`/patient/${patient.id}/med/${m.id}` as never)}
                last={i === urgentMeds.length - 1}
                right={<RunwayBar fraction={m.runway!.fraction} status={statusToColor(m.runway!.status)} />}
              />
            </Animated.View>
          ))}
        </>
      ) : null}

      <Animated.View entering={enterRow(4)}>
        <SectionHeader label="Care team" meta={providers.length ? undefined : 'add providers'} />
      </Animated.View>
      {providers.map((c, i) => (
        <Animated.View key={c.id} entering={enterRow(5 + i)}>
        <ListRow
          title={c.name}
          {...(c.relation ? { detail: c.relation } : {})}
          last={i === providers.length - 1}
          right={
            c.phone ? (
              <Pressable
                onPress={() => Linking.openURL(`tel:${c.phone!.replace(/[^\d+]/g, '')}`)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Call ${c.name}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }}
              >
                <Phone size={14} color={color.ink2} strokeWidth={1.8} />
                <Text style={[type.mini, { fontWeight: '600', color: color.ink }]}>{c.phone}</Text>
              </Pressable>
            ) : undefined
          }
        />
        </Animated.View>
      ))}

      {emergency.length > 0 ? (
        <>
          <Animated.View entering={enterRow(6)}>
            <SectionHeader label="Emergency contacts" />
          </Animated.View>
          {emergency.map((c, i) => (
            <Animated.View key={c.id} entering={enterRow(7 + i)}>
            <ListRow
              title={c.name}
              {...(c.relation ? { detail: c.relation } : {})}
              last={i === emergency.length - 1}
              right={
                c.phone ? (
                  <Pressable
                    onPress={() => Linking.openURL(`tel:${c.phone!.replace(/[^\d+]/g, '')}`)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={`Call ${c.name}`}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }}
                  >
                    <Phone size={14} color={color.ink2} strokeWidth={1.8} />
                    <Text style={[type.mini, { fontWeight: '600', color: color.ink }]}>{c.phone}</Text>
                  </Pressable>
                ) : undefined
              }
            />
            </Animated.View>
          ))}
        </>
      ) : null}

      <Animated.View entering={enterRow(8)} style={{ marginTop: space.lg }}>
        <PillButton
          label="Add a contact"
          variant="outline"
          size="sm"
          onPress={() => router.push(`/patient/${patient.id}/contact/new` as never)}
        />
      </Animated.View>
    </View>
  );
}
