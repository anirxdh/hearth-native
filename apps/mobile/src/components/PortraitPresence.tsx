import React, { useState } from 'react';
import { Pressable } from 'react-native';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Rect, Stop } from 'react-native-svg';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

/**
 * A presence, not a face. Care is about a person, so the landing carries a
 * human silhouette - but a real photograph would make Hearth feel like a
 * stock template and would put a stranger's face on someone's mother.
 * Instead: a soft grey figure built from blurred radial light, alive with
 * a slow breathing loop, that COLLAPSES gently under a touch and settles
 * back when released - the "blur that responds to the hand".
 */
export function PortraitPresence({ size = 132 }: { size?: number }) {
  const [pressed, setPressed] = useState(false);
  const scale = useSharedValue(1);
  const breathe = useSharedValue(1);

  React.useEffect(() => {
    breathe.value = withRepeat(
      withSequence(
        withTiming(1.035, { duration: 2600 }),
        withTiming(1, { duration: 2600 }),
      ),
      -1,
      false,
      undefined,
      ReduceMotion.System,
    );
  }, [breathe]);

  React.useEffect(() => {
    scale.value = withSpring(pressed ? 0.9 : 1, {
      damping: 16,
      stiffness: 220,
      reduceMotion: ReduceMotion.System,
    });
  }, [pressed, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * breathe.value }],
    opacity: withTiming(pressed ? 0.55 : 1, { duration: 160 }),
  }));

  return (
    <Pressable
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={style}>
        <Svg width={size} height={size} viewBox="0 0 120 120">
          <Defs>
            <RadialGradient id="pp-halo" cx="0.5" cy="0.42" r="0.62">
              <Stop offset="0" stopColor="#B9B9BF" stopOpacity="0.5" />
              <Stop offset="0.65" stopColor="#D6D6DB" stopOpacity="0.22" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="pp-head" cx="0.5" cy="0.45" r="0.55">
              <Stop offset="0" stopColor="#8E8E94" stopOpacity="0.85" />
              <Stop offset="0.75" stopColor="#A9A9AF" stopOpacity="0.5" />
              <Stop offset="1" stopColor="#C9C9CE" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="pp-body" cx="0.5" cy="0.28" r="0.7">
              <Stop offset="0" stopColor="#9A9AA0" stopOpacity="0.7" />
              <Stop offset="0.7" stopColor="#B5B5BB" stopOpacity="0.35" />
              <Stop offset="1" stopColor="#D6D6DB" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          {/* ambient halo */}
          <Rect x="0" y="0" width="120" height="120" fill="url(#pp-halo)" />
          {/* head: pure soft light, no features - dignity by abstraction */}
          <Circle cx="60" cy="42" r="21" fill="url(#pp-head)" />
          {/* shoulders */}
          <Ellipse cx="60" cy="92" rx="34" ry="24" fill="url(#pp-body)" />
        </Svg>
      </Animated.View>
    </Pressable>
  );
}
