import React from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * iOS 26 Liquid Glass, safely. On devices that have it, this renders the
 * real refractive material (expo-glass-effect); everywhere else it falls
 * back to a quiet translucent paper so layouts never depend on the OS.
 *
 * House rule for glass: it appears only on OVERLAY moments (the orb's
 * hold highlight, the canvas inspector sheet, the app lock) - editorial
 * content stays paper. Glass is a material here, not a theme.
 */

type GlassProps = {
  style?: StyleProp<ViewStyle>;
  /** 'clear' refracts more; 'regular' is the standard material. */
  effect?: 'clear' | 'regular';
  children?: React.ReactNode;
  pointerEvents?: 'none' | 'auto' | 'box-none';
};

let glass: {
  GlassView: React.ComponentType<Record<string, unknown>>;
  available: boolean;
} | null = null;

function loadGlass() {
  if (glass) return glass;
  if (Platform.OS !== 'ios') {
    glass = { GlassView: View as never, available: false };
    return glass;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('expo-glass-effect') as {
      GlassView: React.ComponentType<Record<string, unknown>>;
      isLiquidGlassAvailable: () => boolean;
    };
    glass = { GlassView: mod.GlassView, available: mod.isLiquidGlassAvailable() };
  } catch {
    glass = { GlassView: View as never, available: false };
  }
  return glass;
}

export function LiquidGlass({ style, effect = 'regular', children, pointerEvents }: GlassProps) {
  const g = loadGlass();
  if (g.available) {
    const GV = g.GlassView;
    return (
      <GV glassEffectStyle={effect} style={style} pointerEvents={pointerEvents}>
        {children}
      </GV>
    );
  }
  return (
    <View
      style={[{ backgroundColor: 'rgba(255,255,255,0.82)' }, style]}
      pointerEvents={pointerEvents}
    >
      {children}
    </View>
  );
}

export function liquidGlassAvailable(): boolean {
  return loadGlass().available;
}
