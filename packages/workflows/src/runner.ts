import { uuidv7 } from '@hearth/core';
import { GATE_TYPE, SINK_TYPES, isNodeType, nodeDefinition, type NodeType } from './definition';
import { ConfirmPause, executors, type ExecContext, type Params, type RecordAccess } from './executors';
import type {
  FullWorkflow,
  NodeWithProperties,
  UserInputTemplate,
  UserInputValue,
  WfExecution,
} from './model';
import { nodeById, type WorkflowStore } from './store';
import type { InterNodeVal } from './values';

/**
 * The resumable runner, ported from the reference's execute flow: resolve the
 * single sink node, recursively execute upstream dependencies (properties
 * wired via inputNodeId), persist every node's output, and pause the whole
 * run when a Human Confirm gate is reached. Because outputs live in the
 * store, resuming after a force-quit replays instantly from persisted state
 * and continues where the caregiver left off.
 */

export type RunnerEnv = {
  store: WorkflowStore;
  records: RecordAccess;
  extractText: ExecContext['extractText'];
  now: () => string;
  newId?: () => string;
};

export type RunResult =
  | { kind: 'completed'; executionId: string; output: InterNodeVal[] }
  | { kind: 'awaiting_confirm'; executionId: string; nodeId: string; payload: InterNodeVal[] }
  | { kind: 'failed'; executionId: string; error: string };

export function sinkNode(w: FullWorkflow): NodeWithProperties {
  const sinks = w.nodes.filter((n) => SINK_TYPES.includes(n.type as NodeType));
  if (sinks.length !== 1) {
    throw new Error(`workflow ${w.key} must have exactly one output node, found ${sinks.length}`);
  }
  return sinks[0]!;
}

/**
 * The preview card's inputs: every visible, unwired, unfilled property in
 * the graph (the reference derives these from the sink; with whole-graph
 * templates the reachable set is the whole graph).
 */
export function userInputTemplate(w: FullWorkflow): UserInputTemplate {
  const userInputs: UserInputTemplate['userInputs'] = [];
  for (const n of w.nodes) {
    for (const p of n.properties) {
      if (!p.hidden && !p.inputNodeId && p.values.length === 0) {
        userInputs.push({ ...p, nodeType: n.type, nodeDescription: n.description });
      }
    }
  }
  const { nodes: _nodes, ...workflow } = w;
  return { workflow, userInputs };
}

/**
 * Template safety validation (schema-level rule from the roadmap): every
 * path into a sink node must pass through a Human Confirm gate.
 */
export function validateGateBeforeSink(w: FullWorkflow): void {
  const sink = sinkNode(w);
  const visited = new Set<string>();
  const walk = (node: NodeWithProperties, gated: boolean): void => {
    if (node.type === GATE_TYPE) gated = true;
    const key = `${node.id}:${gated}`;
    if (visited.has(key)) return;
    visited.add(key);
    const upstream = node.properties
      .filter((p) => p.inputNodeId)
      .map((p) => nodeById(w, p.inputNodeId!));
    if (upstream.length === 0 && !gated && node.id !== sink.id) {
      // a source path exists that never passes a gate before reaching here;
      // only a problem if "here" can reach the sink - which it can, since we
      // walk from the sink.
      throw new Error(`workflow ${w.key}: path from "${node.description}" reaches the output without a Human Confirm gate`);
    }
    for (const up of upstream) walk(up, gated);
  };
  walk(sink, false);
}

/** Start a run (or restart the resolution of an existing one). */
export async function execute(
  env: RunnerEnv,
  workflowId: string,
  userInputs: UserInputValue[],
  patientId: string | null,
): Promise<RunResult> {
  const store = env.store;
  const w = store.getWorkflow(workflowId);
  if (!w) throw new Error(`no workflow ${workflowId}`);
  const newId = env.newId ?? uuidv7;
  const execution: WfExecution = {
    id: newId(),
    workflowId,
    workflowVersion: w.version,
    patientId,
    status: 'running',
    awaitingNodeId: null,
    error: null,
    startedAt: env.now(),
    finishedAt: null,
  };
  store.createExecution(execution);
  store.saveExecutionInputs(execution.id, userInputs);
  return resolveRun(env, w, execution.id);
}

/** Confirm a paused gate with (possibly caregiver-edited) values and resume. */
export async function confirm(
  env: RunnerEnv,
  executionId: string,
  nodeId: string,
  confirmedValues: InterNodeVal[],
): Promise<RunResult> {
  const store = env.store;
  const execution = store.getExecution(executionId);
  if (!execution) throw new Error(`no execution ${executionId}`);
  if (execution.status !== 'awaiting_confirm' || execution.awaitingNodeId !== nodeId) {
    throw new Error('execution is not awaiting confirmation at this node');
  }
  const newId = env.newId ?? uuidv7;
  store.saveNodeOutput({
    id: newId(),
    executionId,
    nodeId,
    output: confirmedValues,
    at: env.now(),
  });
  store.updateExecution(executionId, { status: 'running', awaitingNodeId: null });
  const w = store.getWorkflow(execution.workflowId);
  if (!w) throw new Error(`no workflow ${execution.workflowId}`);
  return resolveRun(env, w, executionId);
}

/**
 * Cancel an in-flight run. Terminal states are left untouched (idempotent);
 * a canceled run keeps its persisted node outputs for the audit trail but
 * can never be confirmed or resumed into a document.
 */
export function cancel(env: RunnerEnv, executionId: string): void {
  const execution = env.store.getExecution(executionId);
  if (!execution) throw new Error(`no execution ${executionId}`);
  if (execution.status === 'completed' || execution.status === 'failed' || execution.status === 'canceled') {
    return;
  }
  env.store.updateExecution(executionId, {
    status: 'canceled',
    awaitingNodeId: null,
    finishedAt: env.now(),
  });
}

/** Resume any in-flight run after an app restart. */
export async function resume(env: RunnerEnv, executionId: string): Promise<RunResult> {
  const execution = env.store.getExecution(executionId);
  if (!execution) throw new Error(`no execution ${executionId}`);
  if (execution.status === 'awaiting_confirm') {
    // Recompute the pause payload from persisted upstream outputs.
    const w = env.store.getWorkflow(execution.workflowId)!;
    return resolveRun(env, w, executionId);
  }
  if (execution.status === 'running') {
    const w = env.store.getWorkflow(execution.workflowId)!;
    return resolveRun(env, w, executionId);
  }
  const outputs = env.store.getNodeOutputs(executionId);
  const w = env.store.getWorkflow(execution.workflowId)!;
  const out = outputs.get(sinkNode(w).id) ?? [];
  return execution.status === 'completed'
    ? { kind: 'completed', executionId, output: out }
    : { kind: 'failed', executionId, error: execution.error ?? 'canceled' };
}

async function resolveRun(env: RunnerEnv, w: FullWorkflow, executionId: string): Promise<RunResult> {
  const store = env.store;
  const newId = env.newId ?? uuidv7;
  const execution = store.getExecution(executionId)!;
  const inputs = store.getExecutionInputs(executionId);
  const inputByProp = new Map(inputs.map((i) => [i.nodePropertyId, i.values]));
  const outputs = store.getNodeOutputs(executionId);

  const resolveNode = async (node: NodeWithProperties, stack: string[]): Promise<InterNodeVal[]> => {
    const cached = outputs.get(node.id);
    if (cached) return cached;
    if (stack.includes(node.id)) {
      throw new Error(`workflow ${w.key}: cycle through "${node.description}"`);
    }
    if (!isNodeType(node.type)) throw new Error(`unknown node type ${node.type}`);

    const params: Params = {};
    for (const p of node.properties) {
      if (p.inputNodeId) {
        const upstream = nodeById(w, p.inputNodeId);
        params[p.name] = await resolveNode(upstream, [...stack, node.id]);
      } else if (inputByProp.has(p.id)) {
        params[p.name] = inputByProp.get(p.id)!;
      } else if (p.values.length > 0) {
        params[p.name] = p.values;
      } else {
        params[p.name] = null;
      }
    }

    // required-property gate: null params on non-optional specs block the run
    const spec = nodeDefinition[node.type];
    for (const [name, s] of Object.entries(spec.properties)) {
      if (!s.optional && params[name] === null) {
        throw new Error(`"${node.description}" is missing "${name}"`);
      }
    }

    const ctx: ExecContext = {
      nodeId: node.id,
      patientId: execution.patientId,
      records: env.records,
      extractText: env.extractText,
      confirmedOutput: outputs.get(node.id),
    };
    const out = await executors[node.type](params, ctx);
    if (out === null) throw new Error(`"${node.description}" could not produce a value`);
    store.saveNodeOutput({ id: newId(), executionId, nodeId: node.id, output: out, at: env.now() });
    outputs.set(node.id, out);
    return out;
  };

  try {
    const sink = sinkNode(w);
    const output = await resolveNode(sink, []);
    store.updateExecution(executionId, { status: 'completed', finishedAt: env.now() });
    return { kind: 'completed', executionId, output };
  } catch (e) {
    if (e instanceof ConfirmPause) {
      store.updateExecution(executionId, { status: 'awaiting_confirm', awaitingNodeId: e.nodeId });
      return { kind: 'awaiting_confirm', executionId, nodeId: e.nodeId, payload: e.payload };
    }
    const error = e instanceof Error ? e.message : String(e);
    store.updateExecution(executionId, { status: 'failed', error, finishedAt: env.now() });
    return { kind: 'failed', executionId, error };
  }
}
