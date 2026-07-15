import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { color } from '../ds';

/**
 * The threshold: a dotted sphere that turns slowly, forever, until it is
 * held. Holding wakes it - the turn quickens, the dots draw inward and
 * brighten, gentle haptic pulses build under the finger, and a hairline
 * ring fills. Complete the hold and you are let in.
 *
 * Design intent: entering a space that holds someone's health should feel
 * deliberate, not incidental. A press-and-hold is a small ritual: it cannot
 * happen by accident, it takes exactly long enough to arrive (1.6s), and
 * the response under the finger is calm rather than gamified.
 *
 * Accessibility is part of the design, not an exception: Reduce Motion
 * stills the rotation (the hold still works), VoiceOver announces the
 * gesture, and the parent screen always offers a plain alternative button.
 */

const DOTS = 170;
const HOLD_MS = 1600;
const IDLE_REV_SECONDS = 26;

type Dot = { x: number; y: number; z: number };

/** Fibonacci sphere: evenly distributed points, no poles clumping. */
function unitSphere(n: number): Dot[] {
  const pts: Dot[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    pts.push({ x: Math.cos(theta) * r, y, z: Math.sin(theta) * r });
  }
  return pts;
}

export function ThresholdSphere({
  size = 260,
  onEnter,
  testID,
}: {
  size?: number;
  onEnter: () => void;
  testID?: string;
}) {
  const base = useMemo(() => unitSphere(DOTS), []);
  const [frame, setFrame] = useState({ angle: 0, hold: 0 }); // hold: 0..1
  const [reduceMotion, setReduceMotion] = useState(false);

  const holdStart = useRef<number | null>(null);
  const angleRef = useRef(0);
  const holdRef = useRef(0);
  const raf = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const lastTick = useRef(0);
  const lastPulse = useRef(-1);
  const entered = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {});
  }, []);

  useEffect(() => {
    let last = Date.now();
    const loop = () => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;

      const holding = holdStart.current !== null;
      const target = holding ? Math.min(1, (now - holdStart.current!) / HOLD_MS) : 0;
      // ease the ring: fills with the hold, drains quickly on release
      holdRef.current = holding ? target : Math.max(0, holdRef.current - dt * 2.2);

      const speed = ((2 * Math.PI) / IDLE_REV_SECONDS) * (1 + holdRef.current * 2.2);
      if (!reduceMotion) angleRef.current += speed * dt;

      // escalating pulses under the finger at 0%, 30%, 60%, 90%
      if (holding && Platform.OS !== 'web') {
        const step = Math.floor(target / 0.3);
        if (step > lastPulse.current) {
          lastPulse.current = step;
          const styles = [
            Haptics.ImpactFeedbackStyle.Light,
            Haptics.ImpactFeedbackStyle.Light,
            Haptics.ImpactFeedbackStyle.Medium,
            Haptics.ImpactFeedbackStyle.Heavy,
          ] as const;
          Haptics.impactAsync(styles[Math.min(step, 3)]!).catch(() => {});
        }
      }

      if (holding && target >= 1 && !entered.current) {
        entered.current = true;
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        onEnter();
        return; // stop the loop; the screen is transitioning
      }

      // ~30fps re-render, and only while something is visibly changing
      if (now - lastTick.current > 33) {
        lastTick.current = now;
        setFrame({ angle: angleRef.current, hold: holdRef.current });
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  const half = size / 2;
  const sphereR = half * (0.78 - frame.hold * 0.1); // contracts as the hold builds
  const cos = Math.cos(frame.angle);
  const sin = Math.sin(frame.angle);

  const ringR = half - 3;
  const ringC = 2 * Math.PI * ringR;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel="Hold to enter Hearth"
      accessibilityHint="Press and keep holding for about two seconds"
      onPressIn={() => {
        holdStart.current = Date.now();
        lastPulse.current = -1;
      }}
      onPressOut={() => {
        holdStart.current = null;
      }}
      style={{ width: size, height: size }}
    >
      <View pointerEvents="none">
        <Svg width={size} height={size}>
          {/* the filling ring: hairline, only present while held */}
          <Circle
            cx={half}
            cy={half}
            r={ringR}
            stroke={color.line}
            strokeWidth={1}
            fill="none"
            opacity={frame.hold > 0.02 ? 0.9 : 0}
          />
          <Circle
            cx={half}
            cy={half}
            r={ringR}
            stroke={color.ink}
            strokeWidth={1.4}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${ringC}`}
            strokeDashoffset={ringC * (1 - frame.hold)}
            opacity={frame.hold > 0.02 ? 1 : 0}
            transform={`rotate(-90 ${half} ${half})`}
          />
          <G>
            {base.map((p, i) => {
              // rotate around Y, project orthographically
              const rx = p.x * cos + p.z * sin;
              const rz = -p.x * sin + p.z * cos;
              const depth = (rz + 1) / 2; // 0 back, 1 front
              const wake = frame.hold;
              return (
                <Circle
                  key={i}
                  cx={half + rx * sphereR}
                  cy={half + p.y * sphereR}
                  r={0.9 + depth * (1.5 + wake * 0.5)}
                  fill={color.ink}
                  opacity={0.12 + depth * (0.55 + wake * 0.33)}
                />
              );
            })}
          </G>
        </Svg>
      </View>
    </Pressable>
  );
}
