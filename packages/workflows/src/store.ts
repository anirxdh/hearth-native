import type {
  FullWorkflow,
  NodeWithProperties,
  UserInputValue,
  WfExecution,
  WfExecutionOutput,
  WfWorkflow,
} from './model';
import type { InterNodeVal } from './values';

/**
 * Persistence boundary. The app implements this over the encrypted SQLite
 * database (drizzle); tests implement it in memory. The runner is written
 * against this interface only, so it is provably resumable from whatever
 * the store holds after a force-quit.
 */
export interface WorkflowStore {
  getWorkflow(id: string): FullWorkflow | undefined;
  listWorkflows(): WfWorkflow[];

  createExecution(e: WfExecution): void;
  updateExecution(
    id: string,
    patch: Partial<Pick<WfExecution, 'status' | 'awaitingNodeId' | 'error' | 'finishedAt'>>,
  ): void;
  getExecution(id: string): WfExecution | undefined;
  listExecutions(workflowId?: string): WfExecution[];

  /** Snapshot of caregiver-supplied inputs for a run (property id -> values). */
  saveExecutionInputs(executionId: string, inputs: UserInputValue[]): void;
  getExecutionInputs(executionId: string): UserInputValue[];

  saveNodeOutput(o: WfExecutionOutput): void;
  /** Latest output per node for an execution. */
  getNodeOutputs(executionId: string): Map<string, InterNodeVal[]>;
}

/** In-memory store used by the headless test-suite. */
export class MemoryStore implements WorkflowStore {
  workflows = new Map<string, FullWorkflow>();
  executions = new Map<string, WfExecution>();
  inputs = new Map<string, UserInputValue[]>();
  outputs = new Map<string, WfExecutionOutput[]>();

  addWorkflow(w: FullWorkflow): void {
    this.workflows.set(w.id, w);
  }
  getWorkflow(id: string): FullWorkflow | undefined {
    const w = this.workflows.get(id);
    return w ? structuredClone(w) : undefined;
  }
  listWorkflows(): WfWorkflow[] {
    return [...this.workflows.values()].map(({ nodes: _nodes, ...w }) => w);
  }
  createExecution(e: WfExecution): void {
    this.executions.set(e.id, { ...e });
  }
  updateExecution(id: string, patch: Partial<WfExecution>): void {
    const e = this.executions.get(id);
    if (!e) throw new Error(`no execution ${id}`);
    Object.assign(e, patch);
  }
  getExecution(id: string): WfExecution | undefined {
    const e = this.executions.get(id);
    return e ? { ...e } : undefined;
  }
  listExecutions(workflowId?: string): WfExecution[] {
    return [...this.executions.values()].filter(
      (e) => !workflowId || e.workflowId === workflowId,
    );
  }
  saveExecutionInputs(executionId: string, inputs: UserInputValue[]): void {
    this.inputs.set(executionId, structuredClone(inputs));
  }
  getExecutionInputs(executionId: string): UserInputValue[] {
    return structuredClone(this.inputs.get(executionId) ?? []);
  }
  saveNodeOutput(o: WfExecutionOutput): void {
    const list = this.outputs.get(o.executionId) ?? [];
    list.push(structuredClone(o));
    this.outputs.set(o.executionId, list);
  }
  getNodeOutputs(executionId: string): Map<string, InterNodeVal[]> {
    const m = new Map<string, InterNodeVal[]>();
    for (const o of this.outputs.get(executionId) ?? []) m.set(o.nodeId, structuredClone(o.output));
    return m;
  }
}

/** Node lookup helpers shared by runner and UI. */
export function nodeById(w: FullWorkflow, id: string): NodeWithProperties {
  const n = w.nodes.find((x) => x.id === id);
  if (!n) throw new Error(`workflow ${w.key}: missing node ${id}`);
  return n;
}
