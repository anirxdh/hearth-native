import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Printer, Share2 } from 'lucide-react-native';
import {
  Avatar,
  DisclaimerFootnote,
  PillButton,
  Screen,
  SectionHeader,
  StatusDot,
  color,
  space,
  type,
} from '../ds';
import { listMedications, listPatients } from '../db/repo';
import { useData } from '../lib/useData';
import { outputPortfolio } from '../lib/print';

/**
 * The everyone portfolio (P15): the whole circle in one printable pack,
 * for the folder you hand a new clinician or bring to a family meeting.
 */
export default function Portfolio() {
  const router = useRouter();
  const [busy, setBusy] = useState<'print' | 'share' | null>(null);

  const data = useData(() => {
    const patients = listPatients();
    return {
      patients,
      perPatient: patients.map((p) => {
        const meds = listMedications(p.id);
        const urgent = meds.filter(
          (m) => m.runway && (m.runway.status === 'urgent' || m.runway.status === 'overdue'),
        ).length;
        const soon = meds.filter((m) => m.runway && m.runway.status === 'soon').length;
        return { patient: p, medCount: meds.length, urgent, soon };
      }),
    };
  });

  async function run(action: 'print' | 'share') {
    setBusy(action);
    try {
      await outputPortfolio(data?.patients ?? [], action);
    } catch (e) {
      Alert.alert('Could not prepare the portfolio', String(e));
    } finally {
      setBusy(null);
    }
  }

  const rows = data?.perPatient ?? [];

  return (
    <Screen>
      <Pressable
        onPress={() => router.back()}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Back to home"
        style={{ marginBottom: space.md, flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 }}
      >
        <ChevronLeft size={18} color={color.ink2} strokeWidth={1.8} />
        <Text style={type.mini}>Home</Text>
      </Pressable>

      <Text style={type.title}>Everyone, one pack</Text>
      <Text style={[type.detail, { marginTop: 4 }]}>
        Every person's page bundled into a single printable set. For the drawer, the glovebox, and the sibling who
        asks "so where do things stand?"
      </Text>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: space.lg }}>
        <PillButton
          label="Print all"
          icon={<Printer size={14} color={color.paper} strokeWidth={2} />}
          onPress={() => void run('print')}
          loading={busy === 'print'}
          disabled={rows.length === 0}
        />
        <PillButton
          label="Share PDF"
          variant="outline"
          icon={<Share2 size={14} color={color.ink} strokeWidth={2} />}
          onPress={() => void run('share')}
          loading={busy === 'share'}
          disabled={rows.length === 0}
        />
      </View>

      <SectionHeader label="In this pack" meta={`${rows.length} ${rows.length === 1 ? 'person' : 'people'}`} />
      {rows.map(({ patient: p, medCount, urgent, soon }, i) => (
        <Pressable
          key={p.id}
          onPress={() => router.push(`/patient/${p.id}` as never)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${p.fullName}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingVertical: 12,
            borderBottomWidth: i === rows.length - 1 ? 0 : 1,
            borderBottomColor: color.line,
          }}
        >
          <Avatar name={p.fullName} size={38} />
          <View style={{ flex: 1 }}>
            <Text style={[type.body, { fontWeight: '600' }]}>{p.fullName}</Text>
            <Text style={[type.mini, { marginTop: 2 }]}>
              {[p.relationship, `${medCount} medication${medCount === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <StatusDot status={urgent > 0 ? 'red' : soon > 0 ? 'amber' : 'green'} />
            <Text style={type.mini}>
              {urgent > 0 ? `${urgent} urgent` : soon > 0 ? `${soon} soon` : 'on track'}
            </Text>
          </View>
        </Pressable>
      ))}

      <DisclaimerFootnote>
        The printed pack contains each person's one-pager: conditions, medications, contacts, and allergies, with
        severe allergies leading every page.
      </DisclaimerFootnote>
    </Screen>
  );
}
