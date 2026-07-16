/**
 * The workflow library (P28): every bundled paperwork automation as a card,
 * with the caregiver's most recent runs underneath.
 */
import React from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Card,
  DisclaimerFootnote,
  ListRow,
  Screen,
  SectionHeader,
  StatusDot,
  space,
  type,
} from '../../ds';
import { getWorkflowStore, listLatestWorkflows } from '../../db/workflowStore';
import { useData } from '../../lib/useData';
import { BackLink, WorkflowGlyph, dayOf, runStatusMeta, workflowMetaLine } from '../../features/workflows/ui';

const WORKFLOWS_DISCLAIMER =
  'Workflows assemble paperwork from what you enter and confirm. Nothing is written or saved until you review every value. This is organizational help, not legal or medical advice.';

export default function WorkflowLibrary() {
  const router = useRouter();
  const data = useData(() => {
    const workflows = listLatestWorkflows();
    const store = getWorkflowStore();
    const nameById = new Map(store.listWorkflows().map((w) => [w.id, w.name]));
    const runs = store
      .listExecutions()
      .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
      .slice(0, 5)
      .map((e) => ({ ...e, workflowName: nameById.get(e.workflowId) ?? 'Workflow' }));
    return { workflows, runs };
  });

  return (
    <Screen
      title="Workflows"
      subline="Hours of paperwork, reduced to the minutes it takes you to check the facts."
    >
      <BackLink label="Home" />

      <SectionHeader label="Paperwork, automated" meta={`${data.workflows.length} available`} top={space.md} />
      {/* One column on phones; cards wrap into two columns once the readable
          measure offers room for a pair of 300pt cards (about 680 and up). */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.md }}>
        {data.workflows.map((w) => (
          <Card
            key={w.id}
            onPress={() => router.push(`/workflows/${w.id}` as never)}
            style={{ flexGrow: 1, flexShrink: 1, flexBasis: 300 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Text style={[type.heading, { flex: 1 }]}>{w.name}</Text>
              <WorkflowGlyph />
            </View>
            <Text style={[type.detail, { marginTop: 6 }]}>{w.description}</Text>
            <Text style={[type.mini, { marginTop: 10 }]}>{workflowMetaLine(w)}</Text>
          </Card>
        ))}
      </View>

      <SectionHeader label="Past runs" meta={data.runs.length > 0 ? `newest ${data.runs.length}` : undefined} />
      {data.runs.length === 0 ? (
        <Text style={[type.detail, { marginTop: 2 }]}>
          Runs will appear here after you start one.
        </Text>
      ) : (
        data.runs.map((run, i) => {
          const meta = runStatusMeta(run.status);
          return (
            <ListRow
              key={run.id}
              title={run.workflowName}
              detail={`${meta.label} · ${dayOf(run.startedAt)}`}
              left={<StatusDot status={meta.dot} />}
              onPress={() => router.push(`/workflows/run/${run.id}` as never)}
              last={i === data.runs.length - 1}
            />
          );
        })
      )}

      <DisclaimerFootnote>{WORKFLOWS_DISCLAIMER}</DisclaimerFootnote>
    </Screen>
  );
}
