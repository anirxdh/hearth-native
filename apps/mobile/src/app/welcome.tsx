import React from 'react';
import { useWindowDimensions } from 'react-native';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn, ReduceMotion } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { ThresholdSphere } from '../components/ThresholdSphere';
import { confirmLoadDemoFamily } from '../lib/demo';
import { hasAccount } from '../lib/auth';
import { color, space, type } from '../ds';
import { duration, enterQuiet } from '../ds/motion';

/**
 * The threshold. The very first thing a new person sees is not a form and
 * not a dashboard: it is a quiet object that asks for a moment of
 * intention. Hold the sphere and Hearth opens; from there the guided
 * setup takes over. Returning account holders pass straight through to
 * their circle.
 *
 * The plain button below the sphere is a first-class path, not an escape
 * hatch: screen-reader users, switch users, and anyone who simply does
 * not want the ritual get the same doorway with the same dignity.
 */
export default function Welcome() {
  const router = useRouter();
  const { height } = useWindowDimensions();
  // The sphere breathes with the screen: a third of the height, never
  // larger than its ideal 264 and never cramped below 150.
  const sphereSize = Math.max(150, Math.min(264, Math.round(height * 0.34)));
  const topPad = Math.max(28, Math.round(height * 0.1));

  function enter() {
    router.replace(hasAccount() ? '/' : ('/onboarding' as never));
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.paper, alignItems: 'center' }}>
      <Animated.Text
        entering={enterQuiet}
        style={[
          type.label,
          { letterSpacing: 4.5, marginTop: topPad, color: color.ink2 },
        ]}
      >
        HEARTH
      </Animated.Text>

      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Animated.View
          entering={ZoomIn.duration(duration.slow * 2)
            .springify()
            .damping(26)
            .stiffness(140)
            .reduceMotion(ReduceMotion.System)}
        >
          <ThresholdSphere size={sphereSize} onEnter={enter} testID="threshold-sphere" />
        </Animated.View>
      </View>

      <Animated.View
        entering={FadeIn.duration(duration.slow).delay(700).reduceMotion(ReduceMotion.System)}
        style={{ alignItems: 'center', paddingBottom: Math.max(28, Math.round(height * 0.06)), gap: space.md }}
      >
        <Text style={[type.detail, { textAlign: 'center' }]}>
          A calm place for everyone you care for.
        </Text>
        <Text style={[type.mini, { color: color.ink3 }]}>Press and hold to begin</Text>

        <View style={{ alignItems: 'center', gap: 12, marginTop: space.lg }}>
          <Pressable
            onPress={enter}
            accessibilityRole="button"
            testID="threshold-continue"
            hitSlop={8}
          >
            <Text style={[type.detail, { textDecorationLine: 'underline', color: color.ink2 }]}>
              Continue without holding
            </Text>
          </Pressable>
          <Pressable
            onPress={() => confirmLoadDemoFamily(() => router.replace('/'))}
            accessibilityRole="button"
            testID="threshold-demo"
            hitSlop={8}
          >
            <Text style={[type.mini, { textDecorationLine: 'underline', color: color.ink3 }]}>
              Explore with a demo family
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}
