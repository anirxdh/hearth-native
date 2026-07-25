import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { color } from '../ds';

/**
 * The brand mark as a pulse: a small dotted sphere that breathes while the
 * app thinks (boot, long saves). Same Fibonacci geometry as the threshold,
 * no interaction, gentle enough to live inside any layout. It never spins
 * fast and never blinks; waiting in RUA should feel like company.
 */

const DOTS = 90;
const BREATH_SECONDS = 4.5;
const REV_SECONDS = 34;

function unitSphere(n: number) {
  const pts: { x: number; y: number; z: number }[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    pts.push({ x: Math.cos(theta) * r, y, z: Math.sin(theta) * r });
  }
  return pts;
}

export function BreathingMark({ size = 56 }: { size?: number }) {
  const base = useMemo(() => unitSphere(DOTS), []);
  const [t, setT] = useState(0);
  const raf = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const last = useRef(0);

  useEffect(() => {
    const loop = () => {
      const now = Date.now();
      if (now - last.current > 50) {
        last.current = now;
        setT(now);
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, []);

  const half = size / 2;
  const breath = Math.sin((t / (BREATH_SECONDS * 1000)) * Math.PI * 2);
  const angle = (t / (REV_SECONDS * 1000)) * Math.PI * 2;
  const R = half * (0.72 + breath * 0.05);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return (
    <View accessibilityLabel="RUA is working" accessibilityRole="progressbar">
      <Svg width={size} height={size}>
        {base.map((p, i) => {
          const rx = p.x * cos + p.z * sin;
          const rz = -p.x * sin + p.z * cos;
          const depth = (rz + 1) / 2;
          return (
            <Circle
              key={i}
              cx={half + rx * R}
              cy={half + p.y * R}
              r={0.5 + depth * 1.1}
              fill={color.ink}
              opacity={0.12 + depth * 0.55}
            />
          );
        })}
      </Svg>
    </View>
  );
}
