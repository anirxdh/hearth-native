import React, { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Accessibility,
  Bus,
  Car,
  CarTaxiFront,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Pencil,
  Phone,
  Printer,
} from 'lucide-react-native';
import { daysBetween } from '@rua/core';
import {
  Avatar,
  Card,
  DisclaimerFootnote,
  FormField,
  ListRow,
  PillButton,
  Screen,
  SectionHeader,
  StatusTag,
  color,
  space,
  type,
} from '../../../ds';
import { completeVisit, getAppointment, recentMedChanges } from '../../../db/apptRepo';
import { listContacts, listMedications, listObservations, listVitals } from '../../../db/repo';
import { enterLead, enterQuiet, enterRow } from '../../../ds/motion';
import { buildPrepSheet } from '../../../lib/prepSheet';
import { printPrepSheet } from '../../../lib/prepPrint';
import { infoDialog } from '../../../lib/dialogs';
import { useData } from '../../../lib/useData';
import { today } from '../../../lib/clock';

function openLink(url: string) {
  Linking.openURL(url).catch(() =>
    infoDialog('Could not open the link', 'This device could not open it right now.'),
  );
}

function telUrl(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

function whenTag(onDate: string, todayDate: string): { status: 'green' | 'amber' | 'neutral'; label: string } {
  const days = daysBetween(todayDate, onDate);
  if (days < 0) return { status: 'amber', label: 'Record the visit' };
  if (days === 0) return { status: 'green', label: 'Today' };
  if (days <= 7) return { status: 'green', label: 'Prep ready' };
  return { status: 'neutral', label: `In ${days} days` };
}

/** A quiet transport option: icon, title, caption; pressable when it links. */
function GetThereCard({
  icon,
  title,
  caption,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  caption: string;
  onPress?: () => void;
}) {
  return (
    <Card {...(onPress ? { onPress } : {})} style={{ marginTop: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        {icon}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={type.heading}>{title}</Text>
          <Text style={[type.mini, { marginTop: 3 }]}>{caption}</Text>
        </View>
      </View>
    </Card>
  );
}

export default function AppointmentKit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [scriptOpen, setScriptOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const todayDate = today();

  const data = useData(() => {
    const appt = getAppointment(id);
    if (!appt) return null;
    const patient = appt.patient;
    const meds = listMedications(patient.id);
    const sheet = buildPrepSheet({
      today: todayDate,
      meds: meds.map((m) => ({
        name: m.name,
        strength: m.strength,
        sig: m.sig,
        prn: m.prn,
        highAlert: m.highAlert,
      })),
      medChanges: recentMedChanges(patient.id, todayDate),
      vitals: listVitals(patient.id).map((v) => ({
        kind: v.kind,
        value: v.value,
        value2: v.value2,
        unit: v.unit,
        recordedOn: v.recordedOn,
        recordedAt: v.recordedAt,
      })),
      observations: listObservations(patient.id).map((o) => ({ kind: o.kind, text: o.text, at: o.at })),
      bring: appt.bring,
    });
    const emergency = listContacts(patient.id).filter((c) => c.kind === 'emergency');
    return { appt, patient, sheet, emergency };
  });

  if (!data) {
    return (
      <Screen title="Not found">
        <PillButton label="Back" variant="outline" onPress={() => router.back()} />
      </Screen>
    );
  }
  const { appt, patient, sheet, emergency } = data;
  const displayName = patient.preferredName ?? patient.fullName;

  const mapsUrl = appt.location
    ? `https://maps.apple.com/?daddr=${encodeURIComponent(appt.location)}`
    : null;

  const scriptLines = [
    `Hi, I am calling to schedule an appointment for ${patient.fullName}${patient.dob ? `, date of birth ${patient.dob}` : ''}.`,
    `We would like to see ${appt.provider}${appt.specialty ? ` (${appt.specialty})` : ''}${appt.purpose ? ` about: ${appt.purpose}` : ''}.`,
    'Insurance: [read the plan name and member ID from the insurance card].',
    'Could you note any paperwork or prep we should bring?',
    'What is the earliest available date, and is there a cancellation list?',
  ];

  function saveVisit() {
    completeVisit(id, notes);
    setNotes('');
  }

  return (
    <Screen>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/appointments' as never))}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Back to appointments"
        style={{ marginBottom: space.md, flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 }}
      >
        <ChevronLeft size={18} color={color.ink2} strokeWidth={1.8} />
        <Text style={type.mini}>Appointments</Text>
      </Pressable>

      {/* Patient-first header: whose visit this is leads the page. */}
      <Animated.View entering={enterLead}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
        <Avatar name={patient.fullName} size={52} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={type.title}>{displayName}</Text>
          <Text style={[type.detail, { marginTop: 3 }]} numberOfLines={2}>
            {[appt.provider, appt.specialty].filter(Boolean).join(' · ')}
          </Text>
          <Text style={[type.mini, { marginTop: 3 }]} numberOfLines={2}>
            {[
              `${appt.onDate}${appt.atTime ? ` at ${appt.atTime}` : ''}`,
              appt.location,
              appt.driver ? `${appt.driver} drives` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push(`/appointments/${id}/edit` as never)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Edit appointment"
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Pencil size={19} color={color.ink2} strokeWidth={1.8} />
        </Pressable>
      </View>
      <View style={{ marginTop: space.md, flexDirection: 'row' }}>
        {appt.status === 'done' ? (
          <View testID="visit-recorded">
            <StatusTag status="neutral" label="Visit recorded" />
          </View>
        ) : (
          <StatusTag {...whenTag(appt.onDate, todayDate)} />
        )}
      </View>
      </Animated.View>

      {/* THE PREP SHEET: deterministic, computed from the record. */}
      <Animated.View entering={enterRow(1)}>
      <SectionHeader label="Current medications" meta={sheet.currentMeds.length ? `${sheet.currentMeds.length}` : 'none'} />
      {sheet.currentMeds.length === 0 ? (
        <Text style={type.detail}>No medications on record.</Text>
      ) : (
        sheet.currentMeds.map((m, i) => (
          <ListRow
            key={`${m.name}-${i}`}
            title={`${m.name}${m.strength ? ` ${m.strength}` : ''}`}
            {...(m.sig ? { detail: m.sig } : {})}
            last={i === sheet.currentMeds.length - 1}
            right={
              m.highAlert ? (
                <Text style={[type.mini, { color: color.red, fontWeight: '700' }]}>HIGH ALERT</Text>
              ) : m.prn ? (
                <Text style={type.mini}>As needed</Text>
              ) : undefined
            }
          />
        ))
      )}
      </Animated.View>

      <Animated.View entering={enterRow(2)}>
      <SectionHeader label="Changes, last 30 days" meta={sheet.medChanges.length ? `${sheet.medChanges.length}` : 'none'} />
      {sheet.medChanges.length === 0 ? (
        <Text style={type.detail}>No medication changes in the last 30 days.</Text>
      ) : (
        sheet.medChanges.map((line, i) => (
          <Text key={i} style={[type.detail, { marginTop: i === 0 ? 0 : 6 }]}>
            {line}
          </Text>
        ))
      )}
      </Animated.View>

      <Animated.View entering={enterRow(3)}>
      <SectionHeader label="Trends worth mentioning" meta={sheet.trends.length ? undefined : 'none'} />
      {sheet.trends.length === 0 ? (
        <Text style={type.detail}>No notable movement in the tracked vitals.</Text>
      ) : (
        sheet.trends.map((line, i) => (
          <Text key={i} style={[type.detail, { color: color.ink, marginTop: i === 0 ? 0 : 6 }]}>
            {line}
          </Text>
        ))
      )}
      </Animated.View>

      <Animated.View entering={enterRow(4)}>
      <SectionHeader label="Recent observations" meta={sheet.observations.length ? `newest ${sheet.observations.length}` : 'none'} />
      {sheet.observations.length === 0 ? (
        <Text style={type.detail}>Nothing noted in the last 30 days.</Text>
      ) : (
        sheet.observations.map((o, i) => (
          <View key={`${o.on}-${i}`} style={{ marginTop: i === 0 ? 0 : 10 }}>
            <Text style={type.mini}>{o.on}</Text>
            <Text style={[type.detail, { marginTop: 2 }]}>{o.text}</Text>
          </View>
        ))
      )}
      </Animated.View>

      <Animated.View entering={enterRow(5)}>
      <SectionHeader label="Questions to ask" meta={`${sheet.questions.length}`} />
      {sheet.questions.map((q, i) => (
        <Text
          key={i}
          testID="prep-question"
          style={[type.detail, { color: color.ink, marginTop: i === 0 ? 0 : 8 }]}
        >
          {`${i + 1}. ${q}`}
        </Text>
      ))}
      </Animated.View>

      <Animated.View entering={enterRow(6)}>
      <SectionHeader label="Bring" />
      {sheet.bring.map((b, i) => (
        <Text key={i} style={[type.detail, { marginTop: i === 0 ? 0 : 6 }]}>
          {`· ${b}`}
        </Text>
      ))}

      <View style={{ marginTop: space.xl, flexDirection: 'row' }}>
        <PillButton
          label="Print prep sheet"
          icon={<Printer size={16} color={color.paper} strokeWidth={2} />}
          onPress={() =>
            printPrepSheet(patient, appt, sheet).catch(() =>
              infoDialog('Print failed', 'This device could not print right now.'),
            )
          }
        />
      </View>
      </Animated.View>

      {/* Booking call script: everything the front desk asks, in one place. */}
      <Animated.View entering={enterRow(7)}>
      <Card style={{ marginTop: space.xl }}>
        <Pressable
          onPress={() => setScriptOpen(!scriptOpen)}
          accessibilityRole="button"
          accessibilityLabel="Booking call script"
          accessibilityState={{ expanded: scriptOpen }}
          style={{ flexDirection: 'row', alignItems: 'center' }}
        >
          <Text style={[type.heading, { flex: 1 }]}>Booking call script</Text>
          {scriptOpen ? (
            <ChevronUp size={18} color={color.ink2} strokeWidth={1.8} />
          ) : (
            <ChevronDown size={18} color={color.ink2} strokeWidth={1.8} />
          )}
        </Pressable>
        {scriptOpen ? (
          <View style={{ marginTop: space.md }}>
            {scriptLines.map((line, i) => (
              <Text key={i} style={[type.detail, { marginTop: i === 0 ? 0 : 8 }]}>
                {line}
              </Text>
            ))}
            {appt.phone ? (
              <View style={{ marginTop: space.lg, flexDirection: 'row' }}>
                <PillButton
                  label="Call the clinic"
                  variant="outline"
                  size="sm"
                  icon={<Phone size={14} color={color.ink} strokeWidth={2} />}
                  onPress={() => openLink(telUrl(appt.phone!))}
                />
              </View>
            ) : null}
          </View>
        ) : null}
      </Card>
      </Animated.View>

      {/* After the visit. */}
      <Animated.View entering={enterRow(8)}>
      {appt.status === 'done' ? (
        <>
          <SectionHeader label="What happened" meta={appt.onDate} />
          <Card>
            <Text style={type.detail}>{appt.postVisitNotes || 'No notes recorded.'}</Text>
          </Card>
        </>
      ) : (
        <>
          <SectionHeader label="After the visit" />
          <FormField
            label="Record what happened"
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="What the clinician said, changes made, follow-ups booked"
            testID="post-visit-input"
          />
          <View testID="post-visit-save" style={{ alignSelf: 'flex-start', marginTop: space.lg }}>
            <PillButton label="Save visit notes" onPress={saveVisit} disabled={!notes.trim()} />
          </View>
          <Text style={[type.mini, { marginTop: 8 }]}>
            Saving marks the visit done and adds it to the history timeline.
          </Text>
        </>
      )}
      </Animated.View>

      {/* GET THERE: deterministic options, no map, no personal data in links. */}
      <Animated.View entering={enterRow(8)}>
      <SectionHeader label="Get there" />
      {mapsUrl ? (
        <>
          <GetThereCard
            icon={<Car size={19} color={color.ink2} strokeWidth={1.8} />}
            title="Drive"
            caption={`Directions to ${appt.location}`}
            onPress={() => openLink(mapsUrl)}
          />
          <GetThereCard
            icon={<Bus size={19} color={color.ink2} strokeWidth={1.8} />}
            title="Transit"
            caption={`Public transport to ${appt.location}`}
            onPress={() => openLink(`${mapsUrl}&dirflg=r`)}
          />
        </>
      ) : (
        <Card style={{ marginTop: space.md }}>
          <Text style={type.detail}>
            Add the clinic location to this appointment to get driving and transit directions.
          </Text>
        </Card>
      )}
      <GetThereCard
        icon={<CarTaxiFront size={19} color={color.ink2} strokeWidth={1.8} />}
        title="Rideshare"
        caption="Set the clinic as destination in the app"
        onPress={() => openLink('https://m.uber.com')}
      />
      <Card style={{ marginTop: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
          <Accessibility size={19} color={color.ink2} strokeWidth={1.8} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={type.heading}>Paratransit and NEMT</Text>
            <Text style={[type.detail, { marginTop: 4 }]}>
              Local paratransit and nonemergency medical transport (NEMT) usually need booking one
              to three days ahead. Many insurance plans cover rides to medical visits. Ask the
              clinic for NEMT eligibility, or call the number on the insurance card.
            </Text>
          </View>
        </View>
      </Card>
      </Animated.View>

      {/* Escalation: who to call when the ride falls through. */}
      <Animated.View entering={enterRow(8)}>
      <SectionHeader label="If you cannot get there" />
      {appt.phone ? (
        <ListRow
          title="Call the clinic to reschedule"
          detail={appt.phone}
          last={emergency.length === 0}
          right={
            <Pressable
              onPress={() => openLink(telUrl(appt.phone!))}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Call the clinic"
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <Phone size={16} color={color.ink2} strokeWidth={1.8} />
            </Pressable>
          }
        />
      ) : null}
      {emergency.map((c, i) => (
        <ListRow
          key={c.id}
          title={c.name}
          {...(c.relation ? { detail: c.relation } : {})}
          last={i === emergency.length - 1}
          right={
            c.phone ? (
              <Pressable
                onPress={() => openLink(telUrl(c.phone!))}
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
      ))}
      {emergency.length === 0 && !appt.phone ? (
        <Text style={type.detail}>
          Add emergency contacts to {displayName}&apos;s record so a backup driver is one tap away.
        </Text>
      ) : null}
      </Animated.View>

      <Animated.View entering={enterQuiet}>
      <DisclaimerFootnote>
        The prep sheet is drafted from records kept at home. It is not medical advice; bring the
        questions to the clinician and verify details against the bottle and the chart.
      </DisclaimerFootnote>
      </Animated.View>
    </Screen>
  );
}
