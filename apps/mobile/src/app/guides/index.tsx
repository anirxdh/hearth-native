import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, PhoneCall } from 'lucide-react-native';
import { Screen, SectionHeader, color, radius, space, type } from '../../ds';
import { enterLead, enterQuiet, enterRow } from '../../ds/motion';
import { GUIDES } from '../../content/guides';

/** Quiet press feedback, the ds PressScale pattern kept local to this book. */
function PressScale({ pressed, children }: { pressed: boolean; children: React.ReactNode }) {
  const v = useSharedValue(1);
  React.useEffect(() => {
    v.value = withSpring(pressed ? 0.97 : 1, {
      damping: 22,
      stiffness: 420,
      reduceMotion: ReduceMotion.System,
    });
  }, [pressed, v]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: v.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** One book card: staggered entrance, spring scale on touch. */
function GuideRow({
  guide,
  index,
  last,
  onPress,
}: {
  guide: (typeof GUIDES)[number];
  index: number;
  last: boolean;
  onPress: () => void;
}) {
  const [pressed, setPressed] = React.useState(false);
  const FirstArt = guide.steps[0]!.Art;
  return (
    <Animated.View entering={enterRow(index + 2)}>
      <Pressable
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole="button"
        accessibilityLabel={`Open guide: ${guide.title}`}
      >
        <PressScale pressed={pressed}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              paddingVertical: 14,
              borderBottomWidth: last ? 0 : 1,
              borderBottomColor: color.line,
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: color.line,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FirstArt size={44} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.body, { fontWeight: '600' }]}>{guide.title}</Text>
              <Text style={[type.mini, { marginTop: 2 }]} numberOfLines={2}>
                {guide.oneLiner}
              </Text>
            </View>
            {guide.callFirst ? (
              <Text style={[type.mini, { color: color.red, fontWeight: '700' }]}>911 first</Text>
            ) : null}
            <ChevronRight size={17} color={color.ink3} strokeWidth={1.8} />
          </View>
        </PressScale>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Emergency guides (P16): a bundled, offline book of cards. Static content,
 * versioned and stamped for clinician review; nothing here is generated.
 */
export default function GuidesIndex() {
  const router = useRouter();

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

      {/* The title and the call-911 rule arrive together, no stagger between
          them: the safety line is part of the first read. */}
      <Animated.View entering={enterLead}>
        <Text style={type.title}>Open this when something happens</Text>
        <Text style={[type.detail, { marginTop: 4 }]}>
          Six situations, four calm steps each. Works with no signal, prints to paper, and never changes unless a
          clinician reviews the change.
        </Text>

        <View
          style={{
            marginTop: space.lg,
            borderWidth: 1,
            borderColor: color.red,
            borderRadius: radius.md,
            paddingHorizontal: 14,
            paddingVertical: 11,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <PhoneCall size={15} color={color.red} strokeWidth={2} />
          <Text style={[type.mini, { flex: 1, color: color.red, fontWeight: '600' }]}>
            If someone is unconscious, not breathing normally, or fading fast: call 911 first. These cards are for
            the minutes around that call, not instead of it.
          </Text>
        </View>
      </Animated.View>

      <Animated.View entering={enterRow(1)}>
        <SectionHeader label="The guides" meta={`${GUIDES.length}`} />
      </Animated.View>
      {GUIDES.map((g, i) => (
        <GuideRow
          key={g.id}
          guide={g}
          index={i}
          last={i === GUIDES.length - 1}
          onPress={() => router.push(`/guides/${g.id}` as never)}
        />
      ))}

      <Animated.View entering={enterQuiet}>
        <Text style={[type.mini, { marginTop: space.xl }]}>
          Content version {GUIDES[0]!.review.version} · {GUIDES[0]!.review.reviewer} · these cards are general first
          aid information, not medical advice, and do not replace emergency services or training.
        </Text>
      </Animated.View>
    </Screen>
  );
}
