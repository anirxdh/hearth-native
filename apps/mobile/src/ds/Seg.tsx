import React from 'react';
import { Pressable, ScrollView, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { LiquidGlass, liquidGlassAvailable } from '../components/LiquidGlass';
import { color, radius, type } from './tokens';

/** The glide between segments: quick, settled, never bouncy. */
const thumbSpring = { damping: 22, stiffness: 260, reduceMotion: ReduceMotion.System } as const;

/**
 * Editorial segmented control: a hairline capsule row, ink fill on the active
 * segment. Scrolls horizontally when segments overflow (five-tab Patient 360).
 * On Liquid Glass devices the ink fill becomes a refractive glass thumb that
 * springs to whichever segment is active; everywhere else the static fill
 * renders exactly as before.
 */
export function Seg<T extends string>({
  options,
  value,
  onChange,
  scroll = false,
}: {
  options: { key: T; label: string; testID?: string }[];
  value: T;
  onChange: (next: T) => void;
  scroll?: boolean;
}) {
  const glassOn = liquidGlassAvailable();

  // The thumb's frame (glass path only). Options report their layout; the
  // active one pulls the thumb over. First placement snaps so the thumb
  // never glides in from zero width on mount.
  const thumbX = useSharedValue(0);
  const thumbW = useSharedValue(0);
  const frames = React.useRef<Partial<Record<T, { x: number; width: number }>>>({});
  const placed = React.useRef(false);
  const active = React.useRef(value);
  active.current = value;

  const measure = (key: T) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    frames.current[key] = { x, width };
    if (key !== active.current) return;
    if (placed.current) {
      thumbX.value = withSpring(x, thumbSpring);
      thumbW.value = withSpring(width, thumbSpring);
    } else {
      thumbX.value = x;
      thumbW.value = width;
      placed.current = true;
    }
  };

  React.useEffect(() => {
    const f = frames.current[value];
    if (!f) return;
    thumbX.value = withSpring(f.x, thumbSpring);
    thumbW.value = withSpring(f.width, thumbSpring);
    placed.current = true;
  }, [value, thumbX, thumbW]);

  const thumbStyle = useAnimatedStyle(() => ({
    width: thumbW.value,
    transform: [{ translateX: thumbX.value }],
  }));

  const row = (
    <View
      style={{
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: color.line,
        borderRadius: radius.pill,
        padding: 3,
        alignSelf: 'flex-start',
      }}
      accessibilityRole="tablist"
    >
      {glassOn ? (
        // The liquid thumb: real glass under the active label. Rendered
        // first so the labels sit above it in stacking order.
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', top: 3, bottom: 3, left: 0 }, thumbStyle]}
        >
          <LiquidGlass
            effect="regular"
            interactive
            style={{ flex: 1, borderRadius: radius.pill }}
          />
        </Animated.View>
      ) : null}
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            {...(o.testID ? { testID: o.testID } : {})}
            {...(glassOn ? { onLayout: measure(o.key) } : {})}
            hitSlop={6}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: radius.pill,
              backgroundColor: on && !glassOn ? color.ink : 'transparent',
            }}
          >
            <Text
              style={[
                type.mini,
                // Glass is light, so the active label stays ink there;
                // the fallback keeps paper-on-ink for contrast.
                { fontWeight: '600', color: on ? (glassOn ? color.ink : color.paper) : color.ink2 },
              ]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
  if (!scroll) return row;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
      {row}
    </ScrollView>
  );
}
