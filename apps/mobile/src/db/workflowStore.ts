import { eq } from 'drizzle-orm';
import {
  wfExecutionInputs,
  wfExecutionOutputs,
  wfExecutions,
  wfNodeProperties,
  wfNodes,
  wfWorkflows,
} from '@rua/schema';
import {
  ALL_TEMPLATES,
  isNodeType,
  type FullWorkflow,
  type InterNodeVal,
  type NodeWithProperties,
  type UserInputValue,
  type WfExecution,
  type WfExecutionOutput,
  type WfWorkflow,
  type WorkflowStore,
  validateGateBeforeSink,
} from '@rua/workflows';
import { uuidv7 } from '@rua/core';
import { getDb, type RuaDb } from './client';
import { nowIso } from '../lib/clock';

/**
 * The app's WorkflowStore: the engine's persistence boundary implemented over
 * the encrypted SQLite database, so paused runs survive force-quits on the
 * same storage every other record uses.
 */
export class DrizzleWorkflowStore implements WorkflowStore {
  constructor(private db: RuaDb) {}

  getWorkflow(id: string): FullWorkflow | undefined {
    const w = this.db.select().from(wfWorkflows).where(eq(wfWorkflows.id, id)).get();
    if (!w) return undefined;
    const nodes = this.db.select().from(wfNodes).where(eq(wfNodes.workflowId, id)).all();
    const full: NodeWithProperties[] = nodes.map((n) => {
      if (!isNodeType(n.type)) throw new Error(`unknown node type in db: ${n.type}`);
      return {
      id: n.id,
      workflowId: n.workflowId,
      type: n.type,
      description: n.description,
      position: { x: n.positionX, y: n.positionY },
      properties: this.db
        .select()
        .from(wfNodeProperties)
        .where(eq(wfNodeProperties.nodeId, n.id))
        .all()
        .map((p) => ({
          id: p.id,
          nodeId: p.nodeId,
          name: p.name,
          label: p.label,
          inputNodeId: p.inputNodeId,
          hidden: p.hidden,
          values: (p.values ?? []) as InterNodeVal[],
        })),
      };
    });
    return { ...rowToWorkflow(w), nodes: full };
  }

  listWorkflows(): WfWorkflow[] {
    return this.db.select().from(wfWorkflows).all().map(rowToWorkflow);
  }

  createExecution(e: WfExecution): void {
    this.db.insert(wfExecutions).values(e).run();
  }

  updateExecution(
    id: string,
    patch: Partial<Pick<WfExecution, 'status' | 'awaitingNodeId' | 'error' | 'finishedAt'>>,
  ): void {
    this.db.update(wfExecutions).set(patch).where(eq(wfExecutions.id, id)).run();
  }

  getExecution(id: string): WfExecution | undefined {
    const row = this.db.select().from(wfExecutions).where(eq(wfExecutions.id, id)).get();
    return row ?? undefined;
  }

  listExecutions(workflowId?: string): WfExecution[] {
    const rows = workflowId
      ? this.db.select().from(wfExecutions).where(eq(wfExecutions.workflowId, workflowId)).all()
      : this.db.select().from(wfExecutions).all();
    return rows;
  }

  saveExecutionInputs(executionId: string, inputs: UserInputValue[]): void {
    for (const i of inputs) {
      this.db
        .insert(wfExecutionInputs)
        .values({
          id: uuidv7(),
          executionId,
          nodePropertyId: i.nodePropertyId,
          values: i.values,
        })
        .run();
    }
  }

  getExecutionInputs(executionId: string): UserInputValue[] {
    return this.db
      .select()
      .from(wfExecutionInputs)
      .where(eq(wfExecutionInputs.executionId, executionId))
      .all()
      .map((r) => ({ nodePropertyId: r.nodePropertyId, values: r.values as InterNodeVal[] }));
  }

  saveNodeOutput(o: WfExecutionOutput): void {
    this.db
      .insert(wfExecutionOutputs)
      .values({ id: o.id, executionId: o.executionId, nodeId: o.nodeId, output: o.output, at: o.at })
      .run();
  }

  getNodeOutputs(executionId: string): Map<string, InterNodeVal[]> {
    const m = new Map<string, InterNodeVal[]>();
    const rows = this.db
      .select()
      .from(wfExecutionOutputs)
      .where(eq(wfExecutionOutputs.executionId, executionId))
      .all();
    for (const r of rows) m.set(r.nodeId, r.output as InterNodeVal[]);
    return m;
  }
}

function rowToWorkflow(w: typeof wfWorkflows.$inferSelect): WfWorkflow {
  return {
    id: w.id,
    key: w.key,
    name: w.name,
    description: w.description,
    category: w.category,
    estMinutes: w.estMinutes,
    replacesHours: w.replacesHours,
    version: w.version,
    createdAt: w.createdAt,
  };
}

let store: DrizzleWorkflowStore | null = null;
export function getWorkflowStore(): DrizzleWorkflowStore {
  if (!store) store = new DrizzleWorkflowStore(getDb());
  return store;
}

/**
 * Seed or upgrade the bundled workflow templates. Definition versioning
 * (P28): a template bumps its version, we insert the NEW definition under a
 * new id; in-flight executions keep pointing at the definition they started
 * with, so edits never break a paused run.
 */
export function seedWorkflowTemplates(): void {
  const db = getDb();
  const now = nowIso();
  for (const t of ALL_TEMPLATES) {
    const built = t.build(now).buildStable(now);
    validateGateBeforeSink(built);
    const existing = db
      .select()
      .from(wfWorkflows)
      .where(eq(wfWorkflows.key, built.key))
      .all()
      .sort((a, b) => b.version - a.version)[0];
    if (existing && existing.version >= built.version) continue;

    const defId = `${built.key}@v${built.version}`;
    db.insert(wfWorkflows)
      .values({
        id: defId,
        key: built.key,
        name: built.name,
        description: built.description,
        category: built.category,
        estMinutes: built.estMinutes,
        replacesHours: built.replacesHours,
        version: built.version,
        createdAt: now,
      })
      .run();
    for (const n of built.nodes) {
      db.insert(wfNodes)
        .values({
          id: `${defId}:${n.id}`,
          workflowId: defId,
          type: n.type,
          description: n.description,
          positionX: n.position.x,
          positionY: n.position.y,
        })
        .run();
      for (const p of n.properties) {
        db.insert(wfNodeProperties)
          .values({
            id: `${defId}:${p.id}`,
            nodeId: `${defId}:${n.id}`,
            name: p.name,
            label: p.label,
            inputNodeId: p.inputNodeId ? `${defId}:${p.inputNodeId}` : null,
            hidden: p.hidden,
            values: p.values,
          })
          .run();
      }
    }
  }
  store = null; // re-read on next access
}

/** Newest definition per key, for the library screen. */
export function listLatestWorkflows(): WfWorkflow[] {
  const all = getWorkflowStore().listWorkflows();
  const byKey = new Map<string, WfWorkflow>();
  for (const w of all) {
    const cur = byKey.get(w.key);
    if (!cur || w.version > cur.version) byKey.set(w.key, w);
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}
