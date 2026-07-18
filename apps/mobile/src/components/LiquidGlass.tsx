import React from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * iOS 26 Liquid Glass, safely. On devices that have it, this renders the
 * real refractive material (expo-glass-effect); everywhere else it falls
 * back to a quiet translucent paper so layouts never depend on the OS.
 *
 * House rules for glass, v2: glass lives on what the finger TOUCHES or
 * what FLOATS above the page - the orb's hold highlight, docks, sheets,
 * segmented controls, progress capsules, paging dots. Editorial reading
 * surfaces (records, one-pagers, guides) stay paper. `interactive`
 * turns on the OS's own touch-responsive shimmer; LiquidGlassRow lets
 * nearby glass shapes melt into each other as they approach.
 *
 * Hard-won on-device rules (iOS 26.3 simulator):
 * - NEVER give the glass's wrapper a reanimated `entering` animation:
 *   the layout-animation snapshot keeps the material from compositing,
 *   permanently - the view renders fully transparent (home dock bug).
 * - GlassContainer (LiquidGlassRow) did not composite GlassView children
 *   at all in this setup; prefer standalone GlassViews until a newer
 *   expo-glass-effect proves the merge effect on-device.
 */

type GlassProps = {
  style?: StyleProp<ViewStyle>;
  /** 'clear' refracts more; 'regular' is the standard material. */
  effect?: 'clear' | 'regular';
  /** The OS's touch-responsive glass shimmer. Only for pressable surfaces. */
  interactive?: boolean;
  /** Optional tint washed through the material. */
  tint?: string;
  children?: React.ReactNode;
  pointerEvents?: 'none' | 'auto' | 'box-none';
};

let glass: {
  GlassView: React.ComponentType<Record<string, unknown>>;
  GlassContainer: React.ComponentType<Record<string, unknown>>;
  available: boolean;
} | null = null;

function loadGlass() {
  if (glass) return glass;
  if (Platform.OS !== 'ios') {
    glass = { GlassView: View as never, GlassContainer: View as never, available: false };
    return glass;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('expo-glass-effect') as {
      GlassView: React.ComponentType<Record<string, unknown>>;
      GlassContainer: React.ComponentType<Record<string, unknown>>;
      isLiquidGlassAvailable: () => boolean;
      isGlassEffectAPIAvailable?: () => boolean;
    };
    // Some iOS 26 betas ship without the API; the extra guard avoids crashes.
    const apiOk = mod.isGlassEffectAPIAvailable ? mod.isGlassEffectAPIAvailable() : true;
    glass = {
      GlassView: mod.GlassView,
      GlassContainer: mod.GlassContainer,
      available: apiOk && mod.isLiquidGlassAvailable(),
    };
  } catch {
    glass = { GlassView: View as never, GlassContainer: View as never, available: false };
  }
  return glass;
}

export function LiquidGlass({
  style,
  effect = 'regular',
  interactive = false,
  tint,
  children,
  pointerEvents,
}: GlassProps) {
  const g = loadGlass();
  if (g.available) {
    const GV = g.GlassView;
    return (
      <GV
        glassEffectStyle={effect}
        isInteractive={interactive}
        {...(tint ? { tintColor: tint } : {})}
        style={style}
        pointerEvents={pointerEvents}
      >
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

/**
 * A group whose glass children visually merge when they come within
 * `spacing` points of each other - the liquid part of Liquid Glass.
 * Off-glass platforms get a plain row; children handle their own
 * fallback surfaces.
 */
export function LiquidGlassRow({
  style,
  spacing = 24,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  spacing?: number;
  children?: React.ReactNode;
}) {
  const g = loadGlass();
  if (g.available) {
    const GC = g.GlassContainer;
    return (
      <GC spacing={spacing} style={style}>
        {children}
      </GC>
    );
  }
  return <View style={style}>{children}</View>;
}

export function liquidGlassAvailable(): boolean {
  return loadGlass().available;
}
