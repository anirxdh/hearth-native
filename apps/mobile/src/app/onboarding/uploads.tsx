import React, { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import type { DocumentRow } from '@rua/schema';
import { Card, PillButton, Screen, StatusDot, space, type } from '../../ds';
import { enterLead, enterQuiet, enterRow } from '../../ds/motion';
import { addDocument, getPatient } from '../../db/repo';
import { importDocumentFile, importDocumentPhoto } from '../../lib/vault';
import { infoDialog } from '../../lib/dialogs';
import { OnboardingSteps } from './ui';

/**
 * Step 4: bring the paper along. On the phone both cards go through the
 * documents vault (lib/vault.ts), which copies the bytes into the app
 * sandbox before writing the row. The browser preview has no sandbox
 * filesystem (expo-file-system legacy is native-only), so on web the same
 * pickers run and only the row is recorded; the web DB is a per-tab test
 * surface, never real storage.
 */
export default function OnboardingUploads() {
  const router = useRouter();
  const { patientId } = useLocalSearchParams<{ patientId?: string }>();
  const patient = patientId ? getPatient(patientId) : undefined;
  const [insuranceDoc, setInsuranceDoc] = useState<DocumentRow | null>(null);
  const [recordsDoc, setRecordsDoc] = useState<DocumentRow | null>(null);
  const [busy, setBusy] = useState(false);

  function next() {
    router.push(
      (patient ? `/onboarding/wearables?patientId=${patient.id}` : '/onboarding/wearables') as never,
    );
  }

  async function pickInsurance() {
    if (!patient) return;
    setBusy(true);
    try {
      if (Platform.OS === 'web') {
        const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
        const asset = res.assets?.[0];
        if (!res.canceled && asset) {
          setInsuranceDoc(
            addDocument({
              patientId: patient.id,
              title: 'Insurance card',
              category: 'insurance',
              fileName: asset.fileName ?? 'insurance-card',
              mimeType: asset.mimeType ?? 'image/jpeg',
            }),
          );
        }
      } else {
        const doc = await importDocumentPhoto(patient.id, 'Insurance card', 'insurance');
        if (doc) setInsuranceDoc(doc);
      }
    } catch (e) {
      infoDialog('Could not add the document', String(e));
    } finally {
      setBusy(false);
    }
  }

  async function pickRecords() {
    if (!patient) return;
    setBusy(true);
    try {
      if (Platform.OS === 'web') {
        const res = await DocumentPicker.getDocumentAsync({
          type: ['application/pdf', 'image/*'],
          multiple: false,
          copyToCacheDirectory: true,
        });
        const asset = res.assets?.[0];
        if (!res.canceled && asset) {
          setRecordsDoc(
            addDocument({
              patientId: patient.id,
              title: asset.name || 'Medication records',
              category: 'other',
              fileName: asset.name || 'records',
              mimeType: asset.mimeType ?? 'application/pdf',
            }),
          );
        }
      } else {
        // Title '' lets the vault fall back to the picked file's own name.
        const doc = await importDocumentFile(patient.id, '', 'other');
        if (doc) setRecordsDoc(doc);
      }
    } catch (e) {
      infoDialog('Could not add the document', String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!patient) {
    return (
      <Screen
        title="Bring the paper along"
        subline="Insurance cards, medication lists, discharge papers: photographed once, at hand at every visit."
      >
        <OnboardingSteps step={3} />
        <Animated.View entering={enterLead}>
          <Card>
            <Text style={type.detail}>
              Documents attach to a person's record, and you have not added anyone yet. You can add papers
              any time from a person's Documents tab.
            </Text>
          </Card>
        </Animated.View>
        <Animated.View entering={enterRow(1)}>
          <View style={{ marginTop: space.xl }} testID="ob-continue-uploads">
            <PillButton label="Continue" onPress={next} />
          </View>
        </Animated.View>
      </Screen>
    );
  }

  const name = patient.preferredName ?? patient.fullName.split(/\s+/)[0]!;

  return (
    <Screen
      title="Bring the paper along"
      subline={`The papers that follow ${name} everywhere can live here instead: stored only on this phone.`}
    >
      <OnboardingSteps step={3} />

      <Animated.View entering={enterLead}>
        <Card>
          <Text style={type.heading}>Insurance card</Text>
          <Text style={[type.detail, { marginTop: 6 }]}>
            A photo of the card, front is enough. It is there when the front desk asks.
          </Text>
          {insuranceDoc ? (
            <View
              testID="ob-insurance-done"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: space.lg }}
            >
              <StatusDot status="green" />
              <Text style={type.mini}>{insuranceDoc.fileName}</Text>
            </View>
          ) : (
            <View style={{ marginTop: space.lg }} testID="ob-upload-insurance">
              <PillButton
                label="Add the card"
                variant="outline"
                size="sm"
                onPress={() => void pickInsurance()}
                disabled={busy}
              />
            </View>
          )}
        </Card>
      </Animated.View>

      <Animated.View entering={enterRow(1)}>
        <Card style={{ marginTop: space.md }}>
          <Text style={type.heading}>Medication list or records</Text>
          <Text style={[type.detail, { marginTop: 6 }]}>
            A pharmacy printout, a discharge summary, or any PDF or photo worth keeping close.
          </Text>
          {recordsDoc ? (
            <View
              testID="ob-records-done"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: space.lg }}
            >
              <StatusDot status="green" />
              <Text style={type.mini}>{recordsDoc.fileName}</Text>
            </View>
          ) : (
            <View style={{ marginTop: space.lg }} testID="ob-upload-records">
              <PillButton
                label="Add a file"
                variant="outline"
                size="sm"
                onPress={() => void pickRecords()}
                disabled={busy}
              />
            </View>
          )}
        </Card>
      </Animated.View>

      <Animated.View entering={enterRow(2)}>
        <View style={{ marginTop: space.xl }} testID="ob-continue-uploads">
          <PillButton label="Continue" onPress={next} />
        </View>
      </Animated.View>
      <Animated.View entering={enterQuiet}>
        <Text style={[type.mini, { marginTop: space.lg }]}>
          Both are optional. Everything lands in {name}'s Documents tab, protected by this phone's passcode.
        </Text>
      </Animated.View>
    </Screen>
  );
}
