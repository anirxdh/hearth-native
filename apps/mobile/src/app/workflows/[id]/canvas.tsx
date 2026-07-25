/**
 * The workflow canvas (P27), the visual port of the nonlinear reference:
 * nodes as rounded-rect cards laid out from their stored positions, a row per
 * visible property with an input-handle dot (filled when wired), bezier edges
 * from a source's right edge into the target property row, pan and pinch to
 * move around, and, when an executionId is passed, per-node status dots plus
 * "View data" chips on edges that already carry values.
 */
import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { useLocalSearchParams } from 'expo-router';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { X } from 'lucide-react-native';
import { Card, EmptyState, Screen, color, radius, space, statusColor, type } from '../../../ds';
import { enterLead } from '../../../ds/motion';
import { valToText, type InterNodeVal, type NodeWithProperties } from '@rua/workflows';
import { getWorkflowStore } from '../../../db/workflowStore';
import { LiquidGlass } from '../../../components/LiquidGlass';
import { useData } from '../../../lib/useData';
import { BackLink, monoFamily } from '../../../features/workflows/ui';

const NODE_W = 190;
const HEADER_H = 38;
const ROW_H = 18;
const PAD = 40;

function visibleProps(n: NodeWithProperties) {
  return n.properties.filter((p) => !p.hidden);
}

function nodeHeight(n: NodeWithProperties): number {
  return HEADER_H + visibleProps(n).length * ROW_H + 8;
}

function rowCenterAt(y: number, rowIndex: number): number {
  return y + HEADER_H + rowIndex * ROW_H + ROW_H / 2;
}

/** Sources-first order via Kahn's algorithm over inputNodeId edges. */
function topoOrder(nodes: NodeWithProperties[]): NodeWithProperties[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const outgoing = new Map<string, string[]>();
  const indegree = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  for (const n of nodes) {
    for (const p of n.properties) {
      if (p.inputNodeId && byId.has(p.inputNodeId)) {
        outgoing.set(p.inputNodeId, [...(outgoing.get(p.inputNodeId) ?? []), n.id]);
        indegree.set(n.id, (indegree.get(n.id) ?? 0) + 1);
      }
    }
  }
  const queue = nodes.filter((n) => (indegree.get(n.id) ?? 0) === 0);
  const out: NodeWithProperties[] = [];
  while (queue.length > 0) {
    const n = queue.shift()!;
    out.push(n);
    for (const t of outgoing.get(n.id) ?? []) {
      indegree.set(t, indegree.get(t)! - 1);
      if (indegree.get(t) === 0) queue.push(byId.get(t)!);
    }
  }
  return out.length === nodes.length ? out : nodes; // cycles: fall back to stored order
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}...` : s;
}

type Edge = {
  key: string;
  source: NodeWithProperties;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  /** Vertical mode: how far the edge bows into the left gutter. */
  bow: number;
};

type Sheet = { node: NodeWithProperties; values: InterNodeVal[] };

export default function WorkflowCanvas() {
  const { id, executionId } = useLocalSearchParams<{ id: string; executionId?: string }>();
  const { width: windowW } = useWindowDimensions();
  const [sheet, setSheet] = useState<Sheet | null>(null);

  const data = useData(() => {
    const store = getWorkflowStore();
    const workflow = store.getWorkflow(id);
    const execution = executionId ? store.getExecution(executionId) : undefined;
    const outputs = executionId ? store.getNodeOutputs(executionId) : undefined;
    return { workflow, execution, outputs };
  });
  const workflow = data.workflow;

  const layout = useMemo(() => {
    if (!workflow) return null;
    const viewportW = Math.max(240, Math.min(windowW - space.xl * 2, 720));
    // Phones get a vertical re-layout: one readable column in topological
    // order, edges flowing down a left gutter. Stored positions are the
    // desktop shape; a DAG drawn 1300 wide is unreadable at 0.27 scale.
    const vertical = viewportW < 600;
    const gutter = 34;
    const nodeW = vertical ? Math.min(420, viewportW - gutter - 24) : NODE_W;

    const pos = new Map<string, { x: number; y: number }>();
    if (vertical) {
      let y = PAD / 2;
      for (const n of topoOrder(workflow.nodes)) {
        pos.set(n.id, { x: gutter, y });
        y += nodeHeight(n) + 30;
      }
    } else {
      for (const n of workflow.nodes) pos.set(n.id, n.position);
    }

    let maxX = 0;
    let maxY = 0;
    for (const n of workflow.nodes) {
      const p = pos.get(n.id)!;
      maxX = Math.max(maxX, p.x + nodeW);
      maxY = Math.max(maxY, p.y + nodeHeight(n));
    }
    const contentW = maxX + (vertical ? 12 : PAD);
    const contentH = maxY + PAD / 2;

    const byId = new Map(workflow.nodes.map((n) => [n.id, n]));
    const edges: Edge[] = [];
    let bow = 0;
    for (const target of workflow.nodes) {
      const tp = pos.get(target.id)!;
      const props = visibleProps(target);
      props.forEach((p, rowIndex) => {
        if (!p.inputNodeId) return;
        const source = byId.get(p.inputNodeId);
        if (!source) return;
        const sp = pos.get(source.id)!;
        edges.push(
          vertical
            ? {
                key: `${source.id}->${p.id}`,
                source,
                sx: sp.x,
                sy: sp.y + nodeHeight(source) / 2,
                tx: tp.x,
                ty: rowCenterAt(tp.y, rowIndex),
                bow: 20 + (bow++ % 3) * 7,
              }
            : {
                key: `${source.id}->${p.id}`,
                source,
                sx: sp.x + nodeW,
                sy: sp.y + nodeHeight(source) / 2,
                tx: tp.x,
                ty: rowCenterAt(tp.y, rowIndex),
                bow: 0,
              },
        );
      });
    }
    return { contentW, contentH, edges, pos, nodeW, vertical };
  }, [workflow, windowW]);

  const initialView = useMemo(() => {
    if (!layout) return { tx: 0, ty: 0, scale: 1 };
    if (layout.vertical) return { tx: 0, ty: 0, scale: 1 }; // fits by construction
    const viewportW = Math.max(240, Math.min(windowW - space.xl * 2, 720));
    const scale = Math.min(1, viewportW / layout.contentW);
    return {
      tx: -(layout.contentW / 2) * (1 - scale),
      ty: -(layout.contentH / 2) * (1 - scale),
      scale,
    };
  }, [layout, windowW]);

  const [view, setView] = useState(initialView);
  const viewRef = useRef(view);
  const baseRef = useRef(view);
  const apply = (next: { tx: number; ty: number; scale: number }) => {
    viewRef.current = next;
    setView(next);
  };

  const pan = Gesture.Pan()
    .minDistance(4)
    .runOnJS(true)
    .onStart(() => {
      baseRef.current = viewRef.current;
    })
    .onUpdate((e) => {
      apply({
        ...viewRef.current,
        tx: baseRef.current.tx + e.translationX,
        ty: baseRef.current.ty + e.translationY,
      });
    });
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => {
      baseRef.current = viewRef.current;
    })
    .onUpdate((e) => {
      const scale = Math.min(2.5, Math.max(0.25, baseRef.current.scale * e.scale));
      apply({ ...viewRef.current, scale });
    });
  const gestures = Gesture.Simultaneous(pan, pinch);

  if (!workflow || !layout) {
    return (
      <Screen title="Not found">
        <BackLink label="Back" />
        <EmptyState title="This workflow is not available" />
      </Screen>
    );
  }

  const outputs = data.outputs;
  const awaitingNodeId = data.execution?.awaitingNodeId ?? null;
  const nodeState = (n: NodeWithProperties): 'done' | 'awaiting' | 'pending' | null => {
    if (!outputs) return null;
    if (outputs.has(n.id)) return 'done';
    if (awaitingNodeId === n.id) return 'awaiting';
    return 'pending';
  };

  return (
    <Screen scroll={false}>
      <BackLink label="Back" />
      {/* Entrance on the header and hint only; the gesture surface below
          stays still so touch targets never move under a finger. */}
      <Animated.View entering={enterLead}>
        <Text style={type.title} accessibilityRole="header">
          {workflow.name}
        </Text>
        <Text style={[type.mini, { marginTop: 4 }]}>
          The flow behind this workflow. Drag to move, pinch to zoom.
        </Text>
      </Animated.View>

      <GestureHandlerRootView style={{ flex: 1, marginTop: space.md }}>
        <GestureDetector gesture={gestures}>
          <View
            style={{
              flex: 1,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: color.line,
              borderRadius: radius.lg,
              backgroundColor: color.paper,
            }}
            collapsable={false}
            accessible
            accessibilityLabel={`Flow diagram for ${workflow.name} with ${workflow.nodes.length} steps`}
          >
            <View
              style={{
                position: 'absolute',
                width: layout.contentW,
                height: layout.contentH,
                transform: [{ translateX: view.tx }, { translateY: view.ty }, { scale: view.scale }],
              }}
            >
              <Svg width={layout.contentW} height={layout.contentH}>
                {layout.edges.map((e) => (
                  <Path
                    key={e.key}
                    d={
                      layout.vertical
                        ? `M ${e.sx} ${e.sy} C ${e.sx - e.bow} ${e.sy} ${e.tx - e.bow} ${e.ty} ${e.tx} ${e.ty}`
                        : `M ${e.sx} ${e.sy} C ${e.sx + 56} ${e.sy} ${e.tx - 56} ${e.ty} ${e.tx} ${e.ty}`
                    }
                    stroke={color.lineStrong}
                    strokeWidth={1.2}
                    fill="none"
                  />
                ))}
                {workflow.nodes.map((n) => {
                  const dp = layout.pos.get(n.id)!;
                  const x = dp.x;
                  const y = dp.y;
                  const h = nodeHeight(n);
                  const cw = layout.nodeW;
                  const state = nodeState(n);
                  return (
                    <G key={n.id}>
                      <Rect
                        x={x}
                        y={y}
                        width={cw}
                        height={h}
                        rx={10}
                        fill={color.paper}
                        stroke={color.lineStrong}
                        strokeWidth={1}
                      />
                      <SvgText x={x + 12} y={y + 17} fontSize={11} fontWeight="600" fill={color.ink}>
                        {truncate(n.description, Math.floor(cw / 7) - (state ? 3 : 0))}
                      </SvgText>
                      <SvgText x={x + 12} y={y + 30} fontSize={8} letterSpacing={0.8} fill={color.ink3}>
                        {n.type.toUpperCase()}
                      </SvgText>
                      <Line
                        x1={x}
                        y1={y + HEADER_H}
                        x2={x + cw}
                        y2={y + HEADER_H}
                        stroke={color.line}
                        strokeWidth={1}
                      />
                      {visibleProps(n).map((p, rowIndex) => {
                        const cy = rowCenterAt(y, rowIndex);
                        const wired = Boolean(p.inputNodeId);
                        return (
                          <G key={p.id}>
                            <Circle
                              cx={x}
                              cy={cy}
                              r={3.5}
                              fill={wired ? color.ink : color.paper}
                              stroke={wired ? color.ink : color.lineStrong}
                              strokeWidth={1.2}
                            />
                            <SvgText x={x + 12} y={cy + 3} fontSize={9} fill={color.ink2}>
                              {truncate(p.label ?? p.name, Math.floor(cw / 5.4))}
                            </SvgText>
                          </G>
                        );
                      })}
                      {state ? (
                        <Circle
                          cx={x + cw - 13}
                          cy={y + 13}
                          r={4}
                          fill={state === 'done' ? statusColor('green') : state === 'awaiting' ? statusColor('amber') : statusColor('neutral')}
                        />
                      ) : null}
                    </G>
                  );
                })}
              </Svg>

              {outputs
                ? layout.edges
                    .filter((e) => outputs.has(e.source.id))
                    .map((e) => {
                      const mx = (e.sx + e.tx) / 2;
                      const my = (e.sy + e.ty) / 2;
                      return (
                        <Pressable
                          key={`chip-${e.key}`}
                          onPress={() => setSheet({ node: e.source, values: outputs.get(e.source.id) ?? [] })}
                          accessibilityRole="button"
                          accessibilityLabel={`View data from ${e.source.description}`}
                          hitSlop={4}
                          style={{
                            position: 'absolute',
                            left: mx - 33,
                            top: my - 11,
                            borderWidth: 1,
                            borderColor: color.lineStrong,
                            borderRadius: radius.pill,
                            paddingHorizontal: 9,
                            paddingVertical: 3,
                            backgroundColor: color.paper,
                          }}
                        >
                          <Text style={[type.mini, { fontSize: 10.5, fontWeight: '600' }]}>View data</Text>
                        </Pressable>
                      );
                    })
                : null}
            </View>

            {sheet ? (
              <View style={{ position: 'absolute', left: space.md, right: space.md, bottom: space.md }}>
                <LiquidGlass
                  effect="regular"
                  style={{ borderRadius: radius.lg, overflow: 'hidden' }}
                >
                <Card style={{ maxHeight: 300, backgroundColor: 'transparent', borderWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                    <Text style={[type.heading, { flex: 1 }]} numberOfLines={1}>
                      {sheet.node.description}
                    </Text>
                    <Pressable
                      onPress={() => setSheet(null)}
                      accessibilityRole="button"
                      accessibilityLabel="Close data view"
                      hitSlop={10}
                    >
                      <X size={18} color={color.ink2} strokeWidth={1.8} />
                    </Pressable>
                  </View>
                  <ScrollView style={{ marginTop: space.sm }}>
                    {sheet.values.map((v, i) => (
                      <View key={i} style={{ marginTop: i > 0 ? space.md : 0 }}>
                        <Text style={type.label}>
                          {v.type === 'jsonv' ? 'Data' : v.type === 'file' ? 'File' : 'Text'}
                        </Text>
                        <Text
                          selectable
                          style={[type.detail, { marginTop: 4, fontFamily: monoFamily, fontSize: 12 }]}
                        >
                          {valToText(v)}
                        </Text>
                      </View>
                    ))}
                    {sheet.values.length === 0 ? (
                      <Text style={type.detail}>No values yet.</Text>
                    ) : null}
                  </ScrollView>
                </Card>
                </LiquidGlass>
              </View>
            ) : null}
          </View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Screen>
  );
}
