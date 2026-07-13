/**
 * Ivory Editorial core components. Every screen is composed from these;
 * no screen reaches for raw colors or ad-hoc borders.
 */
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color, hairline, radius, space, statusColor, StatusColor, type } from './tokens';

/* ---------- layout ---------- */

export function Screen({
  title,
  subline,
  children,
  scroll = true,
  footer,
}: {
  title?: string;
  subline?: string;
  children: React.ReactNode;
  scroll?: boolean;
  footer?: React.ReactNode;
}) {
  const head = (title || subline) && (
    <View style={{ paddingBottom: space.lg }}>
      {title ? (
        <Text style={type.title} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      {subline ? <Text style={[type.detail, { marginTop: 6 }]}>{subline}</Text> : null}
    </View>
  );
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.screenPad}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {head}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.screenPad, { flex: 1 }]}>
          {head}
          {children}
        </View>
      )}
      {footer}
    </SafeAreaView>
  );
}

/** The .seclabel pattern: LABEL ———————— meta */
export function SectionHeader({ label, meta, top = space.xl }: { label: string; meta?: string; top?: number }) {
  return (
    <View style={[styles.secRow, { marginTop: top }]}>
      <Text style={type.label}>{label}</Text>
      <View style={styles.secLine} />
      {meta ? <Text style={type.mini}>{meta}</Text> : null}
    </View>
  );
}

export function Card({
  children,
  style,
  onPress,
  accent,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  /** Optional left accent border for "needs action" emphasis. */
  accent?: StatusColor;
}) {
  const base = [
    styles.card,
    accent ? { borderLeftWidth: 3, borderLeftColor: statusColor(accent) } : null,
    style,
  ];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [...base, pressed && { backgroundColor: color.hover }]}
      accessibilityRole="button"
    >
      {children}
    </Pressable>
  );
}

export function Hairline({ inset = 0 }: { inset?: number }) {
  return <View style={{ height: hairline, backgroundColor: color.line, marginLeft: inset }} />;
}

/* ---------- rows ---------- */

export function ListRow({
  title,
  detail,
  right,
  onPress,
  last = false,
  left,
}: {
  title: string;
  detail?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  last?: boolean;
  left?: React.ReactNode;
}) {
  const inner = (
    <>
      <View style={styles.rowInner}>
        {left ? <View style={{ marginRight: space.md }}>{left}</View> : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={type.body} numberOfLines={1}>
            {title}
          </Text>
          {detail ? (
            <Text style={[type.mini, { marginTop: 2 }]} numberOfLines={2}>
              {detail}
            </Text>
          ) : null}
        </View>
        {right ? <View style={{ marginLeft: space.md, alignItems: 'flex-end' }}>{right}</View> : null}
      </View>
      {!last && <Hairline />}
    </>
  );
  if (!onPress) return <View>{inner}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => pressed && { backgroundColor: color.hover }}
    >
      {inner}
    </Pressable>
  );
}

/* ---------- controls ---------- */

export function PillButton({
  label,
  onPress,
  variant = 'dark',
  size = 'md',
  disabled = false,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'dark' | 'outline' | 'danger';
  size?: 'sm' | 'md';
  disabled?: boolean;
  loading?: boolean;
}) {
  const dark = variant === 'dark';
  const danger = variant === 'danger';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      style={({ pressed }) => [
        styles.pill,
        size === 'sm' ? styles.pillSm : styles.pillMd,
        dark && { backgroundColor: color.ink, borderColor: color.ink },
        danger && { backgroundColor: color.paper, borderColor: color.red },
        pressed && { opacity: 0.75 },
        (disabled || loading) && { opacity: 0.35 },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={dark ? color.paper : color.ink} />
      ) : (
        <Text
          style={[
            size === 'sm' ? styles.pillTextSm : styles.pillText,
            { color: dark ? color.paper : danger ? color.red : color.ink },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function StatusDot({ status, size = 7 }: { status: StatusColor; size?: number }) {
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: statusColor(status) }}
    />
  );
}

export function StatusTag({ status, label }: { status: StatusColor; label: string }) {
  return (
    <View style={styles.statusTag}>
      <StatusDot status={status} />
      <Text style={[type.mini, { fontWeight: '600', color: statusColor(status) }]}>{label}</Text>
    </View>
  );
}

export function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1,
        borderColor: color.lineStrong,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: color.paper,
      }}
    >
      <Text style={{ fontSize: size * 0.32, fontWeight: '600', color: color.ink2 }}>{initials}</Text>
    </View>
  );
}

/** Thin runway bar: hairline track, status-colored fill. */
export function RunwayBar({ fraction, status }: { fraction: number; status: StatusColor }) {
  return (
    <View style={styles.runTrack}>
      <View
        style={{
          width: `${Math.round(Math.min(1, Math.max(0.02, fraction)) * 100)}%`,
          height: '100%',
          borderRadius: 2,
          backgroundColor: status === 'neutral' ? color.lineStrong : statusColor(status),
        }}
      />
    </View>
  );
}

/* ---------- forms ---------- */

export function FormField({
  label,
  hint,
  error,
  ...input
}: { label: string; hint?: string; error?: string } & TextInputProps) {
  return (
    <View style={{ marginTop: space.lg }}>
      <Text style={[type.label, { marginBottom: 6 }]}>{label}</Text>
      <TextInput
        placeholderTextColor={color.ink3}
        style={[styles.input, error ? { borderColor: color.red } : null, input.multiline && { height: 84, paddingTop: 10 }]}
        {...input}
      />
      {hint && !error ? <Text style={[type.mini, { marginTop: 4 }]}>{hint}</Text> : null}
      {error ? <Text style={[type.mini, { marginTop: 4, color: color.red }]}>{error}</Text> : null}
    </View>
  );
}

export function CheckRow({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={styles.checkRow}
    >
      <View style={[styles.checkbox, checked && { backgroundColor: color.ink, borderColor: color.ink }]}>
        {checked ? <Text style={{ color: color.paper, fontSize: 12, fontWeight: '700' }}>✓</Text> : null}
      </View>
      <Text style={[type.detail, { flex: 1, color: color.ink }]}>{label}</Text>
    </Pressable>
  );
}

/* ---------- states & footnotes ---------- */

export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <Text style={[type.heading, { textAlign: 'center' }]}>{title}</Text>
      {detail ? (
        <Text style={[type.detail, { textAlign: 'center', marginTop: 6 }]}>{detail}</Text>
      ) : null}
      {action ? <View style={{ marginTop: space.lg }}>{action}</View> : null}
    </View>
  );
}

/** The health-adjacent footnote used wherever numbers meet care decisions. */
export function DisclaimerFootnote({ children }: { children: string }) {
  return (
    <View style={styles.disclaimer}>
      <Text style={[type.mini, { lineHeight: 17 }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  screenPad: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: 48 },
  secRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  secLine: { flex: 1, height: hairline, backgroundColor: color.line },
  card: {
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.lg,
    padding: space.lg,
    backgroundColor: color.paper,
  },
  rowInner: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
  pill: {
    borderWidth: 1,
    borderColor: color.lineStrong,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.paper,
    alignSelf: 'flex-start',
  },
  pillMd: { paddingHorizontal: 20, height: 44, minWidth: 44 },
  pillSm: { paddingHorizontal: 14, height: 34, minWidth: 44 },
  pillText: { fontSize: 15, fontWeight: '600' },
  pillTextSm: { fontSize: 13.5, fontWeight: '600' },
  statusTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  runTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: color.line,
    overflow: 'hidden',
    width: 92,
  },
  input: {
    borderWidth: 1,
    borderColor: color.lineStrong,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 15,
    color: color.ink,
    backgroundColor: color.paper,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    marginTop: space.lg,
    paddingVertical: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: color.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  empty: { alignItems: 'center', paddingVertical: 44, paddingHorizontal: space.xl },
  disclaimer: {
    marginTop: space.xl,
    paddingTop: space.md,
    borderTopWidth: hairline,
    borderTopColor: color.line,
  },
});
