import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { CalendarDays, ChevronLeft, Plus } from 'lucide-react-native';
import { daysBetween } from '@rua/core';
import { enterLead, enterQuiet, enterRow } from '../../ds/motion';
import {
  EmptyState,
  Hairline,
  PillButton,
  Screen,
  SectionHeader,
  StatusTag,
  color,
  space,
  type,
} from '../../ds';
import { listAppointments, type AppointmentWithPatient } from '../../db/apptRepo';
import { listPatients } from '../../db/repo';
import { useData } from '../../lib/useData';
import { today } from '../../lib/clock';
import { confirmLoadDemoFamily } from '../../lib/demo';
import { CalendarArt } from '../../components/EmptyArt';

function tagFor(a: AppointmentWithPatient, todayDate: string): { status: 'green' | 'amber' | 'neutral'; label: string } {
  const days = daysBetween(todayDate, a.onDate);
  if (days < 0) return { status: 'amber', label: 'Record the visit' };
  if (days <= 7) return { status: 'green', label: 'Prep ready' };
  return { status: 'neutral', label: `In ${days} days` };
}

function detailLine(a: AppointmentWithPatient): string {
  return [
    a.provider,
    a.specialty,
    `${a.onDate}${a.atTime ? ` at ${a.atTime}` : ''}`,
    a.driver ? `${a.driver} drives` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Patient-first row: the person's name leads, the visit details follow. */
function ApptRow({
  appt,
  last,
  todayDate,
  quiet,
  onPress,
}: {
  appt: AppointmentWithPatient;
  last: boolean;
  todayDate: string;
  quiet: boolean;
  onPress: () => void;
}) {
  const name = appt.patient.preferredName ?? appt.patient.fullName;
  return (
    <Pressable
      onPress={onPress}
      testID={quiet ? 'past-row' : 'appt-row'}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${appt.provider}, ${appt.onDate}`}
      style={({ pressed }) => [pressed && { backgroundColor: color.hover }]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={[type.body, { fontWeight: '600' }, quiet && { color: color.ink2 }]}
            numberOfLines={1}
          >
            {name}
          </Text>
          <Text style={[type.mini, { marginTop: 2 }]} numberOfLines={2}>
            {detailLine(appt)}
          </Text>
        </View>
        <View style={{ marginLeft: space.md, alignItems: 'flex-end' }}>
          {quiet ? (
            <Text style={type.mini}>Visit recorded</Text>
          ) : (
            <StatusTag {...tagFor(appt, todayDate)} />
          )}
        </View>
      </View>
      {!last && <Hairline />}
    </Pressable>
  );
}

export default function Appointments() {
  const router = useRouter();
  const todayDate = today();

  const data = useData(() => {
    const all = listAppointments();
    return {
      hasPatients: listPatients().length > 0,
      upcoming: all.filter((a) => a.status === 'scheduled'),
      past: all
        .filter((a) => a.status === 'done')
        .slice()
        .sort((a, b) => b.onDate.localeCompare(a.onDate)),
    };
  });

  const goHome = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen>
      <Pressable
        onPress={goHome}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Back to home"
        style={{ marginBottom: space.md, flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 }}
      >
        <ChevronLeft size={18} color={color.ink2} strokeWidth={1.8} />
        <Text style={type.mini}>Home</Text>
      </Pressable>

      <Animated.View entering={enterLead}>
        <Text style={type.title} accessibilityRole="header">
          Appointments
        </Text>
        <Text style={[type.detail, { marginTop: 6 }]}>
          Every visit across the circle, each with a prep sheet and a way to get there.
        </Text>
      </Animated.View>

      {!data.hasPatients ? (
        <Animated.View entering={enterRow(1)}>
          <EmptyState
            title="No one in your circle yet"
            detail="Add the first person you care for, then plan their visits here."
            action={
              <View style={{ alignItems: 'center', gap: 14 }}>
                <PillButton label="Add a person" onPress={() => router.push('/patient/new' as never)} />
                <Pressable onPress={() => confirmLoadDemoFamily()} accessibilityRole="button" hitSlop={8}>
                  <Text style={[type.mini, { textDecorationLine: 'underline' }]}>
                    Explore with a demo family
                  </Text>
                </Pressable>
              </View>
            }
          />
        </Animated.View>
      ) : (
        <>
          <Animated.View entering={enterRow(1)}>
            <View style={{ marginTop: space.lg, flexDirection: 'row' }}>
              <PillButton
                label="Add appointment"
                icon={<Plus size={16} color={color.paper} strokeWidth={2} />}
                onPress={() => router.push('/appointments/new' as never)}
              />
            </View>
          </Animated.View>

          <Animated.View entering={enterRow(2)}>
            <SectionHeader
              label="Upcoming"
              meta={data.upcoming.length ? `${data.upcoming.length}` : 'none scheduled'}
            />
          </Animated.View>
          {data.upcoming.length === 0 ? (
            <Animated.View entering={enterRow(3)}>
              <EmptyState
                art={<CalendarArt size={72} />}
                title="No upcoming appointments"
                detail="Add the next visit and RUA drafts the prep sheet from the record."
              />
            </Animated.View>
          ) : (
            data.upcoming.map((a, i) => (
              <Animated.View key={a.id} entering={enterRow(3 + i)}>
                <ApptRow
                  appt={a}
                  last={i === data.upcoming.length - 1}
                  todayDate={todayDate}
                  quiet={false}
                  onPress={() => router.push(`/appointments/${a.id}` as never)}
                />
              </Animated.View>
            ))
          )}

          {data.past.length > 0 ? (
            <>
              <Animated.View entering={enterRow(4 + Math.min(data.upcoming.length, 4))}>
                <SectionHeader label="Past visits" meta={`${data.past.length}`} />
              </Animated.View>
              {data.past.map((a, i) => (
                <Animated.View key={a.id} entering={enterRow(5 + Math.min(data.upcoming.length, 4) + i)}>
                  <ApptRow
                    appt={a}
                    last={i === data.past.length - 1}
                    todayDate={todayDate}
                    quiet
                    onPress={() => router.push(`/appointments/${a.id}` as never)}
                  />
                </Animated.View>
              ))}
            </>
          ) : null}

          <Animated.View entering={enterQuiet}>
            <View
              style={{ marginTop: space.xl, flexDirection: 'row', alignItems: 'center', gap: 8 }}
              accessible
              accessibilityLabel="Prep sheets are drafted from the record for visits within seven days"
            >
              <CalendarDays size={14} color={color.ink3} strokeWidth={1.8} />
              <Text style={[type.mini, { flex: 1 }]}>
                Within seven days of a visit, its prep sheet is ready from the latest record.
              </Text>
            </View>
          </Animated.View>
        </>
      )}
    </Screen>
  );
}
