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
import { useLocalSearchParams } from 'expo-router';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { X } from 'lucide-react-native';
import { Card, EmptyState, Screen, color, radius, space, statusColor, type } from '../../../ds';
import { valToText, type InterNodeVal, type NodeWithProperties } from '@hearth/workflows';
import { getWorkflowStore } from '../../../db/workflowStore';
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

function rowCenterY(n: NodeWithProperties, rowIndex: number): number {
  return n.position.y + HEADER_H + rowIndex * ROW_H + ROW_H / 2;
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
    let maxX = 0;
    let maxY = 0;
    for (const n of workflow.nodes) {
      maxX = Math.max(maxX, n.position.x + NODE_W);
      maxY = Math.max(maxY, n.position.y + nodeHeight(n));
    }
    const contentW = maxX + PAD;
    const contentH = maxY + PAD;
    const byId = new Map(workflow.nodes.map((n) => [n.id, n]));
    const edges: Edge[] = [];
    for (const target of workflow.nodes) {
      const props = visibleProps(target);
      props.forEach((p, rowIndex) => {
        if (!p.inputNodeId) return;
        const source = byId.get(p.inputNodeId);
        if (!source) return;
        edges.push({
          key: `${source.id}->${p.id}`,
          source,
          sx: source.position.x + NODE_W,
          sy: source.position.y + nodeHeight(source) / 2,
          tx: target.position.x,
          ty: rowCenterY(target, rowIndex),
        });
      });
    }
    return { contentW, contentH, edges };
  }, [workflow]);

  const initialView = useMemo(() => {
    if (!layout) return { tx: 0, ty: 0, scale: 1 };
    const viewportW = Math.max(240, windowW - space.xl * 2);
    const scale = Math.min(1, viewportW / layout.contentW);
    // Scaling happens about the content center; shift so the top-left lands
    // back at the viewport origin with a small margin.
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
      <Text style={type.title} accessibilityRole="header">
        {workflow.name}
      </Text>
      <Text style={[type.mini, { marginTop: 4 }]}>
        The flow behind this workflow. Drag to move, pinch to zoom.
      </Text>

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
                    d={`M ${e.sx} ${e.sy} C ${e.sx + 56} ${e.sy} ${e.tx - 56} ${e.ty} ${e.tx} ${e.ty}`}
                    stroke={color.lineStrong}
                    strokeWidth={1.2}
                    fill="none"
                  />
                ))}
                {workflow.nodes.map((n) => {
                  const x = n.position.x;
                  const y = n.position.y;
                  const h = nodeHeight(n);
                  const state = nodeState(n);
                  return (
                    <G key={n.id}>
                      <Rect
                        x={x}
                        y={y}
                        width={NODE_W}
                        height={h}
                        rx={10}
                        fill={color.paper}
                        stroke={color.lineStrong}
                        strokeWidth={1}
                      />
                      <SvgText x={x + 12} y={y + 17} fontSize={11} fontWeight="600" fill={color.ink}>
                        {truncate(n.description, state ? 24 : 27)}
                      </SvgText>
                      <SvgText x={x + 12} y={y + 30} fontSize={8} letterSpacing={0.8} fill={color.ink3}>
                        {n.type.toUpperCase()}
                      </SvgText>
                      <Line
                        x1={x}
                        y1={y + HEADER_H}
                        x2={x + NODE_W}
                        y2={y + HEADER_H}
                        stroke={color.line}
                        strokeWidth={1}
                      />
                      {visibleProps(n).map((p, rowIndex) => {
                        const cy = rowCenterY(n, rowIndex);
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
                              {truncate(p.label ?? p.name, 32)}
                            </SvgText>
                          </G>
                        );
                      })}
                      {state ? (
                        <Circle
                          cx={x + NODE_W - 13}
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
                <Card style={{ maxHeight: 300 }}>
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
              </View>
            ) : null}
          </View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Screen>
  );
}
