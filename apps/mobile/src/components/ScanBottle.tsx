/**
 * The illustrated scan moment, ported from the validated web MVP: an amber
 * prescription bottle with a white pharmacy label, a scanning beam that
 * sweeps down the label, and detected-field tags that pop in one by one as
 * the beam passes them. Pure illustration: the real parse pipeline runs
 * beside it, this just tells the caregiver what Hearth is doing.
 */
import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, DimensionValue, Platform, Text, View } from 'react-native';
import Animated, {
  ReduceMotion,
  ZoomIn,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { Check, TriangleAlert } from 'lucide-react-native';
import { color } from '../ds';
import { duration } from '../ds/motion';

/* Illustration palette: amber glass and its label, matching the web MVP.
 * These are drawing colors, not UI colors; UI chrome uses ds tokens. */
const AMBER_STOPS = ['#B98A3A', '#E0A94E', '#EDBE6A', '#DA9F42', '#AE7E30'] as const;
const CAP_STOPS = ['#D2D2D7', '#F7F7F9', '#E8E8EC', '#C7C7CD'] as const;
const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

/** One sweep of the beam down the label, then back (mirrors the web loop). */
const SWEEP_MS = 1500;
/** Beam travel, as a fraction of the bottle height (web: 14% to 78%). */
const BEAM_TOP_MIN = 0.14;
const BEAM_TOP_MAX = 0.78;

interface DetectedField {
  key: string;
  label: string;
  /** Percent geometry of the dashed box, relative to the bottle frame. */
  top: number;
  left: number;
  width: number;
  height: number;
  /** Web MVP's .t.b: the tag hangs below the box instead of above. */
  tagBelow: boolean;
  /** Web MVP's .det.warn: the amber verify style (DAY SUPPLY). */
  warn: boolean;
}

const FIELDS: DetectedField[] = [
  { key: 'patient', label: 'PATIENT', top: 46, left: 26, width: 48, height: 4.6, tagBelow: false, warn: false },
  { key: 'drug', label: 'DRUG NAME', top: 52.5, left: 26, width: 50, height: 5.5, tagBelow: true, warn: false },
  { key: 'fill', label: 'FILL DATE', top: 68.5, left: 26, width: 24, height: 4.5, tagBelow: false, warn: false },
  { key: 'supply', label: 'DAY SUPPLY', top: 75, left: 26, width: 27, height: 4.5, tagBelow: true, warn: true },
];

const pct = (n: number): DimensionValue => `${n}%`;

/** Milliseconds into the first sweep at which the beam reaches a field. */
function revealAt(topPercent: number): number {
  const t = (topPercent / 100 - BEAM_TOP_MIN) / (BEAM_TOP_MAX - BEAM_TOP_MIN);
  return Math.max(0, Math.min(1, t)) * SWEEP_MS;
}

function FieldTag({ field }: { field: DetectedField }) {
  const tint = field.warn ? color.amber : color.ink;
  return (
    <Animated.View
      pointerEvents="none"
      entering={ZoomIn.duration(duration.fast).springify().damping(18).stiffness(320).reduceMotion(ReduceMotion.System)}
      style={{
        position: 'absolute',
        top: pct(field.top),
        left: pct(field.left),
        width: pct(field.width),
        height: pct(field.height),
        borderWidth: 1.4,
        borderStyle: 'dashed',
        borderColor: tint,
        borderRadius: 5,
      }}
    >
      <View
        style={{
          position: 'absolute',
          ...(field.tagBelow ? { bottom: -19 } : { top: -19 }),
          left: -2,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 3,
          backgroundColor: tint,
          borderRadius: 4,
          paddingHorizontal: 6,
          paddingVertical: 2,
        }}
      >
        <Text style={{ fontSize: 9, fontWeight: '800', letterSpacing: 0.3, color: color.paper }}>
          {field.label}
        </Text>
        {field.warn ? (
          <TriangleAlert size={9} color={color.paper} strokeWidth={2.6} />
        ) : (
          <Check size={9} color={color.paper} strokeWidth={3.2} />
        )}
      </View>
    </Animated.View>
  );
}

export function ScanBottle({ size = 250, animate }: { size?: number; animate: boolean }) {
  const w = size;
  const h = (size * 430) / 320;

  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (alive) setReduced(v);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  /* The beam: a soft ink gradient band sweeping down the label and back. */
  const sweep = useSharedValue(0);
  useEffect(() => {
    if (!animate || reduced) return undefined;
    sweep.value = 0;
    sweep.value = withRepeat(withTiming(1, { duration: SWEEP_MS }), -1, true);
    return () => {
      cancelAnimation(sweep);
    };
  }, [animate, reduced, sweep]);
  const beamStyle = useAnimatedStyle(() => ({
    top: (BEAM_TOP_MIN + sweep.value * (BEAM_TOP_MAX - BEAM_TOP_MIN)) * h,
  }));

  /* Detected-field tags pop as the beam first passes each field. */
  const [revealed, setRevealed] = useState(0);
  useEffect(() => {
    if (!animate) return undefined;
    if (reduced) {
      setRevealed(FIELDS.length);
      return undefined;
    }
    const timers = FIELDS.map((f, i) => setTimeout(() => setRevealed(i + 1), revealAt(f.top)));
    return () => timers.forEach(clearTimeout);
  }, [animate, reduced]);

  return (
    <View
      style={{ width: w, height: h }}
      accessible
      accessibilityRole="image"
      accessibilityLabel="A prescription bottle label being read, field by field"
    >
      <Svg width={w} height={h} viewBox="0 0 320 430">
        <Defs>
          <LinearGradient id="scanBottleAmber" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={AMBER_STOPS[0]} />
            <Stop offset="0.2" stopColor={AMBER_STOPS[1]} />
            <Stop offset="0.5" stopColor={AMBER_STOPS[2]} />
            <Stop offset="0.82" stopColor={AMBER_STOPS[3]} />
            <Stop offset="1" stopColor={AMBER_STOPS[4]} />
          </LinearGradient>
          <LinearGradient id="scanBottleCap" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={CAP_STOPS[0]} />
            <Stop offset="0.3" stopColor={CAP_STOPS[1]} />
            <Stop offset="0.7" stopColor={CAP_STOPS[2]} />
            <Stop offset="1" stopColor={CAP_STOPS[3]} />
          </LinearGradient>
        </Defs>

        {/* ground shadow, cap, neck ring, amber body with a glass highlight */}
        <Ellipse cx={160} cy={410} rx={104} ry={12} fill="#000" opacity={0.08} />
        <Rect x={98} y={28} width={124} height={44} rx={9} fill="url(#scanBottleCap)" />
        <Rect x={106} y={70} width={108} height={16} fill="#C79A48" />
        <Rect x={92} y={84} width={136} height={312} rx={15} fill="url(#scanBottleAmber)" />
        <Rect x={102} y={90} width={16} height={296} rx={8} fill="#FFF" opacity={0.22} />
        <G fill="#FFFDF4" opacity={0.45}>
          <Ellipse cx={128} cy={120} rx={14} ry={8} rotation={-18} origin="128, 120" />
          <Ellipse cx={162} cy={128} rx={14} ry={8} rotation={12} origin="162, 128" />
          <Ellipse cx={192} cy={116} rx={13} ry={8} rotation={-30} origin="192, 116" />
        </G>

        {/* the white pharmacy label with its header bar */}
        <Rect x={88} y={162} width={144} height={196} rx={5} fill="#FDFDFB" />
        <Rect x={88} y={162} width={144} height={22} rx={5} fill={color.ink} />
        <SvgText x={96} y={177} fontSize={11} fontWeight="800" fill={color.paper}>
          CVS pharmacy
        </SvgText>
        <SvgText x={96} y={199} fontFamily={MONO} fontSize={7.5} fill="#666">
          RX# 8841207-06 · DR. S. CHEN
        </SvgText>
        <SvgText x={96} y={213} fontFamily={MONO} fontSize={8.5} fontWeight="700" fill="#111">
          ALVAREZ, ROBERT M
        </SvgText>
        <SvgText x={96} y={224} fontFamily={MONO} fontSize={7} fill="#555">
          DOB 02/14/1945
        </SvgText>
        <Rect x={93} y={231} width={138} height={14} fill="#F0EAD6" />
        <SvgText x={96} y={242} fontFamily={MONO} fontSize={9} fontWeight="800" fill="#111">
          METFORMIN HCL 500MG
        </SvgText>
        <SvgText x={96} y={259} fontFamily={MONO} fontSize={7.4} fill="#222">
          TAKE ONE TABLET BY MOUTH
        </SvgText>
        <SvgText x={96} y={270} fontFamily={MONO} fontSize={7.4} fill="#222">
          TWICE DAILY WITH MEALS
        </SvgText>
        <Line x1={96} y1={280} x2={224} y2={280} stroke="#E5E5E5" strokeWidth={1} />
        <SvgText x={96} y={295} fontFamily={MONO} fontSize={7.2} fill="#333">
          FILLED: 06/29/26
        </SvgText>
        <SvgText x={96} y={309} fontFamily={MONO} fontSize={7.2} fill="#333">
          DAY SUPPLY: 30
        </SvgText>

        {/* the tilted refill sticker that overlaps the day-supply line */}
        <G rotation={-4} origin="200, 318">
          <Rect
            x={176}
            y={308}
            width={56}
            height={22}
            fill="#FBF6EE"
            stroke="#C79A48"
            strokeWidth={1}
            strokeDasharray="3 2"
          />
          <SvgText x={182} y={318} fontFamily={MONO} fontSize={5.4} fill="#8A6210">
            REFILL STICKER
          </SvgText>
          <SvgText x={182} y={326} fontFamily={MONO} fontSize={5.4} fill="#8A6210">
            OVERLAP
          </SvgText>
        </G>
      </Svg>

      {animate && !reduced ? (
        <Animated.View
          pointerEvents="none"
          style={[
            { position: 'absolute', left: '-4%', right: '-4%', height: h * 0.107 },
            beamStyle,
          ]}
        >
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 1.5,
              backgroundColor: 'rgba(29,29,31,0.35)',
            }}
          />
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="scanBeamFade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color.ink} stopOpacity={0} />
                <Stop offset="0.5" stopColor={color.ink} stopOpacity={0.06} />
                <Stop offset="1" stopColor={color.ink} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#scanBeamFade)" />
          </Svg>
        </Animated.View>
      ) : null}

      {animate ? FIELDS.slice(0, revealed).map((f) => <FieldTag key={f.key} field={f} />) : null}
    </View>
  );
}
