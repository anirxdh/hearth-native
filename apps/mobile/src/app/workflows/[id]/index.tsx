/**
 * The workflow preview/run card (P26), the visual port of the reference's
 * WorkflowPreviewCard: what the workflow does, who it is for, the inputs it
 * needs (grouped by node), and the single Run button. File inputs offer a
 * document picker, a sample document for trying things out, and a paste-the-
 * text fallback that feeds the extract node's Manual Text property.
 */
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Check, GitBranch, Upload } from 'lucide-react-native';
import {
  Avatar,
  Card,
  DisclaimerFootnote,
  EmptyState,
  FormField,
  ListRow,
  PillButton,
  Screen,
  SectionHeader,
  color,
  space,
  type,
} from '../../../ds';
import {
  fileVal,
  textVal,
  userInputTemplate,
  type UserInputTemplate,
  type UserInputValue,
} from '@rua/workflows';
import { getWorkflowStore } from '../../../db/workflowStore';
import { enterLead, enterQuiet, enterRow } from '../../../ds/motion';
import { listPatients } from '../../../db/repo';
import { FlowArt } from '../../../components/EmptyArt';
import { useData } from '../../../lib/useData';
import { infoDialog } from '../../../lib/dialogs';
import { confirmLoadDemoFamily } from '../../../lib/demo';
import { startRun } from '../../../lib/workflowRun';
import { BackLink, workflowMetaLine } from '../../../features/workflows/ui';

type UserInput = UserInputTemplate['userInputs'][number];
type PickedFile = { fileUrl: string; name: string };

const RUN_DISCLAIMER =
  'The run pauses at a review step where you check and can edit every value. Nothing is written until you confirm there.';

function isPatientProp(p: UserInput): boolean {
  return p.name === 'Patient' && (p.nodeType === 'Patient Record Pull' || p.nodeType === 'Record Write');
}

export default function WorkflowPreview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [patientId, setPatientId] = useState<string | null>(null);
  const [textValues, setTextValues] = useState<Record<string, string>>({});
  const [fileValues, setFileValues] = useState<Record<string, PickedFile | undefined>>({});
  const [manualText, setManualText] = useState<Record<string, string>>({});
  const [pasteOpen, setPasteOpen] = useState<Record<string, boolean>>({});
  const [running, setRunning] = useState(false);

  const data = useData(() => {
    const workflow = getWorkflowStore().getWorkflow(id);
    return { workflow, patients: listPatients() };
  });
  const workflow = data.workflow;

  if (!workflow) {
    return (
      <Screen title="Not found">
        <BackLink label="Workflows" />
        <EmptyState art={<FlowArt size={72} />} title="This workflow is not available" detail="It may have been replaced by a newer version." />
      </Screen>
    );
  }

  const template = userInputTemplate(workflow);
  const patientProps = template.userInputs.filter(isPatientProp);
  const visibleInputs = template.userInputs.filter((p) => !isPatientProp(p));
  const needsPatient = patientProps.length > 0;

  // File Input property id -> the downstream extract node's Manual Text id.
  const manualPropByFileProp: Record<string, string> = {};
  for (const n of workflow.nodes) {
    if (n.type !== 'Document Text Extract') continue;
    const docProp = n.properties.find((p) => p.name === 'Document');
    const manualProp = n.properties.find((p) => p.name === 'Manual Text');
    if (!docProp?.inputNodeId || !manualProp) continue;
    const fileNode = workflow.nodes.find((x) => x.id === docProp.inputNodeId);
    const fileProp = fileNode?.properties.find((p) => p.name === 'Value');
    if (fileNode?.type === 'File Input' && fileProp) manualPropByFileProp[fileProp.id] = manualProp.id;
  }

  // Group inputs under their node's plain-English description, in order.
  const groups: { nodeId: string; description: string; inputs: UserInput[] }[] = [];
  for (const p of visibleInputs) {
    const group = groups.find((g) => g.nodeId === p.nodeId);
    if (group) group.inputs.push(p);
    else groups.push({ nodeId: p.nodeId, description: p.nodeDescription, inputs: [p] });
  }

  const inputFilled = (p: UserInput): boolean => {
    if (p.nodeType === 'File Input') {
      if (fileValues[p.id]) return true;
      const manualId = manualPropByFileProp[p.id];
      return Boolean(manualId && (manualText[manualId] ?? '').trim());
    }
    return Boolean((textValues[p.id] ?? '').trim());
  };
  const ready = (!needsPatient || patientId !== null) && visibleInputs.every(inputFilled);

  async function pickFile(p: UserInput): Promise<void> {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    const asset = res.assets?.[0];
    if (res.canceled || !asset) return;
    setFileValues((s) => ({ ...s, [p.id]: { fileUrl: asset.uri, name: asset.name ?? 'document' } }));
  }

  async function run(): Promise<void> {
    if (!workflow || !ready || running) return;
    setRunning(true);
    try {
      const patient = data.patients.find((p) => p.id === patientId);
      const inputs: UserInputValue[] = [];
      for (const p of patientProps) {
        inputs.push({ nodePropertyId: p.id, values: [textVal(patient?.fullName ?? '')] });
      }
      for (const p of visibleInputs) {
        if (p.nodeType === 'File Input') {
          const picked = fileValues[p.id];
          const manualId = manualPropByFileProp[p.id];
          const pasted = manualId ? (manualText[manualId] ?? '').trim() : '';
          if (picked) {
            inputs.push({ nodePropertyId: p.id, values: [fileVal(picked.fileUrl, { name: picked.name })] });
          } else if (pasted) {
            inputs.push({ nodePropertyId: p.id, values: [fileVal('manual://text', { name: 'pasted text' })] });
          }
          if (manualId && pasted) {
            inputs.push({ nodePropertyId: manualId, values: [textVal(pasted)] });
          }
        } else {
          inputs.push({ nodePropertyId: p.id, values: [textVal((textValues[p.id] ?? '').trim())] });
        }
      }
      const result = await startRun(workflow.id, inputs, patientId);
      if (result.kind === 'failed') {
        infoDialog('The workflow stopped', result.error);
      } else {
        router.push(`/workflows/run/${result.executionId}` as never);
      }
    } catch (e) {
      infoDialog('The workflow could not start', e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <Screen title={workflow.name} subline={workflow.description}>
      <BackLink label="Workflows" />

      <Animated.View entering={enterLead}>
        <Text style={type.mini}>{workflowMetaLine(workflow)}</Text>
        <Pressable
          onPress={() => router.push(`/workflows/${id}/canvas` as never)}
          accessibilityRole="button"
          accessibilityLabel="View the flow"
          hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, alignSelf: 'flex-start' }}
        >
          <GitBranch size={14} color={color.ink2} strokeWidth={1.8} />
          <Text style={[type.mini, { fontWeight: '600', textDecorationLine: 'underline' }]}>View the flow</Text>
        </Pressable>
      </Animated.View>

      {/* Wrapper mounts with the screen; the demo-family flip inside does not
          re-trigger the entrance. */}
      <Animated.View entering={enterRow(1)}>
      {needsPatient ? (
        <>
          <SectionHeader label="Who this is for" />
          {data.patients.length === 0 ? (
            <View>
              <Text style={type.detail}>No one is in your circle yet.</Text>
              <Pressable
                testID="picker-load-demo"
                onPress={() => confirmLoadDemoFamily()}
                accessibilityRole="button"
                accessibilityLabel="Load the demo family"
                hitSlop={8}
                style={{ marginTop: 8, alignSelf: 'flex-start' }}
              >
                <Text style={[type.mini, { textDecorationLine: 'underline' }]}>Load the demo family</Text>
              </Pressable>
            </View>
          ) : (
            data.patients.map((p, i) => (
              <ListRow
                key={p.id}
                title={p.fullName}
                detail={p.relationship ?? undefined}
                left={<Avatar name={p.fullName} size={30} />}
                right={patientId === p.id ? <Check size={16} color={color.ink} strokeWidth={2.4} /> : null}
                onPress={() => setPatientId(p.id)}
                last={i === data.patients.length - 1}
              />
            ))
          )}
        </>
      ) : null}
      </Animated.View>

      <Animated.View entering={enterRow(2)}>
        <SectionHeader label="What it needs from you" />
      </Animated.View>
      {groups.map((g, gi) => (
        <Animated.View key={g.nodeId} entering={enterRow(gi + 3)} style={{ marginTop: space.md }}>
          <Text style={type.detail}>{g.description}</Text>
          {g.inputs.map((p) => {
            const label = p.label ?? p.name;
            if (p.nodeType !== 'File Input') {
              return (
                <FormField
                  key={p.id}
                  label={label}
                  accessibilityLabel={label}
                  value={textValues[p.id] ?? ''}
                  onChangeText={(t) => setTextValues((s) => ({ ...s, [p.id]: t }))}
                />
              );
            }
            const picked = fileValues[p.id];
            const manualId = manualPropByFileProp[p.id];
            const open = Boolean(pasteOpen[p.id]);
            return (
              <View key={p.id} style={{ marginTop: space.lg }}>
                <Text style={[type.label, { marginBottom: 6 }]}>{label}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <PillButton
                    label={picked ? 'Change document' : 'Choose a document'}
                    variant="outline"
                    size="sm"
                    icon={<Upload size={14} color={color.ink} strokeWidth={1.8} />}
                    onPress={() => {
                      pickFile(p).catch(() => {});
                    }}
                  />
                  {picked ? (
                    <Text style={[type.mini, { flex: 1 }]} numberOfLines={1}>
                      {picked.name}
                    </Text>
                  ) : null}
                </View>
                <View style={{ flexDirection: 'row', gap: 18, marginTop: 8 }}>
                  <Pressable
                    testID={`sample-doc-${p.id}`}
                    onPress={() =>
                      setFileValues((s) => ({ ...s, [p.id]: { fileUrl: 'sample://doc', name: 'sample document' } }))
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Use a sample document for ${label}`}
                    hitSlop={6}
                  >
                    <Text style={[type.mini, { textDecorationLine: 'underline' }]}>Use sample document</Text>
                  </Pressable>
                  {manualId ? (
                    <Pressable
                      onPress={() => setPasteOpen((s) => ({ ...s, [p.id]: !open }))}
                      accessibilityRole="button"
                      accessibilityLabel={open ? 'Hide the pasted text field' : 'Paste the text instead'}
                      hitSlop={6}
                    >
                      <Text style={[type.mini, { textDecorationLine: 'underline' }]}>
                        {open ? 'Hide pasted text' : 'Paste the text instead'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                {manualId && open ? (
                  <FormField
                    label="Document text"
                    accessibilityLabel={`Document text for ${label}`}
                    multiline
                    value={manualText[manualId] ?? ''}
                    onChangeText={(t) => setManualText((s) => ({ ...s, [manualId]: t }))}
                    hint="Used instead of reading the document, word for word."
                  />
                ) : null}
              </View>
            );
          })}
        </Animated.View>
      ))}

      <Animated.View entering={enterRow(Math.min(groups.length, 5) + 3)}>
        <View style={{ marginTop: space.xl, alignSelf: 'flex-start' }} testID="run-workflow">
          <PillButton label="Run workflow" onPress={() => void run()} disabled={!ready} loading={running} />
        </View>
      </Animated.View>

      <Animated.View entering={enterQuiet}>
        <DisclaimerFootnote>{RUN_DISCLAIMER}</DisclaimerFootnote>
      </Animated.View>
    </Screen>
  );
}
