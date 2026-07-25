/**
 * Tiny shared UI for the admin-workflow screens (app/workflows/*): the back
 * link, the static node-graph glyph on library cards, run-status metadata,
 * and small formatting helpers.
 */
import React from 'react';
import { Platform, Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import type { ExecutionStatus } from '@rua/workflows';
import { color, type, space, type StatusColor } from '../../ds';

/** Back button following the app-wide pattern; falls back to home on deep entry. */
export function BackLink({ label = 'Back' }: { label?: string }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/');
      }}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Back"
      style={{
        marginBottom: space.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        minHeight: 32,
        alignSelf: 'flex-start',
      }}
    >
      <ChevronLeft size={18} color={color.ink2} strokeWidth={1.8} />
      <Text style={type.mini}>{label}</Text>
    </Pressable>
  );
}

/** Static 24px node-graph glyph: dots and lines, the workflow's signature. */
export function WorkflowGlyph() {
  return (
    <Svg width={64} height={24} viewBox="0 0 64 24">
      <Line x1={9} y1={12} x2={26} y2={6} stroke={color.lineStrong} strokeWidth={1.2} />
      <Line x1={9} y1={12} x2={26} y2={18} stroke={color.lineStrong} strokeWidth={1.2} />
      <Line x1={26} y1={6} x2={43} y2={12} stroke={color.lineStrong} strokeWidth={1.2} />
      <Line x1={26} y1={18} x2={43} y2={12} stroke={color.lineStrong} strokeWidth={1.2} />
      <Line x1={43} y1={12} x2={57} y2={12} stroke={color.lineStrong} strokeWidth={1.2} />
      <Circle cx={9} cy={12} r={3} fill={color.ink3} />
      <Circle cx={26} cy={6} r={3} fill={color.ink3} />
      <Circle cx={26} cy={18} r={3} fill={color.ink3} />
      <Circle cx={43} cy={12} r={3} fill={color.ink} />
      <Circle cx={57} cy={12} r={2.8} fill={color.paper} stroke={color.ink} strokeWidth={1.2} />
    </Svg>
  );
}

/** Status dot color + plain-English label for a run status. */
export function runStatusMeta(status: ExecutionStatus): { dot: StatusColor; label: string } {
  switch (status) {
    case 'completed':
      return { dot: 'green', label: 'Completed' };
    case 'awaiting_confirm':
      return { dot: 'amber', label: 'Waiting on your review' };
    case 'failed':
      return { dot: 'red', label: 'Stopped' };
    case 'running':
      return { dot: 'neutral', label: 'Running' };
    case 'canceled':
      return { dot: 'neutral', label: 'Canceled' };
  }
}

/** The library card's meta line: "Insurance & benefits · about 12 min · replaces ~3.5 hrs". */
export function workflowMetaLine(w: { category: string; estMinutes: number; replacesHours: string }): string {
  return `${w.category} · about ${w.estMinutes} min · ${w.replacesHours}`;
}

/** ISO instant to its local calendar day. */
export function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

/** Monospace-ish family for document text, per platform. */
export const monoFamily = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });
