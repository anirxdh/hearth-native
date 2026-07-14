import { z } from 'zod';
import { InterNodeValSchema } from './values';
import { isNodeType } from './definition';

/**
 * The persisted workflow model, ported from the nonlinear reference:
 * a workflow owns nodes; a node owns properties; a property either holds
 * literal values, or points at another node via inputNodeId - THAT is the
 * edge. Executions record per-node outputs so a run can pause at a gate and
 * resume after an app restart.
 */

export const WfNodeSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  type: z.string().refine(isNodeType, 'unknown node type'),
  /** Short human name shown on the node card ("Read the denial"). */
  description: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
});
export type WfNode = z.infer<typeof WfNodeSchema>;

export const WfNodePropertySchema = z.object({
  id: z.string(),
  nodeId: z.string(),
  name: z.string(),
  label: z.string().nullable(),
  /** THE EDGE: when set, this property's values come from that node's output. */
  inputNodeId: z.string().nullable(),
  hidden: z.boolean(),
  values: z.array(InterNodeValSchema),
});
export type WfNodeProperty = z.infer<typeof WfNodePropertySchema>;

export const WfWorkflowSchema = z.object({
  id: z.string(),
  key: z.string(), // stable template key, e.g. "claim-denial-appeal"
  name: z.string(),
  description: z.string(),
  category: z.string(),
  estMinutes: z.number(),
  replacesHours: z.string(), // "replaces ~3.5 hrs"
  /** Definition version: bumped when a template changes; in-flight runs keep theirs. */
  version: z.number(),
  createdAt: z.string(),
});
export type WfWorkflow = z.infer<typeof WfWorkflowSchema>;

export type NodeWithProperties = WfNode & { properties: WfNodeProperty[] };
export type FullWorkflow = WfWorkflow & { nodes: NodeWithProperties[] };

export const ExecutionStatusSchema = z.enum([
  'running',
  'awaiting_confirm',
  'completed',
  'failed',
  'canceled',
]);
export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>;

export const WfExecutionSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  workflowVersion: z.number(),
  patientId: z.string().nullable(),
  status: ExecutionStatusSchema,
  /** Node currently awaiting a human confirm, when paused. */
  awaitingNodeId: z.string().nullable(),
  error: z.string().nullable(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
});
export type WfExecution = z.infer<typeof WfExecutionSchema>;

export const WfExecutionOutputSchema = z.object({
  id: z.string(),
  executionId: z.string(),
  nodeId: z.string(),
  output: z.array(InterNodeValSchema),
  at: z.string(),
});
export type WfExecutionOutput = z.infer<typeof WfExecutionOutputSchema>;

/** A caregiver-supplied value for an unfilled (user-input) property. */
export const UserInputValueSchema = z.object({
  nodePropertyId: z.string(),
  values: z.array(InterNodeValSchema),
});
export type UserInputValue = z.infer<typeof UserInputValueSchema>;

/** The preview card's contract: which properties the caregiver must fill. */
export type UserInputTemplate = {
  workflow: WfWorkflow;
  userInputs: (WfNodeProperty & { nodeType: string; nodeDescription: string })[];
};
