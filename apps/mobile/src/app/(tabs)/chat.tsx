import React from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { daysBetween } from '@hearth/core';
import { PillButton, Screen, color, radius, space, type } from '../../ds';
import { enterQuiet } from '../../ds/motion';
import { listAllMedications, listPatients } from '../../db/repo';
import { upcomingForDigest } from '../../db/apptRepo';
import { today } from '../../lib/clock';
import { useData } from '../../lib/useData';
import { answerFor, type CompanionAction, type CompanionCtx } from '../../lib/companion';

/**
 * The Companion tab: a calm chat over what is already in Hearth. All the
 * answering lives in lib/companion.ts (pure, local, honest); this screen
 * only assembles the context snapshot and renders the conversation.
 *
 * The message list is session-only by design: nothing here persists to the
 * database or anywhere else. Close the tab and the conversation is gone.
 */

type Msg = {
  id: number;
  role: 'user' | 'companion';
  text: string;
  action?: CompanionAction;
};

const CHIPS = ['Refills due', 'Next visit and rides', 'Emergency guides', 'Scan a label'];

const GREETING =
  'I can look things up in what you have already put into Hearth: refills, the next visit and rides, paperwork, and the emergency guides.';

function visitWhen(days: number, onDate: string): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days (${onDate})`;
}

function Bubble({ msg, onGo }: { msg: Msg; onGo: (route: string) => void }) {
  const user = msg.role === 'user';
  return (
    <Animated.View
      entering={enterQuiet}
      accessible
      accessibilityLabel={`${user ? 'You' : 'Companion'}: ${msg.text}`}
      style={[styles.bubble, user ? styles.bubbleUser : styles.bubbleCompanion]}
    >
      <Text style={[type.body, user && { color: color.paper }]}>{msg.text}</Text>
      {msg.action ? (
        <View style={{ marginTop: space.md }}>
          <PillButton
            label={msg.action.label}
            size="sm"
            variant="outline"
            onPress={() => onGo(msg.action!.route)}
          />
        </View>
      ) : null}
    </Animated.View>
  );
}

export default function CompanionTab() {
  const router = useRouter();
  const scrollRef = React.useRef<ScrollView>(null);

  // The context snapshot re-reads SQLite whenever any repo write lands,
  // the same pattern as home: answers always reflect the current records.
  const ctx = useData<CompanionCtx>(() => {
    const people = listPatients().map((p) => ({
      name: p.preferredName ?? p.fullName,
      route: `/patient/${p.id}`,
    }));
    const worstRunways = listAllMedications()
      .filter((m) => m.runway && m.runway.status !== 'ok')
      .sort((a, b) => a.runway!.daysRemaining - b.runway!.daysRemaining)
      .map((m) => ({
        patient: m.patient.preferredName ?? m.patient.fullName,
        med: m.name,
        daysRemaining: m.runway!.daysRemaining,
        route: `/patient/${m.patientId}`,
      }));
    const v = upcomingForDigest(today());
    const nextVisit = v
      ? {
          patientName: v.patientName,
          provider: v.provider,
          whenLine: visitWhen(daysBetween(today(), v.onDate), v.onDate),
          route: `/appointments/${v.id}`,
        }
      : null;
    return { people, worstRunways, nextVisit };
  });
  const ctxRef = React.useRef(ctx);
  ctxRef.current = ctx;

  const [input, setInput] = React.useState('');
  const [messages, setMessages] = React.useState<Msg[]>([
    { id: 0, role: 'companion', text: GREETING },
  ]);
  const nextId = React.useRef(1);
  const timers = React.useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  // Pending replies die with the screen; no timer outlives the mount.
  React.useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    const userId = nextId.current++;
    const replyId = nextId.current++;
    setMessages((m) => [...m, { id: userId, role: 'user', text }]);
    setInput('');
    // Give the tab bar back: the open keyboard fully covers the floating
    // capsule, and a sent message is a natural moment to stand down.
    Keyboard.dismiss();
    // The ~350ms pause lets the reply arrive composed instead of instant.
    const t = setTimeout(() => {
      timers.current.delete(t);
      const a = answerFor(text, ctxRef.current);
      setMessages((m) => [...m, { id: replyId, role: 'companion', text: a.text, action: a.action }]);
    }, 350);
    timers.current.add(t);
  };

  const go = (route: string) => router.push(route as never);

  return (
    <Screen title="Companion" scroll={false}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          <View accessibilityRole="list">
            {messages.map((m) => (
              <Bubble key={m.id} msg={m} onGo={go} />
            ))}
          </View>
        </ScrollView>

        <View style={styles.chipRow}>
          {CHIPS.map((c) => (
            <PillButton key={c} label={c} size="sm" variant="outline" onPress={() => send(c)} />
          ))}
        </View>

        <View style={styles.composer}>
          <TextInput
            testID="chat-input"
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => send(input)}
            returnKeyType="send"
            placeholder="Ask about refills or rides"
            placeholderTextColor={color.ink3}
            accessibilityLabel="Message the companion"
            style={styles.input}
          />
          <Pressable
            testID="chat-send"
            onPress={() => send(input)}
            accessibilityRole="button"
            accessibilityLabel="Send"
            style={({ pressed }) => [styles.send, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.sendText}>Send</Text>
          </Pressable>
        </View>

        <Animated.View entering={enterQuiet}>
          <Text style={[type.mini, { marginTop: space.sm, lineHeight: 17 }]}>
            Organizational help with what is already in Hearth. Not medical advice. In an
            emergency, call 911.
          </Text>
        </Animated.View>

        {/* Screen contributes 48 of bottom padding; this spacer brings the
            native total past the floating tab bar so even the disclaimer
            line sits fully above the glass. */}
        {Platform.OS !== 'web' ? <View style={{ height: 76 }} /> : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: '86%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: space.md,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: color.ink,
    borderRadius: 16,
  },
  bubbleCompanion: {
    alignSelf: 'flex-start',
    backgroundColor: color.paper,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.lg,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: space.md,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
  },
  /** The FormField input recipe, kept in step with ds/components. */
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: color.lineStrong,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 15,
    color: color.ink,
    backgroundColor: color.paper,
  },
  send: {
    height: 44,
    minWidth: 44,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.ink,
    backgroundColor: color.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { fontSize: 15, fontWeight: '600', color: color.paper },
});
