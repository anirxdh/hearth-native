import { nodeDefinition, type NodeType } from './definition';
import { render } from './mustache';
import { jsonVal, textVal, valToText, type InterNodeVal } from './values';

/**
 * One executor per node type, ported from the reference's ExecFn registry:
 * (params, context) -> InterNodeVal[] | null. Null means "not ready" (a
 * required property has no value), which blocks the run with a clear error
 * instead of producing a wrong document.
 */

/** Thrown by Human Confirm to pause the run (the reference's ApprovalError). */
export class ConfirmPause extends Error {
  constructor(
    public readonly nodeId: string,
    public readonly payload: InterNodeVal[],
    message?: string,
  ) {
    super(message ?? 'awaiting human confirmation');
    this.name = 'ConfirmPause';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export type Params = Record<string, InterNodeVal[] | null>;

export type ExecContext = {
  nodeId: string;
  patientId: string | null;
  /** Deterministic record access, implemented by the app over the repo. */
  records: RecordAccess;
  /** On-device text extraction; null when unavailable (Manual Text covers it). */
  extractText: (file: { fileUrl: string; mimeType?: string | undefined }) => Promise<string | null>;
  /** Output already confirmed by the caregiver for this gate node, if any. */
  confirmedOutput: InterNodeVal[] | undefined;
};

export interface RecordAccess {
  pullPatientFields(patientId: string, fields: string[]): Record<string, unknown>;
  writePatientData(patientId: string, data: Record<string, unknown>): void;
}

type ExecFn = (params: Params, ctx: ExecContext) => Promise<InterNodeVal[] | null>;

/** Interpolation data: every param name maps to its flattened text. */
function paramText(params: Params): Record<string, string> {
  const data: Record<string, string> = {};
  for (const [name, vals] of Object.entries(params)) {
    if (!vals || vals.length === 0) continue;
    data[name] = vals.map(valToText).join('\n');
    // json params also expose their top-level keys as tokens
    for (const v of vals) {
      if (v.type === 'jsonv') {
        for (const [k, val] of Object.entries(v.json)) {
          data[k] = typeof val === 'string' ? val : JSON.stringify(val);
        }
      }
    }
  }
  return data;
}

export const executors: Record<NodeType, ExecFn> = {
  'Text Input': async (params) => params['Value'] ?? null,

  'File Input': async (params) => params['Value'] ?? null,

  'Patient Record Pull': async (params, ctx) => {
    const patient = params['Patient']?.[0];
    const fields = params['Fields']?.[0];
    if (!patient || !fields || !ctx.patientId) return null;
    const names = valToText(fields)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return [jsonVal(ctx.records.pullPatientFields(ctx.patientId, names))];
  },

  'Document Text Extract': async (params, ctx) => {
    const manual = params['Manual Text']?.[0];
    if (manual && valToText(manual).trim()) return [textVal(valToText(manual))];
    const doc = params['Document']?.[0];
    if (!doc || doc.type !== 'file') return null;
    const text = await ctx.extractText(doc);
    return text === null ? null : [textVal(text)];
  },

  'Form Fill': async (params) => {
    const template = params['Template']?.[0];
    if (!template) return null;
    return [textVal(render(valToText(template), paramText(params)))];
  },

  'If Else': async (params) => {
    const lhs = params['LHS']?.[0];
    const cond = params['Condition']?.[0];
    const rhs = params['RHS']?.[0];
    const value = params['Value']?.[0];
    if (!lhs || !cond || !rhs || !value) return null;
    const data = paramText(params);
    const l = render(valToText(lhs), data);
    const r = render(valToText(rhs), data);
    const c = valToText(cond);
    const matched =
      c === 'equals' ? l === r : c === 'not equals' ? l !== r : l.includes(r);
    if (matched) return [textVal(render(valToText(value), data))];
    const elseVal = params['Else Value']?.[0];
    return [textVal(elseVal ? render(valToText(elseVal), data) : '')];
  },

  'Human Confirm': async (params, ctx) => {
    // Resumption path: the caregiver already reviewed and confirmed.
    if (ctx.confirmedOutput) return ctx.confirmedOutput;
    // Bundle named params into one json payload so names survive the pause
    // and the caregiver edits key -> value rows in the confirm screen.
    const bundle: Record<string, unknown> = {};
    for (const [name, vals] of Object.entries(params)) {
      if (name === 'Prompt' || !vals || vals.length === 0) continue;
      const jsons = vals.filter((v) => v.type === 'jsonv');
      for (const j of jsons) Object.assign(bundle, j.json);
      const rest = vals.filter((v) => v.type !== 'jsonv');
      if (rest.length > 0) bundle[name] = rest.map(valToText).join('\n');
    }
    throw new ConfirmPause(ctx.nodeId, [jsonVal(bundle)]);
  },

  'Document Render': async (params) => {
    const body = params['Body']?.[0];
    if (!body) return null;
    const data = paramText(params);
    return [textVal(render(valToText(body), data))];
  },

  'Record Write': async (params, ctx) => {
    const data = params['Data']?.[0];
    if (!data || data.type !== 'jsonv' || !ctx.patientId) return null;
    ctx.records.writePatientData(ctx.patientId, data.json);
    return [textVal('saved')];
  },
};

export function specFor(type: NodeType) {
  return nodeDefinition[type];
}
