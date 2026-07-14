import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
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
  space,
  type,
} from '../../ds';
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

export default function ScanCapture() {
  const router = useRouter();
  const patients = useData(() => listPatients());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    // the pipeline a native camera read would use.
    const g = globalThis as { __hearthOcrFixture?: unknown };
    const text = typeof g.__hearthOcrFixture === 'string' ? g.__hearthOcrFixture : sampleLabelText();
    g.__hearthOcrFixture = text;
    proceed(text);
  }

  if (patients.length === 0) {
    return (
      <Screen title="Scan a label">
        <EmptyState
          title="No one to scan for yet"
          detail="Add the first person you care for, then their bottle labels are one photo away."
          action={<PillButton label="Add a person" onPress={() => router.push('/patient/new')} />}
        />
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

      <Text style={type.title} accessibilityRole="header">
        Scan a label
      </Text>
      <Text style={[type.detail, { marginTop: 6 }]}>
        Photograph the bottle label. Reading happens on this device; the photo is never uploaded.
      </Text>

      <SectionHeader label="Whose label is this" />
      {patients.map((p, i) => {
        const on = selected?.id === p.id;
        return (
          <View key={p.id}>
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
          </View>
        );
      })}

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

      <DisclaimerFootnote>
        Hearth reads the printed text on the label and shows you every field to confirm before
        anything is saved. Nothing is saved, and nothing leaves this phone, until you approve it.
      </DisclaimerFootnote>
    </Screen>
  );
}
