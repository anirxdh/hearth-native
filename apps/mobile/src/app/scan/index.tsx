import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Check, ChevronLeft, Images } from 'lucide-react-native';
import { parseLabel } from '@hearth/label-parser';
import { addDays } from '@hearth/core';
import {
  Avatar,
  DisclaimerFootnote,
  EmptyState,
  Hairline,
  PillButton,
  Screen,
  SectionHeader,
  color,
  radius,
  space,
  type,
} from '../../ds';
import { enterLead, enterQuiet, enterRow } from '../../ds/motion';
import { LiquidGlass, liquidGlassAvailable } from '../../components/LiquidGlass';
import { ScanBottle } from '../../components/ScanBottle';
import { listPatients } from '../../db/repo';
import { useData } from '../../lib/useData';
import { infoDialog } from '../../lib/dialogs';
import { extractTextFromImage, ocrLinesFromText } from '../../lib/ocr';
import { deriveFieldSources, setPendingScan } from '../../lib/scanSession';
import { today } from '../../lib/clock';

/** '2026-07-11' -> '07/11/2026', the format printed on US labels. */
function usDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
}

/**
 * The bundled sample label: a realistic CVS-style bottle label for the
 * demo family's metformin, filled three days ago so the runway math is
 * always live. This is the App Review / demo / E2E path; it exercises
 * the exact parse -> confirm -> save pipeline a camera capture uses.
 */
function sampleLabelText(): string {
  const filled = usDate(addDays(today(), -3));
  const refillBy = usDate(addDays(today(), 150));
  const discard = usDate(addDays(today(), 365));
  return [
    'CVS PHARMACY #2213',
    '1201 MISSION ST, SAN FRANCISCO, CA',
    '(415) 555-0301',
    'RX# 482913',
    'ROBERT ALVAREZ',
    'METFORMIN HCL 500 MG TABLETS',
    'TAKE 1 TABLET BY MOUTH TWICE DAILY WITH MEALS',
    'QTY: 60',
    `DATE FILLED: ${filled}`,
    'DAYS SUPPLY: 30',
    `REFILLS: 3 BEFORE ${refillBy}`,
    'DR. PRIYA NATARAJAN',
    'NDC 00093-1048-01',
    `DISCARD AFTER ${discard}`,
  ].join('\n');
}

/** How long the illustrated scanning moment holds before confirm opens. */
const SCAN_MOMENT_MS = 1800;

/** The web MVP's .scanchip: an ink pill with a small pulsing dot. */
function ScanningChip() {
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

  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reduced) {
      pulse.value = 1;
      return undefined;
    }
    pulse.value = withRepeat(withTiming(0.35, { duration: 550 }), -1, true);
    return () => {
      cancelAnimation(pulse);
    };
  }, [reduced, pulse]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  const onGlass = liquidGlassAvailable();
  const chip = (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Scanning the label"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        backgroundColor: onGlass ? 'transparent' : color.ink,
        borderRadius: radius.pill,
        paddingHorizontal: 12,
        paddingVertical: 6,
      }}
    >
      <Animated.View
        style={[
          { width: 7, height: 7, borderRadius: 3.5, backgroundColor: color.paper },
          dotStyle,
        ]}
      />
      <Text style={[type.label, { color: color.paper, letterSpacing: 0.8 }]}>SCANNING LABEL</Text>
    </View>
  );
  if (!onGlass) return chip;
  // The same ink pill, poured in glass: the beam reads as passing under it.
  return (
    <LiquidGlass effect="clear" tint={color.ink} style={{ borderRadius: radius.pill }}>
      {chip}
    </LiquidGlass>
  );
}

export default function ScanCapture() {
  const router = useRouter();
  const patients = useData(() => listPatients());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Non-null while the illustrated scanning moment plays for the sample label. */
  const [scanText, setScanText] = useState<string | null>(null);
  const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (scanTimer.current != null) clearTimeout(scanTimer.current);
    },
    [],
  );

  const selected = patients.find((p) => p.id === selectedId) ?? patients[0];

  function proceed(text: string) {
    if (!selected) return;
    const parsed = parseLabel(ocrLinesFromText(text));
    setPendingScan({
      patientId: selected.id,
      rawText: text,
      parsed,
      sources: deriveFieldSources(text, parsed),
    });
    router.push('/scan/confirm' as never);
  }

  async function handleImage(uri: string) {
    setBusy(true);
    try {
      const text = await extractTextFromImage(uri);
      if (!text) {
        // The on-device Vision module (P21) ships with the device build;
        // until then this build reads nothing and says so honestly.
        infoDialog(
          'Could not read this label',
          'On-device label reading is not available in this build yet. Try the sample label to see the flow, or add the medication by hand.',
        );
        return;
      }
      proceed(text);
    } finally {
      setBusy(false);
    }
  }

  async function takePhoto() {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        infoDialog(
          'Camera access needed',
          'Allow camera access in Settings to photograph a label. Nothing leaves this phone.',
        );
        return;
      }
      const res = await ImagePicker.launchCameraAsync({ quality: 1 });
      if (!res.canceled && res.assets[0]) await handleImage(res.assets[0].uri);
    } catch {
      // Web and simulators may have no camera; that is not an error state.
      infoDialog(
        'Camera unavailable',
        'The camera could not be opened on this device. Choose a photo instead, or use the sample label.',
      );
    }
  }

  async function choosePhoto() {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
      });
      if (!res.canceled && res.assets[0]) await handleImage(res.assets[0].uri);
    } catch {
      infoDialog(
        'Photos unavailable',
        'The photo library could not be opened on this device. You can use the sample label to see the flow.',
      );
    }
  }

  function useSample() {
    // A test or demo can plant its own fixture on the OCR hook first; the
    // bundled sample is the default. Either way the same text flows through
    // the pipeline a native camera read would use. Unlike a real photo, the
    // sample gets the illustrated scanning moment before confirm opens.
    const g = globalThis as { __hearthOcrFixture?: unknown };
    const text = typeof g.__hearthOcrFixture === 'string' ? g.__hearthOcrFixture : sampleLabelText();
    g.__hearthOcrFixture = text;
    if (!selected) return;
    setScanText(text);
    if (scanTimer.current != null) clearTimeout(scanTimer.current);
    scanTimer.current = setTimeout(() => {
      scanTimer.current = null;
      setScanText(null);
      proceed(text);
    }, SCAN_MOMENT_MS);
  }

  if (patients.length === 0) {
    return (
      <Screen title="Scan a label">
        <Animated.View entering={enterLead}>
          <EmptyState
            title="No one to scan for yet"
            detail="Add the first person you care for, then their bottle labels are one photo away."
            action={<PillButton label="Add a person" onPress={() => router.push('/patient/new')} />}
          />
        </Animated.View>
      </Screen>
    );
  }

  if (scanText != null) {
    return (
      <Screen>
        <Animated.View entering={enterQuiet} style={{ alignItems: 'center', paddingTop: space.xl }}>
          <ScanningChip />
          <View style={{ marginTop: space.xl }}>
            <ScanBottle size={230} animate />
          </View>
          <Text style={[type.mini, { marginTop: space.xxl, textAlign: 'center' }]}>
            Read on this device. The photo never leaves your phone.
          </Text>
        </Animated.View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Back to home"
        style={{ marginBottom: space.md, flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 }}
      >
        <ChevronLeft size={18} color={color.ink2} strokeWidth={1.8} />
        <Text style={type.mini}>Home</Text>
      </Pressable>

      <Animated.View entering={enterLead}>
        <Text style={type.title} accessibilityRole="header">
          Scan a label
        </Text>
        <Text style={[type.detail, { marginTop: 6 }]}>
          Photograph the bottle label. Reading happens on this device; the photo is never uploaded.
        </Text>
      </Animated.View>

      <Animated.View entering={enterRow(1)}>
        <SectionHeader label="Whose label is this" />
      </Animated.View>
      {patients.map((p, i) => {
        const on = selected?.id === p.id;
        return (
          <Animated.View key={p.id} entering={enterRow(i + 2)}>
            <Pressable
              onPress={() => setSelectedId(p.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`Scan for ${p.fullName}`}
              style={({ pressed }) => [
                { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12 },
                pressed && { backgroundColor: color.hover },
              ]}
            >
              <Avatar name={p.fullName} size={30} />
              <Text style={[type.body, { flex: 1, fontWeight: on ? '600' : '400' }]}>
                {p.fullName}
              </Text>
              {on ? <Check size={17} color={color.ink} strokeWidth={2.2} /> : null}
            </Pressable>
            {i < patients.length - 1 ? <Hairline /> : null}
          </Animated.View>
        );
      })}

      <Animated.View entering={enterRow(patients.length + 2)}>
        <SectionHeader label="Label" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <PillButton
            label="Take a photo"
            onPress={takePhoto}
            loading={busy}
            icon={<Camera size={16} color={color.paper} strokeWidth={1.8} />}
          />
          <PillButton
            label="Choose from photos"
            variant="outline"
            onPress={choosePhoto}
            loading={busy}
            icon={<Images size={16} color={color.ink} strokeWidth={1.8} />}
          />
        </View>
        <Pressable
          onPress={useSample}
          testID="scan-sample"
          accessibilityRole="button"
          accessibilityLabel="Use sample label"
          hitSlop={8}
          style={{ marginTop: space.lg, alignSelf: 'flex-start' }}
        >
          <Text style={[type.mini, { textDecorationLine: 'underline' }]}>Use sample label</Text>
        </Pressable>
      </Animated.View>

      <Animated.View entering={enterQuiet}>
        <DisclaimerFootnote>
          Hearth reads the printed text on the label and shows you every field to confirm before
          anything is saved. Nothing is saved, and nothing leaves this phone, until you approve it.
        </DisclaimerFootnote>
      </Animated.View>
    </Screen>
  );
}
