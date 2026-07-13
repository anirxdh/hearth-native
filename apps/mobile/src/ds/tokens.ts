/**
 * Ivory Editorial design tokens - the native translation of the validated
 * web MVP language: pure white, hairline rules, editorial type, black pill
 * buttons, and status color used only as small semantic dots.
 */
import { Platform, TextStyle } from 'react-native';

export const color = {
  paper: '#FFFFFF',
  ink: '#1D1D1F',
  ink2: '#6E6E73',
  ink3: '#98989D',
  line: '#E8E8ED',
  lineStrong: '#D2D2D7',
  hover: '#F5F5F7',
  red: '#C4362F',
  amber: '#9A7213',
  green: '#2F7D53',
} as const;

export type StatusColor = 'red' | 'amber' | 'green' | 'neutral';

export const statusColor = (s: StatusColor): string =>
  s === 'red' ? color.red : s === 'amber' ? color.amber : s === 'green' ? color.green : color.ink3;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

/** True hairline on every device density. */
export const hairline = Platform.select({ ios: 0.5, default: 0.75 });

const sys = Platform.select({ ios: undefined, default: 'sans-serif' });

export const type: Record<string, TextStyle> = {
  /** The big editorial greeting, e.g. "Good afternoon, Maria". */
  greet: { fontFamily: sys, fontSize: 32, fontWeight: '600', letterSpacing: -0.8, color: color.ink },
  /** Screen titles. */
  title: { fontFamily: sys, fontSize: 26, fontWeight: '600', letterSpacing: -0.5, color: color.ink },
  /** Card / row titles. */
  heading: { fontFamily: sys, fontSize: 17, fontWeight: '600', letterSpacing: -0.2, color: color.ink },
  body: { fontFamily: sys, fontSize: 15, fontWeight: '400', color: color.ink, lineHeight: 21 },
  detail: { fontFamily: sys, fontSize: 13.5, fontWeight: '400', color: color.ink2, lineHeight: 19 },
  mini: { fontFamily: sys, fontSize: 12.5, fontWeight: '400', color: color.ink3 },
  /** The uppercase section label of the .seclabel pattern. */
  label: {
    fontFamily: sys,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: color.ink3,
  },
  /** Large stat numbers. */
  stat: { fontFamily: sys, fontSize: 24, fontWeight: '600', letterSpacing: -0.4, color: color.ink },
};
