/**
 * The RunnerEnv wiring for the admin-workflow engine (P26-P28): deterministic
 * record access over the repo, the on-device text-extraction hook, and the
 * three run entry points (start, confirm, resume). Every engine call ends in
 * bumpDataVersion() so screens re-read execution state from SQLite.
 */
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import {
  confirm,
  execute,
  resume,
  sinkNode,
  valToText,
  type FullWorkflow,
  type InterNodeVal,
  type NodeWithProperties,
  type RecordAccess,
  type RunnerEnv,
  type RunResult,
  type UserInputValue,
} from '@hearth/workflows';
import { addDocument, createContact, getPatient, listMedications, logAccess, updatePatient } from '../db/repo';
import { getWorkflowStore } from '../db/workflowStore';
import { nowIso } from './clock';
import { extractTextFromImage } from './ocr';
import { bumpDataVersion } from './events';

/** Shown when on-device extraction is unavailable and no manual text exists. */
export const MANUAL_TEXT_COPY =
  'Could not read this document on this platform. Paste or type the text instead.';

const CAREGIVER_LINE = 'Prepared by the family caregiver';

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Deterministic field pulls for the Patient Record Pull node. Every value is
 * a display-ready string so the confirm gate shows exactly what the document
 * will say.
 */
function pullPatientFields(patientId: string, fields: string[]): Record<string, unknown> {
  const patient = getPatient(patientId);
  if (!patient) return {};
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    switch (field) {
      case 'fullName':
        out.fullName = patient.fullName;
        break;
      case 'dob':
        out.dob = patient.dob ?? 'not on file';
        break;
      case 'conditions':
        out.conditions = patient.conditions.length > 0 ? patient.conditions.join(', ') : 'none on record';
        break;
      case 'medsList': {
        const meds = listMedications(patientId);
        out.medsList =
          meds.length > 0
            ? meds
                .map(
                  (m) =>
                    `${m.name}${m.strength ? ` ${m.strength}` : ''}${m.sig ? `, ${m.sig}` : ''}`,
                )
                .join('\n')
            : 'No active medications on record.';
        break;
      }
      case 'caregiverLine':
        out.caregiverLine = CAREGIVER_LINE;
        break;
      case 'primaryPharmacy': {
        const meds = listMedications(patientId);
        out.primaryPharmacy = meds.map((m) => m.pharmacy).find(Boolean) ?? 'not on file';
        break;
      }
      default:
        // Unknown fields stay absent so the template token remains visible.
        break;
    }
  }
  return out;
}

/**
 * The Record Write side: confirmed intake keys map onto repo writes, so the
 * audit log and refresh signal come for free from the repo layer.
 */
function writePatientData(patientId: string, data: Record<string, unknown>): void {
  const patch: {
    fullName?: string;
    dob?: string;
    conditions?: string[];
    allergies?: { name: string; reaction: string; severe: boolean }[];
  } = {};
  if (typeof data.fullName === 'string' && data.fullName.trim()) patch.fullName = data.fullName.trim();
  if (typeof data.dob === 'string' && data.dob.trim()) patch.dob = data.dob.trim();
  if (typeof data.conditions === 'string') patch.conditions = splitList(data.conditions);
  if (typeof data.allergies === 'string') {
    patch.allergies = splitList(data.allergies).map((name) => ({ name, reaction: '', severe: false }));
  }
  if (Object.keys(patch).length > 0) updatePatient(patientId, patch);
  if (typeof data.primaryPharmacy === 'string' && data.primaryPharmacy.trim()) {
    createContact({
      patientId,
      name: data.primaryPharmacy.trim(),
      relation: 'pharmacy',
      kind: 'pharmacy',
      sortOrder: 99,
    });
  }
}

const records: RecordAccess = { pullPatientFields, writePatientData };

/**
 * On-device text extraction: delegates to lib/ocr (iOS Vision native module
 * when present, the __hearthOcrFixture hook on web/test), and returns null
 * so the Manual Text property drives the extract node otherwise; the run
 * screen surfaces MANUAL_TEXT_COPY in that case.
 */
async function extractText(file: { fileUrl: string; mimeType?: string | undefined }): Promise<string | null> {
  return extractTextFromImage(file.fileUrl);
}

function runnerEnv(): RunnerEnv {
  return { store: getWorkflowStore(), records, extractText, now: nowIso };
}

/** Start a run with the caregiver's inputs; refresh screens afterwards. */
export async function startRun(
  workflowId: string,
  inputs: UserInputValue[],
  patientId: string | null,
): Promise<RunResult> {
  const result = await execute(runnerEnv(), workflowId, inputs, patientId);
  bumpDataVersion();
  return result;
}

/** Confirm a paused gate with the caregiver-edited bundle and continue. */
export async function confirmRun(
  executionId: string,
  nodeId: string,
  values: InterNodeVal[],
): Promise<RunResult> {
  const result = await confirm(runnerEnv(), executionId, nodeId, values);
  bumpDataVersion();
  return result;
}

/**
 * Resume an in-flight run; a failed run is first reset to running so the
 * failing node re-executes from persisted upstream outputs.
 */
export async function resumeRun(executionId: string): Promise<RunResult> {
  const env = runnerEnv();
  const execution = env.store.getExecution(executionId);
  if (execution && execution.status === 'failed') {
    env.store.updateExecution(executionId, { status: 'running', error: null, finishedAt: null });
  }
  const result = await resume(env, executionId);
  bumpDataVersion();
  return result;
}

/* ---------- graph helpers shared by the stepper and the canvas ---------- */

/** Nodes in dependency order (sources first, sink last), walking from the sink. */
export function orderNodes(w: FullWorkflow): NodeWithProperties[] {
  const byId = new Map(w.nodes.map((n) => [n.id, n]));
  const seen = new Set<string>();
  const ordered: NodeWithProperties[] = [];
  const visit = (node: NodeWithProperties): void => {
    if (seen.has(node.id)) return;
    seen.add(node.id);
    for (const p of node.properties) {
      if (p.inputNodeId) {
        const upstream = byId.get(p.inputNodeId);
        if (upstream) visit(upstream);
      }
    }
    ordered.push(node);
  };
  visit(sinkNode(w));
  return ordered;
}

/** The gate's caregiver-facing prompt text. */
export function gatePrompt(w: FullWorkflow, gateNodeId: string): string {
  const gate = w.nodes.find((n) => n.id === gateNodeId);
  const prompt = gate?.properties.find((p) => p.name === 'Prompt')?.values[0];
  return prompt ? valToText(prompt) : 'Review every value below, then confirm.';
}

/**
 * Rebuild the Human Confirm payload from persisted upstream outputs, exactly
 * as the executor bundles it: jsonv values spread their keys, everything else
 * lands under the property name.
 */
export function confirmBundle(
  w: FullWorkflow,
  gateNodeId: string,
  outputs: Map<string, InterNodeVal[]>,
  inputs: UserInputValue[],
): Record<string, unknown> {
  const gate = w.nodes.find((n) => n.id === gateNodeId);
  if (!gate) return {};
  const inputByProp = new Map(inputs.map((i) => [i.nodePropertyId, i.values]));
  const bundle: Record<string, unknown> = {};
  for (const p of gate.properties) {
    if (p.name === 'Prompt') continue;
    const vals = p.inputNodeId
      ? outputs.get(p.inputNodeId)
      : (inputByProp.get(p.id) ?? (p.values.length > 0 ? p.values : undefined));
    if (!vals || vals.length === 0) continue;
    for (const v of vals) {
      if (v.type === 'jsonv') Object.assign(bundle, v.json);
    }
    const rest = vals.filter((v) => v.type !== 'jsonv');
    if (rest.length > 0) bundle[p.name] = rest.map(valToText).join('\n');
  }
  return bundle;
}

/** The sink node with its display title and output kind. */
export function sinkInfo(w: FullWorkflow): {
  node: NodeWithProperties;
  kind: 'document' | 'record';
  title: string;
} {
  const node = sinkNode(w);
  const titleVal = node.properties.find((p) => p.name === 'Title')?.values[0];
  return {
    node,
    kind: node.type === 'Record Write' ? 'record' : 'document',
    title: titleVal ? valToText(titleVal) : w.name,
  };
}

/* ---------- output: print + vault ---------- */

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function generatedAtLine(): string {
  return new Date().toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Minimal standalone document template in the @hearth/print editorial
 * language (that package has no generic-document export yet): US Letter,
 * hairline rules, ink on paper, escaped interpolation.
 */
export function workflowDocumentHtml(title: string, body: string, generatedAt: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  @page { size: letter; margin: 0.75in; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: #FFFFFF; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: #1D1D1F;
    font-size: 12px;
    line-height: 1.55;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .kicker {
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: #6E6E73;
  }
  h1 {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.15;
    margin-top: 2px;
    padding-bottom: 12px;
    border-bottom: 1px solid #E5E5EA;
  }
  pre {
    white-space: pre-wrap;
    font-family: inherit;
    margin-top: 16px;
  }
  .footer {
    margin-top: 28px;
    padding-top: 8px;
    border-top: 1px solid #E5E5EA;
    color: #6E6E73;
    font-size: 9px;
  }
</style>
</head>
<body>
  <div class="kicker">Hearth workflow document</div>
  <h1>${esc(title)}</h1>
  <pre>${esc(body)}</pre>
  <div class="footer">Generated ${esc(generatedAt)}. Every value was reviewed and confirmed by the caregiver before this document was produced.</div>
</body>
</html>`;
}

/** Print (or save as PDF from the print sheet); logged as a sensitive read. */
export async function printWorkflowOutput(
  title: string,
  body: string,
  patientId: string | null,
): Promise<void> {
  logAccess(`workflow.print:${title}`, patientId);
  await Print.printAsync({ html: workflowDocumentHtml(title, body, generatedAtLine()) });
}

/**
 * Save the finished document text into the patient's vault (bytes in the
 * sandboxed vault dir, row via the repo). Returns false where the platform
 * has no document directory (the web test surface).
 */
export async function saveWorkflowOutputToDocuments(
  patientId: string,
  title: string,
  body: string,
): Promise<boolean> {
  const dir = FileSystem.documentDirectory;
  if (!dir) return false;
  const vaultDir = `${dir}vault/`;
  const info = await FileSystem.getInfoAsync(vaultDir);
  if (!info.exists) await FileSystem.makeDirectoryAsync(vaultDir, { intermediates: true });
  const fileName = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.txt`;
  await FileSystem.writeAsStringAsync(`${vaultDir}${fileName}`, body);
  addDocument({ patientId, title, category: 'other', fileName, mimeType: 'text/plain' });
  return true;
}
