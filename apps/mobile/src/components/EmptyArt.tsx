/**
 * Empty-state pictograms. Small line drawings in the emergency-guide style
 * (viewBox 64, ink strokes, round caps, at most a tiny red accent) that turn
 * an empty screen into an invitation instead of a dead end.
 */
import React from 'react';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

const INK = '#1D1D1F';
const RED = '#C4362F';

/** Shared stroke style for every pictogram line. */
const P = {
  stroke: INK,
  strokeWidth: 2.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
} as const;

/** Finer stroke for small interior detail (text lines, date marks). */
const F = {
  stroke: INK,
  strokeWidth: 2.2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
} as const;

/** The single small red accent, used sparingly. */
const R = {
  stroke: RED,
  strokeWidth: 2.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
} as const;

/** Full float cycle: down 1.6s, back 1.6s. Slow enough to read as stillness. */
const FLOAT_HALF_MS = 1600;
const FLOAT_RISE_PX = -3;

/**
 * Decorative frame: the art never speaks to screen readers. It carries a
 * barely-there vertical float so empty states feel alive, not abandoned.
 */
function Frame({
  size = 72,
  children,
}: {
  size?: number | undefined;
  children: React.ReactNode;
}): React.ReactElement {
  const drift = useSharedValue(0);
  React.useEffect(() => {
    drift.value = withRepeat(
      withTiming(FLOAT_RISE_PX, { duration: FLOAT_HALF_MS }),
      -1,
      true,
      undefined,
      ReduceMotion.System,
    );
  }, [drift]);
  const float = useAnimatedStyle(() => ({ transform: [{ translateY: drift.value }] }));
  return (
    <Animated.View style={float}>
      <Svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {children}
      </Svg>
    </Animated.View>
  );
}

/** Open folder with a sheet rising out of it. */
export function FolderArt({ size = 72 }: { size?: number }): React.ReactElement {
  return (
    <Frame size={size}>
      <Path d="M9 47 L9 16 Q9 14 11 14 L23 14 L27 19" {...P} />
      <Path d="M44 19 L48 19 Q50 19 50 21 L50 25" {...P} />
      <Path d="M28 26 L28 9 L44 9 L44 26" {...P} />
      <Line x1={33} y1={15} x2={39} y2={15} {...F} />
      <Line x1={33} y1={20} x2={39} y2={20} {...F} />
      <Path d="M9 47 L15 27 L56 27 L50 47 Z" {...P} />
    </Frame>
  );
}

/** Calendar page with a small heart marking a date. */
export function CalendarArt({ size = 72 }: { size?: number }): React.ReactElement {
  return (
    <Frame size={size}>
      <Rect x={9} y={13} width={46} height={40} rx={4} {...P} />
      <Line x1={9} y1={24} x2={55} y2={24} {...P} />
      <Line x1={21} y1={8} x2={21} y2={17} {...P} />
      <Line x1={43} y1={8} x2={43} y2={17} {...P} />
      <Line x1={17} y1={33} x2={22} y2={33} {...F} />
      <Line x1={29} y1={33} x2={34} y2={33} {...F} />
      <Line x1={17} y1={43} x2={22} y2={43} {...F} />
      <Path
        d="M43 45.5 C40 43 38.5 40.8 39.6 39 C40.7 37.4 43 38 43 40 C43 38 45.3 37.4 46.4 39 C47.5 40.8 46 43 43 45.5 Z"
        {...R}
      />
    </Frame>
  );
}

/** Notebook with binding ticks and a pencil resting on the page. */
export function NotebookArt({ size = 72 }: { size?: number }): React.ReactElement {
  return (
    <Frame size={size}>
      <Rect x={11} y={9} width={30} height={46} rx={3} {...P} />
      <Line x1={8} y1={18} x2={14} y2={18} {...P} />
      <Line x1={8} y1={30} x2={14} y2={30} {...P} />
      <Line x1={8} y1={42} x2={14} y2={42} {...P} />
      <Line x1={20} y1={20} x2={34} y2={20} {...F} />
      <Line x1={20} y1={27} x2={30} y2={27} {...F} />
      <Path d="M51.5 13 L56.5 15.5 L42.5 45 L37.5 49.5 L38 43 Z" {...P} />
    </Frame>
  );
}

/** Axes with a gentle rising line and two readings; the latest carries the accent. */
export function ChartArt({ size = 72 }: { size?: number }): React.ReactElement {
  return (
    <Frame size={size}>
      <Path d="M11 9 L11 51 L57 51" {...P} />
      <Path d="M15 42 C21 40 25 37 30 34 C35 31 39 29 44 26 C47 24 49.5 21 52 18" {...P} />
      <Circle cx={30} cy={34} r={2.6} {...P} />
      <Circle cx={44} cy={26} r={2.6} {...R} />
    </Frame>
  );
}

/** Three workflow nodes joined by soft edges. */
export function FlowArt({ size = 72 }: { size?: number }): React.ReactElement {
  return (
    <Frame size={size}>
      <Rect x={8} y={9} width={17} height={13} rx={3.5} {...P} />
      <Rect x={39} y={25} width={17} height={13} rx={3.5} {...P} />
      <Rect x={17} y={42} width={17} height={13} rx={3.5} {...P} />
      <Path d="M25 15.5 C32 15.5 32 31.5 39 31.5" {...P} />
      <Path d="M47.5 38 C47.5 48.5 41 48.5 34 48.5" {...P} />
    </Frame>
  );
}

/** Medicine bottle with its cap and label band. */
export function BottleArt({ size = 72 }: { size?: number }): React.ReactElement {
  return (
    <Frame size={size}>
      <Rect x={23} y={7} width={18} height={8} rx={2} {...P} />
      <Path d="M26 15 L26 19 Q21 21 21 26 L21 50 Q21 55 26 55 L38 55 Q43 55 43 50 L43 26 Q43 21 38 19 L38 15" {...P} />
      <Line x1={21} y1={31} x2={43} y2={31} {...P} />
      <Line x1={21} y1={45} x2={43} y2={45} {...P} />
      <Line x1={27} y1={37} x2={37} y2={37} {...F} />
      <Line x1={27} y1={41} x2={33} y2={41} {...F} />
    </Frame>
  );
}
