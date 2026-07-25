import { uuidv7 } from '@rua/core';
import { nodeDefinition, type NodeType } from './definition';
import type { FullWorkflow, NodeWithProperties, WfNodeProperty, WfWorkflow } from './model';
import type { InterNodeVal } from './values';

/**
 * Small declarative builder used by the bundled templates: creates the same
 * rows the nonlinear editor would (nodes, properties, inputNodeId wiring),
 * with stable ids derived from the template key so definitions are
 * reproducible and diffable across versions.
 */

export type TemplateMeta = Omit<WfWorkflow, 'id' | 'createdAt'>;

export class WorkflowBuilder {
  private nodes: NodeWithProperties[] = [];
  private seq = 0;
  constructor(private meta: TemplateMeta) {}

  private stableId(kind: string, name: string): string {
    return `${this.meta.key}:${kind}:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  }

  node(
    type: NodeType,
    description: string,
    position: { x: number; y: number },
    presets: Partial<Record<string, InterNodeVal[]>> = {},
    labels: Partial<Record<string, string>> = {},
  ): NodeWithProperties {
    const nodeId = this.stableId('node', `${this.seq++}-${description}`);
    const properties: WfNodeProperty[] = Object.entries(nodeDefinition[type].properties).map(
      ([name, spec]) => ({
        id: `${nodeId}:prop:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        nodeId,
        name,
        label: labels[name] ?? null,
        inputNodeId: null,
        hidden: Boolean(spec.hidden),
        values: presets[name] ?? [],
      }),
    );
    const n: NodeWithProperties = {
      id: nodeId,
      workflowId: this.meta.key,
      type,
      description,
      position,
      properties,
    };
    this.nodes.push(n);
    return n;
  }

  /**
   * THE EDGE: wire `from`'s output into `to`'s named property. Wiring a name
   * outside the node's spec creates an extra property, exactly like the
   * reference's mustache-token properties.
   */
  wire(from: NodeWithProperties, to: NodeWithProperties, propertyName: string): void {
    let p = to.properties.find((x) => x.name === propertyName);
    if (!p) {
      p = {
        id: `${to.id}:prop:${propertyName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        nodeId: to.id,
        name: propertyName,
        label: null,
        inputNodeId: null,
        hidden: false,
        values: [],
      };
      to.properties.push(p);
    }
    p.inputNodeId = from.id;
  }

  build(now: string): FullWorkflow {
    return {
      ...this.meta,
      id: uuidv7(),
      createdAt: now,
      nodes: this.nodes,
    };
  }

  /** Deterministic build for tests and seeding: id = template key. */
  buildStable(now: string): FullWorkflow {
    return { ...this.meta, id: this.meta.key, createdAt: now, nodes: this.nodes };
  }
}
