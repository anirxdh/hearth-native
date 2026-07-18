import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { BookOpen, CalendarDays, FolderOutput, ScanLine, Settings2, Workflow } from 'lucide-react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { confirmLoadDemoFamily } from '../lib/demo';
import { currentUser, hasAccount } from '../lib/auth';
import { LiquidGlass, liquidGlassAvailable } from '../components/LiquidGlass';
import { enterLead, enterRow } from '../ds/motion';
import {
  buildDigest,
  daysBetween,
  type DigestItem,
  type DigestMedInput,
  type RunwayStatus,
} from '@hearth/core';
import {
  Avatar,
  Card,
  EmptyState,
  Hairline,
  PillButton,
  Screen,
  ListRow,
  SectionHeader,
  StatusDot,
  StatusTag,
  color,
  space,
  type,
} from '../ds';
import { lastTouchedAt, listAllMedications, listPatients } from '../db/repo';
import { greetingFor, nowIso, today } from '../lib/clock';
import { useData } from '../lib/useData';
import { upcomingForDigest } from '../db/apptRepo';

type CircleStatus = { status: 'red' | 'amber' | 'green'; label: string; line: string };

function circleStatus(meds: ReturnType<typeof listAllMedications>, patientId: string): CircleStatus {
  const mine = meds.filter((m) => m.patientId === patientId && m.runway);
  const worst = (s: RunwayStatus[]) =>
    s.includes('overdue') || s.includes('urgent') ? 'red' : s.includes('soon') ? 'amber' : 'green';
  const statuses = mine.map((m) => m.runway!.status);
  const level = worst(statuses);
  if (level === 'red') {
    const m = mine
      .filter((x) => x.runway!.status === 'overdue' || x.runway!.status === 'urgent')
      .sort((a, b) => a.runway!.daysRemaining - b.runway!.daysRemaining)[0]!;
    return {
      status: 'red',
      label: 'Act now',
      line:
        m.runway!.daysRemaining <= 0
          ? `${m.name} has run out`
          : `${m.name}: ${m.runway!.daysRemaining} day${m.runway!.daysRemaining === 1 ? '' : 's'} left`,
    };
  }
  if (level === 'amber') {
    const m = mine.filter((x) => x.runway!.status === 'soon').sort((a, b) => a.runway!.daysRemaining - b.runway!.daysRemaining)[0]!;
    return { status: 'amber', label: 'Worth a look', line: `${m.name} refill in ${m.runway!.daysRemaining} days` };
  }
  return { status: 'green', label: 'All good', line: 'Medications on track' };
}

function LeadCard({ item, onGo }: { item: DigestItem; onGo: (route: string) => void }) {
  return (
    <Card accent="red" style={{ marginTop: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <StatusDot status="red" pulse />
        <Text style={[type.label, { color: color.red }]}>Needs action</Text>
      </View>
      <Text style={[type.heading, { marginTop: 6 }]}>{item.title}</Text>
      <Text style={[type.detail, { marginTop: 4 }]}>{item.detail}</Text>
      {item.action ? (
        <View style={{ marginTop: space.lg }}>
          <PillButton label={item.action.label} onPress={() => onGo(item.action!.route)} />
        </View>
      ) : null}
    </Card>
  );
}

function visitWhen(days: number, onDate: string): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days (${onDate})`;
}

/** One glass circle in the dock: a tiny press shrink and a light tap haptic. */
function DockButton({
  icon: Icon,
  label,
  onPress,
}: {
  icon: typeof ScanLine;
  label: string;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const press = (down: boolean) => {
    scale.value = withSpring(down ? 0.92 : 1, {
      damping: 22,
      stiffness: 420,
      reduceMotion: ReduceMotion.System,
    });
  };
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  // Standalone GlassView, same recipe as the onboarding capsules (which
  // render); GlassContainer refused to composite these on iOS 26.3, so the
  // circles sit close without the melt. Press feedback lives inside.
  return (
    <LiquidGlass
      effect="regular"
      interactive
      style={{ width: 56, height: 56, borderRadius: 999 }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPressIn={() => press(true)}
        onPressOut={() => press(false)}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onPress();
        }}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      >
        <Animated.View style={style}>
          <Icon size={22} color={color.ink} strokeWidth={1.8} />
        </Animated.View>
      </Pressable>
    </LiquidGlass>
  );
}

export default function Home() {
  const router = useRouter();
  const data = useData(() => {
    const patients = listPatients();
    const nextVisit = upcomingForDigest(today());
    const meds = listAllMedications();
    const digestMeds: DigestMedInput[] = meds.map((m) => ({
      medicationId: m.id,
      patientId: m.patientId,
      patientName: m.patient.preferredName ?? m.patient.fullName.split(' ')[0]!,
      medName: m.name,
      highAlert: m.highAlert,
      prn: m.prn,
      active: m.active,
      runway: m.runway,
    }));
    const digest = buildDigest(
      digestMeds,
      patients.map((p) => ({
        patientId: p.id,
        name: p.preferredName ?? p.fullName.split(' ')[0]!,
        lastTouchedAt: lastTouchedAt(p.id),
      })),
      today(),
      nowIso(),
    );
    return { patients, meds, digest, nextVisit };
  });

  const hour = new Date().getHours();
  const insets = useSafeAreaInsets();
  // The glass dock: iOS 26 only. Web and fallback devices keep today's page.
  const dock = Platform.OS === 'ios' && liquidGlassAvailable();

  // The threshold rule: nobody gets greeted before Hearth knows someone.
  // Brand-new visitors (no account, no people) meet the sphere instead.
  if (!hasAccount() && data.patients.length === 0) {
    return <Redirect href={'/welcome' as never} />;
  }

  if (data.patients.length === 0) {
    return (
      <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={type.greet}>{greetingFor(hour, currentUser()?.name.split(' ')[0] ?? null)}</Text>
            <Text style={[type.detail, { marginTop: 6 }]}>
              Hearth is a calm command center for everyone you care for.
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/settings')}
            accessibilityLabel="Settings"
            hitSlop={10}
            style={{ paddingTop: 6 }}
          >
            <Settings2 size={21} color={color.ink2} strokeWidth={1.8} />
          </Pressable>
        </View>
        <EmptyState
          title="Start your care circle"
          detail="Add the first person you care for. You stay in control of every detail; nothing is shared with anyone."
          action={
            <View style={{ alignItems: 'center', gap: 14 }}>
              <PillButton label="Set up Hearth" onPress={() => router.push('/onboarding' as never)} />
              <PillButton label="Add a person" variant="outline" onPress={() => router.push('/patient/new')} />
              <Pressable
                onPress={() => confirmLoadDemoFamily()}
                accessibilityRole="button"
                hitSlop={8}
              >
                <Text style={[type.mini, { textDecorationLine: 'underline' }]}>
                  Explore with a demo family
                </Text>
              </Pressable>
            </View>
          }
        />
      </Screen>
    );
  }

  const home = (
    <Screen>
      <Animated.View entering={enterLead} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={type.greet}>{greetingFor(hour, currentUser()?.name.split(' ')[0] ?? null)}</Text>
          <Text style={[type.detail, { marginTop: 5 }]}>
            Here is the one thing that needs you, and the calm around it.
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/settings')}
          accessibilityLabel="Settings"
          hitSlop={10}
          style={{ paddingTop: 6 }}
        >
          <Settings2 size={21} color={color.ink2} strokeWidth={1.8} />
        </Pressable>
      </Animated.View>

      <SectionHeader label="Today's digest" meta={today()} />
      {data.digest.lead ? (
        <Animated.View entering={enterRow(0)}>
          <LeadCard item={data.digest.lead} onGo={(r) => router.push(r as never)} />
        </Animated.View>
      ) : (
        <Card style={{ marginTop: space.md }}>
          <StatusTag status="green" label="All good" />
          <Text style={[type.detail, { marginTop: 8 }]}>
            No refills due soon and nothing needs your attention today.
          </Text>
        </Card>
      )}
      {data.nextVisit ? (
        <View testID="digest-appointment">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Appointment: ${data.nextVisit.patientName} sees ${data.nextVisit.provider} ${visitWhen(daysBetween(today(), data.nextVisit.onDate), data.nextVisit.onDate)}`}
            onPress={() => router.push(`/appointments/${data.nextVisit!.id}` as never)}
            style={({ pressed }) => [
              { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 10 },
              pressed ? { backgroundColor: color.hover } : null,
            ]}
          >
            <StatusDot status="neutral" />
            <Text style={[type.detail, { flex: 1, color: color.ink }]} numberOfLines={1}>
              {data.nextVisit.patientName} sees {data.nextVisit.provider}{' '}
              {visitWhen(daysBetween(today(), data.nextVisit.onDate), data.nextVisit.onDate)}
            </Text>
            <Text style={[type.mini, { fontWeight: '600' }]}>Prep sheet</Text>
          </Pressable>
          <Hairline />
        </View>
      ) : null}
      {data.digest.quiet
        .filter((q) => q.kind !== 'all-good' || data.digest.lead)
        .map((q, i, arr) => (
          <View key={`${q.kind}:${q.medicationId ?? q.patientId ?? i}`}>
            <Pressable
              onPress={q.action ? () => router.push(q.action!.route as never) : undefined}
              style={({ pressed }) => [
                { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 10 },
                pressed && q.action ? { backgroundColor: color.hover } : null,
              ]}
            >
              <StatusDot status={q.kind.startsWith('refill') ? 'amber' : 'neutral'} />
              <Text style={[type.detail, { flex: 1, color: color.ink }]} numberOfLines={1}>
                {q.title}
              </Text>
              {q.action ? <Text style={[type.mini, { fontWeight: '600' }]}>{q.action.label}</Text> : null}
            </Pressable>
            {i < arr.length - 1 ? <Hairline /> : null}
          </View>
        ))}

      <SectionHeader label="Care circle" meta={`${data.patients.length} ${data.patients.length === 1 ? 'person' : 'people'}`} />
      {data.patients.map((p, pi) => {
        const st = circleStatus(data.meds, p.id);
        const name = p.preferredName ?? p.fullName;
        return (
          <Card key={p.id} onPress={() => router.push(`/patient/${p.id}` as never)} style={{ marginTop: space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Avatar name={p.fullName} />
              <View style={{ flex: 1 }}>
                <Text style={type.heading}>{name}</Text>
                <Text style={[type.mini, { marginTop: 2 }]}>
                  {[p.relationship, st.line].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <StatusTag status={st.status} label={st.label} />
            </View>
          </Card>
        );
      })}
      <View style={{ marginTop: space.lg }}>
        <PillButton label="Add a person" variant="outline" size="sm" onPress={() => router.push('/patient/new')} />
      </View>

      <Animated.View entering={enterRow(3)}>
        <SectionHeader label="Tools" />
      </Animated.View>
      <Animated.View entering={enterRow(4)}>
        <ListRow
          title="Scan a label"
          detail="Photograph a bottle; confirm each field; the runway updates itself."
          onPress={() => router.push('/scan' as never)}
          left={<ScanLine size={19} color={color.ink2} strokeWidth={1.8} />}
        />
      </Animated.View>
      <Animated.View entering={enterRow(5)}>
        <ListRow
          title="Paperwork, automated"
          detail="Denial appeals, renewals, and releases assembled from your records. You confirm every fact."
          onPress={() => router.push('/workflows' as never)}
          left={<Workflow size={19} color={color.ink2} strokeWidth={1.8} />}
        />
      </Animated.View>
      <Animated.View entering={enterRow(6)}>
        <ListRow
          title="Appointments"
          detail="Patient-first visits with a prep sheet that writes itself."
          onPress={() => router.push('/appointments' as never)}
          left={<CalendarDays size={19} color={color.ink2} strokeWidth={1.8} />}
        />
      </Animated.View>
      <Animated.View entering={enterRow(7)}>
        <ListRow
          title="Emergency guides"
          detail="Six situations, four calm steps each. Works offline, prints to paper."
          onPress={() => router.push('/guides' as never)}
          left={<BookOpen size={19} color={color.ink2} strokeWidth={1.8} />}
        />
      </Animated.View>
      <Animated.View entering={enterRow(8)}>
        <ListRow
          title="Everyone, one pack"
          detail="Every person's one-pager bundled into a single printable set."
          onPress={() => router.push('/portfolio' as never)}
          last
          left={<FolderOutput size={19} color={color.ink2} strokeWidth={1.8} />}
        />
      </Animated.View>
      {dock ? (
        // Breathing room so the last Tools row is never trapped under the dock.
        <View style={{ height: 110 }} />
      ) : null}
    </Screen>
  );

  if (!dock) return home;

  // The showpiece: three glass circles floating over the page, close enough
  // that the container lets them melt toward each other.
  return (
    <View style={{ flex: 1 }}>
      {home}
      {/* No reanimated entering here: layout animations snapshot the
          subtree and the glass material never composites inside one. */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: insets.bottom + 18,
          alignItems: 'center',
        }}
      >
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <DockButton icon={ScanLine} label="Scan a label" onPress={() => router.push('/scan' as never)} />
          <DockButton icon={CalendarDays} label="Appointments" onPress={() => router.push('/appointments' as never)} />
          <DockButton icon={BookOpen} label="Emergency guides" onPress={() => router.push('/guides' as never)} />
        </View>
      </View>
    </View>
  );
}
