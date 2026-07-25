import React from 'react';
import { Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import {
  Avatar,
  Card,
  CheckRow,
  DisclaimerFootnote,
  EmptyState,
  FormField,
  Hairline,
  ListRow,
  PillButton,
  RunwayBar,
  Screen,
  SectionHeader,
  StatusDot,
  StatusTag,
  space,
  type,
} from '../ds';
import { enterLead, enterRow } from '../ds/motion';

/**
 * The living style reference (P2): every component in every state,
 * compared side by side against the web MVP look.
 */
export default function Gallery() {
  const router = useRouter();
  const noop = () => {};
  return (
    <Screen title="Design gallery" subline="Ivory Editorial, native. Every component in every state.">
      <Animated.View entering={enterLead}>
      <SectionHeader label="Type scale" />
      <Text style={type.greet}>Good afternoon, Maria</Text>
      <Text style={[type.title, { marginTop: 8 }]}>Screen title</Text>
      <Text style={[type.heading, { marginTop: 8 }]}>Card heading</Text>
      <Text style={[type.body, { marginTop: 8 }]}>Body text for reading comfortably.</Text>
      <Text style={[type.detail, { marginTop: 8 }]}>Detail text explains quietly underneath.</Text>
      <Text style={[type.mini, { marginTop: 8 }]}>Mini text · metadata · 12.5pt</Text>
      <Text style={[type.label, { marginTop: 8 }]}>Section label</Text>
      <Text style={[type.stat, { marginTop: 8 }]}>4 days left</Text>
      </Animated.View>

      <Animated.View entering={enterRow(1)}>
      <SectionHeader label="Buttons" />
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <PillButton label="Primary dark" onPress={noop} />
        <PillButton label="Outline" variant="outline" onPress={noop} />
        <PillButton label="Danger" variant="danger" onPress={noop} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
        <PillButton label="Small" size="sm" onPress={noop} />
        <PillButton label="Disabled" disabled onPress={noop} />
        <PillButton label="Loading" loading onPress={noop} />
      </View>
      </Animated.View>

      <Animated.View entering={enterRow(2)}>
      <SectionHeader label="Status" />
      <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}>
        <StatusTag status="red" label="Act now" />
        <StatusTag status="amber" label="Worth a look" />
        <StatusTag status="green" label="All good" />
        <StatusDot status="neutral" />
      </View>
      <View style={{ gap: 10, marginTop: space.lg }}>
        <RunwayBar fraction={0.13} status="red" />
        <RunwayBar fraction={0.4} status="amber" />
        <RunwayBar fraction={0.85} status="green" />
      </View>
      </Animated.View>

      <Animated.View entering={enterRow(3)}>
      <SectionHeader label="Cards" />
      <Card accent="red">
        <Text style={type.label}>Needs action</Text>
        <Text style={[type.heading, { marginTop: 6 }]}>Robert's metformin runs out Thursday</Text>
        <Text style={[type.detail, { marginTop: 4 }]}>Refill not yet picked up at CVS. Filled Jun 29, a 30-day supply.</Text>
        <View style={{ marginTop: space.lg }}>
          <PillButton label="Request refill" onPress={noop} />
        </View>
      </Card>
      <Card style={{ marginTop: space.md }} onPress={noop}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Avatar name="Eleanor Alvarez" />
          <View style={{ flex: 1 }}>
            <Text style={type.heading}>Eleanor</Text>
            <Text style={[type.mini, { marginTop: 2 }]}>Mom · sertraline refill in 12 days</Text>
          </View>
          <StatusTag status="amber" label="Worth a look" />
        </View>
      </Card>
      </Animated.View>

      <Animated.View entering={enterRow(4)}>
      <SectionHeader label="Rows" />
      <ListRow title="Metformin 500 mg" detail="1 tablet, twice daily with meals" right={<Text style={type.mini}>4 days</Text>} onPress={noop} />
      <ListRow title="Apixaban 5 mg · high-alert" detail="2x daily" right={<Text style={type.mini}>12 days</Text>} onPress={noop} last />
      <Hairline />
      </Animated.View>

      <Animated.View entering={enterRow(5)}>
      <SectionHeader label="Forms" />
      <FormField label="Field label" placeholder="Placeholder" hint="A quiet hint underneath" />
      <FormField label="With an error" placeholder="" error="This needs attention." />
      <CheckRow checked onToggle={noop} label="A confirmed checkbox row with a longer label that wraps to two lines." />
      </Animated.View>

      <Animated.View entering={enterRow(6)}>
      <SectionHeader label="States" />
      <EmptyState
        title="Nothing here yet"
        detail="Empty states explain the next step, never just say empty."
        action={<PillButton label="The next step" size="sm" onPress={noop} />}
      />
      <DisclaimerFootnote>
        RUA is an organizational tool. It never suggests doses, diagnoses, or treatment.
      </DisclaimerFootnote>
      <View style={{ marginTop: space.xl }}>
        <PillButton label="Back" variant="outline" size="sm" onPress={() => router.back()} />
      </View>
      </Animated.View>
    </Screen>
  );
}
