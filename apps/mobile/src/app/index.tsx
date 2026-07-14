import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BookOpen, CalendarDays, FolderOutput, ScanLine, Settings2, Workflow } from 'lucide-react-native';
import { confirmLoadDemoFamily } from '../lib/demo';
import {
  buildDigest,
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
      <Text style={[type.label, { color: color.red }]}>Needs action</Text>
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

export default function Home() {
  const router = useRouter();
  const data = useData(() => {
    const patients = listPatients();
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
    return { patients, meds, digest };
  });

  const hour = new Date().getHours();

  if (data.patients.length === 0) {
    return (
      <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={type.greet}>{greetingFor(hour, null)}</Text>
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
              <PillButton label="Add a person" onPress={() => router.push('/patient/new')} />
              <Pressable
                onPress={confirmLoadDemoFamily}
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

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={type.greet}>{greetingFor(hour, null)}</Text>
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
      </View>

      <SectionHeader label="Today's digest" meta={today()} />
      {data.digest.lead ? (
        <LeadCard item={data.digest.lead} onGo={(r) => router.push(r as never)} />
      ) : (
        <Card style={{ marginTop: space.md }}>
          <StatusTag status="green" label="All good" />
          <Text style={[type.detail, { marginTop: 8 }]}>
            No refills due soon and nothing needs your attention today.
          </Text>
        </Card>
      )}
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
      {data.patients.map((p) => {
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

      <SectionHeader label="Tools" />
      <ListRow
        title="Scan a label"
        detail="Photograph a bottle; confirm each field; the runway updates itself."
        onPress={() => router.push('/scan' as never)}
        left={<ScanLine size={19} color={color.ink2} strokeWidth={1.8} />}
      />
      <ListRow
        title="Paperwork, automated"
        detail="Denial appeals, renewals, and releases assembled from your records. You confirm every fact."
        onPress={() => router.push('/workflows' as never)}
        left={<Workflow size={19} color={color.ink2} strokeWidth={1.8} />}
      />
      <ListRow
        title="Appointments"
        detail="Patient-first visits with a prep sheet that writes itself."
        onPress={() => router.push('/appointments' as never)}
        left={<CalendarDays size={19} color={color.ink2} strokeWidth={1.8} />}
      />
      <ListRow
        title="Emergency guides"
        detail="Six situations, four calm steps each. Works offline, prints to paper."
        onPress={() => router.push('/guides' as never)}
        left={<BookOpen size={19} color={color.ink2} strokeWidth={1.8} />}
      />
      <ListRow
        title="Everyone, one pack"
        detail="Every person's one-pager bundled into a single printable set."
        onPress={() => router.push('/portfolio' as never)}
        last
        left={<FolderOutput size={19} color={color.ink2} strokeWidth={1.8} />}
      />
    </Screen>
  );
}
