/**
 * The run screen (P26): a vertical stepper of the workflow's nodes in
 * dependency order, the Human Confirm card when the run is paused (every
 * value editable before anything continues), the finished document when it
 * completes, and a clear retry path when it stops.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { GitBranch, Printer } from 'lucide-react-native';
import {
  Card,
  EmptyState,
  FormField,
  PillButton,
  Screen,
  SectionHeader,
  StatusDot,
  StatusTag,
  color,
  space,
  type,
} from '../../../ds';
import { jsonVal, valToText, type InterNodeVal, type NodeWithProperties } from '@hearth/workflows';
import { getWorkflowStore } from '../../../db/workflowStore';
import { getPatient } from '../../../db/repo';
import { useData } from '../../../lib/useData';
import { infoDialog } from '../../../lib/dialogs';
import {
  MANUAL_TEXT_COPY,
  confirmBundle,
  confirmRun,
  gatePrompt,
  orderNodes,
  printWorkflowOutput,
  resumeRun,
  saveWorkflowOutputToDocuments,
  sinkInfo,
} from '../../../lib/workflowRun';
import { BackLink, dayOf, monoFamily, runStatusMeta } from '../../../features/workflows/ui';

function summaryLine(values: InterNodeVal[] | undefined): string | null {
  const first = values?.[0];
  if (!first) return null;
  const text = valToText(first).split('\n')[0] ?? '';
  return text.length > 72 ? `${text.slice(0, 72)}...` : text;
}

function StepRow({
  node,
  state,
  summary,
  last,
}: {
  node: NodeWithProperties;
  state: 'done' | 'awaiting' | 'pending';
  summary: string | null;
  last: boolean;
}) {
  const dot = state === 'done' ? 'green' : state === 'awaiting' ? 'amber' : 'neutral';
  return (
    <View
      style={{ flexDirection: 'row', gap: space.md }}
      accessible
      accessibilityLabel={`${node.description}: ${state === 'done' ? 'done' : state === 'awaiting' ? 'waiting on your review' : 'not started'}`}
    >
      <View style={{ alignItems: 'center', width: 10 }}>
        <View style={{ paddingTop: 5 }}>
          <StatusDot status={dot} />
        </View>
        {!last ? <View style={{ flex: 1, width: 1, backgroundColor: color.line, marginTop: 4 }} /> : null}
      </View>
      <View style={{ flex: 1, paddingBottom: last ? 0 : space.lg }}>
        <Text style={type.body}>{node.description}</Text>
        {state === 'done' && summary ? (
          <Text style={[type.mini, { marginTop: 2 }]} numberOfLines={1}>
            {summary}
          </Text>
        ) : state === 'awaiting' ? (
          <Text style={[type.mini, { marginTop: 2, color: color.amber }]}>Waiting on your review</Text>
        ) : null}
      </View>
    </View>
  );
}

export default function WorkflowRun() {
  const { executionId } = useLocalSearchParams<{ executionId: string }>();
  const router = useRouter();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [editsForGate, setEditsForGate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedToVault, setSavedToVault] = useState(false);

  const data = useData(() => {
    const store = getWorkflowStore();
    const execution = store.getExecution(executionId);
    if (!execution) return null;
    const workflow = store.getWorkflow(execution.workflowId);
    if (!workflow) return null;
    return {
      execution,
      workflow,
      outputs: store.getNodeOutputs(executionId),
      inputs: store.getExecutionInputs(executionId),
      patient: execution.patientId ? getPatient(execution.patientId) : undefined,
    };
  });

  const gateId = data?.execution.awaitingNodeId ?? null;

  // Seed the editable confirm rows once per pause (edits survive re-renders).
  useEffect(() => {
    if (!data || !gateId || editsForGate === gateId) return;
    const bundle = confirmBundle(data.workflow, gateId, data.outputs, data.inputs);
    setEdits(
      Object.fromEntries(
        Object.entries(bundle).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]),
      ),
    );
    setEditsForGate(gateId);
  }, [data, gateId, editsForGate]);

  if (!data) {
    return (
      <Screen title="Not found">
        <BackLink label="Workflows" />
        <EmptyState title="This run is not available" detail="It may belong to a workflow that was removed." />
      </Screen>
    );
  }

  const { execution, workflow, outputs, patient } = data;
  const ordered = orderNodes(workflow);
  const sink = sinkInfo(workflow);
  const status = runStatusMeta(execution.status);
  const finalValues = outputs.get(sink.node.id);
  const finalText = finalValues?.[0] ? valToText(finalValues[0]) : '';
  const hasExtractHint =
    execution.status === 'failed' &&
    Boolean(execution.error?.includes('could not produce a value')) &&
    workflow.nodes.some((n) => n.type === 'Document Text Extract');

  async function onConfirm(): Promise<void> {
    if (!gateId || busy) return;
    setBusy(true);
    try {
      const result = await confirmRun(executionId, gateId, [jsonVal(edits)]);
      setEditsForGate(null);
      if (result.kind === 'failed') infoDialog('The workflow stopped', result.error);
    } catch (e) {
      infoDialog('Could not continue', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onRetry(): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      await resumeRun(executionId);
    } catch (e) {
      infoDialog('Could not retry', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onSaveToVault(): Promise<void> {
    if (!execution.patientId || !patient) return;
    try {
      const saved = await saveWorkflowOutputToDocuments(execution.patientId, sink.title, finalText);
      if (saved) {
        setSavedToVault(true);
        infoDialog('Saved', `Added to ${patient.fullName}’s documents.`);
      } else {
        infoDialog('Not available here', 'Saving to documents works on the phone, not on the web preview.');
      }
    } catch (e) {
      infoDialog('Could not save', e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Screen title={workflow.name} subline={`Started ${dayOf(execution.startedAt)}${patient ? ` · for ${patient.fullName}` : ''}`}>
      <BackLink label="Workflows" />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <StatusTag status={status.dot} label={status.label} />
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => router.push(`/workflows/${workflow.id}/canvas?executionId=${execution.id}` as never)}
          accessibilityRole="button"
          accessibilityLabel="View this run on the flow"
          hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <GitBranch size={14} color={color.ink2} strokeWidth={1.8} />
          <Text style={[type.mini, { fontWeight: '600', textDecorationLine: 'underline' }]}>View the flow</Text>
        </Pressable>
      </View>

      <SectionHeader label="Steps" />
      {ordered.map((n, i) => (
        <StepRow
          key={n.id}
          node={n}
          state={outputs.has(n.id) ? 'done' : execution.awaitingNodeId === n.id ? 'awaiting' : 'pending'}
          summary={summaryLine(outputs.get(n.id))}
          last={i === ordered.length - 1}
        />
      ))}

      {execution.status === 'awaiting_confirm' && gateId ? (
        <>
          <SectionHeader label="Review and confirm" />
          <Card accent="amber">
            <Text style={type.detail}>{gatePrompt(workflow, gateId)}</Text>
            {Object.entries(edits).map(([key, value]) => (
              <FormField
                key={key}
                label={key}
                accessibilityLabel={key}
                testID={`confirm-field-${key}`}
                value={value}
                onChangeText={(t) => setEdits((s) => ({ ...s, [key]: t }))}
                multiline={value.length > 60 || value.includes('\n')}
              />
            ))}
            <View style={{ marginTop: space.xl, alignSelf: 'flex-start' }} testID="confirm-continue">
              <PillButton label="Confirm and continue" onPress={() => void onConfirm()} loading={busy} />
            </View>
          </Card>
        </>
      ) : null}

      {execution.status === 'completed' && sink.kind === 'record' ? (
        <>
          <SectionHeader label="Done" />
          <Card accent="green">
            <StatusTag status="green" label="Saved" />
            <Text testID="workflow-saved" style={[type.body, { marginTop: 8 }]}>
              {patient ? `Saved to ${patient.fullName}’s record.` : 'Saved to the record.'}
            </Text>
            {patient ? (
              <View style={{ marginTop: space.lg, alignSelf: 'flex-start' }}>
                <PillButton
                  label="Open the record"
                  variant="outline"
                  size="sm"
                  onPress={() => router.push(`/patient/${patient.id}` as never)}
                />
              </View>
            ) : null}
          </Card>
        </>
      ) : null}

      {execution.status === 'completed' && sink.kind === 'document' ? (
        <>
          <SectionHeader label="The finished document" meta={sink.title} />
          <Card>
            <Text
              testID="workflow-output"
              selectable
              style={[type.body, { fontFamily: monoFamily, fontSize: 12.5, lineHeight: 19 }]}
            >
              {finalText}
            </Text>
          </Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: space.lg }}>
            <PillButton
              label="Print or save PDF"
              icon={<Printer size={16} color={color.paper} strokeWidth={1.8} />}
              onPress={() => {
                printWorkflowOutput(sink.title, finalText, execution.patientId).catch((e) =>
                  infoDialog('Could not print', e instanceof Error ? e.message : String(e)),
                );
              }}
            />
            {patient ? (
              <PillButton
                label={savedToVault ? 'Saved to documents' : 'Save to documents'}
                variant="outline"
                disabled={savedToVault}
                onPress={() => void onSaveToVault()}
              />
            ) : null}
          </View>
        </>
      ) : null}

      {execution.status === 'failed' ? (
        <>
          <SectionHeader label="What happened" />
          <Card accent="red">
            <StatusTag status="red" label="Stopped" />
            <Text style={[type.detail, { marginTop: 8 }]}>{execution.error ?? 'Something went wrong.'}</Text>
            {hasExtractHint ? <Text style={[type.mini, { marginTop: 6 }]}>{MANUAL_TEXT_COPY}</Text> : null}
            <View style={{ marginTop: space.lg, alignSelf: 'flex-start' }}>
              <PillButton label="Try again" onPress={() => void onRetry()} loading={busy} />
            </View>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
