import React, { useEffect } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, ZoomIn, ReduceMotion } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ThresholdSphere } from '../components/ThresholdSphere';
import { hasAccount } from '../lib/auth';
import { color, space, type } from '../ds';
import { duration, enterQuiet } from '../ds/motion';

/**
 * The threshold. One object, one gesture: hold the sphere for three
 * seconds and Hearth opens. No buttons, no links - the ritual IS the
 * door. It compacts under the finger, pulses build, the ring fills,
 * and it blooms open into the guided setup (or straight to the circle
 * for returning account holders).
 *
 * Accessibility without visual compromise: VoiceOver users activate the
 * sphere directly (double tap), announced in its hint - the same door,
 * no separate signage. The demo-family path lives inside onboarding now.
 */
export default function Welcome() {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const { enter: enterParam } = useLocalSearchParams<{ enter?: string }>();
  const sphereSize = Math.max(150, Math.min(264, Math.round(height * 0.34)));
  const topPad = Math.max(28, Math.round(height * 0.1));

  function enter() {
    router.replace(hasAccount() ? '/' : ('/onboarding' as never));
  }

  // Dev-only automation hook: local Maestro flows cannot express a 3s hold,
  // so hearth:///welcome?enter=1 walks through in dev builds. Inert in prod.
  useEffect(() => {
    if (__DEV__ && enterParam === '1') enter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enterParam]);

  return (
    <View style={{ flex: 1, backgroundColor: color.paper, alignItems: 'center' }}>
      <Animated.Text
        entering={enterQuiet}
        style={[type.label, { letterSpacing: 4.5, marginTop: topPad, color: color.ink2 }]}
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
        style={{
          alignItems: 'center',
          paddingBottom: Math.max(40, Math.round(height * 0.08)),
          gap: space.sm,
        }}
      >
        <Text style={[type.detail, { textAlign: 'center' }]}>
          A calm place for everyone you care for.
        </Text>
        <Text style={[type.mini, { color: color.ink3 }]}>Press and hold to begin</Text>
      </Animated.View>
    </View>
  );
}
