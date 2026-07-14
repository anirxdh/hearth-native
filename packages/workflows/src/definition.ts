/**
 * The node-type registry, ported from the nonlinear reference's
 * nodeDefinition/defineNode pattern: every node type declares its properties
 * (name -> value-kind spec), a plain-English description, and a category.
 * Workflows are DATA interpreted by these shipped types - never downloaded
 * code (App Review guideline 2.5.2 safe).
 *
 * Hearth's types are deterministic and local: no cloud AI executor exists in
 * v1. The one probabilistic step a caregiver workflow ever needs (reading a
 * denial letter) is on-device OCR surfaced through a Human Confirm gate.
 */

export const CATEGORIES = ['Input', 'Record', 'Transform', 'Logic', 'Gate', 'Output'] as const;
export type Category = (typeof CATEGORIES)[number];

export type Card = 'one' | 'many';

/** What kinds of values a property accepts (mirrors the reference Specification). */
export type Specification = {
  text?: Card;
  file?: Card;
  jsonv?: Card;
  /** Fixed choice list rendered as a picker; value stored as text. */
  options?: readonly string[];
  /** Hidden properties are pre-wired by templates, not shown as user inputs. */
  hidden?: true;
  /** Optional properties may run with no value; required ones block. */
  optional?: true;
};

export type InputSpec = Record<string, Specification>;

export function defineNode<const S extends InputSpec>(
  properties: S,
  description: string,
  category: Category,
) {
  return { properties, description, category } as const;
}

export const nodeDefinition = {
  /** A value the caregiver supplies when running: text typed in. */
  'Text Input': defineNode(
    { Value: { text: 'one' } },
    'Something you type in when the workflow runs.',
    'Input',
  ),

  /** A document the caregiver uploads from the vault, camera, or Files. */
  'File Input': defineNode(
    { Value: { file: 'many' } },
    'A document you upload: a photo, a PDF, or a file from the vault.',
    'Input',
  ),

  /** Pulls named fields from a patient's Hearth record, deterministically. */
  'Patient Record Pull': defineNode(
    {
      Patient: { text: 'one' },
      Fields: { text: 'one', hidden: true },
    },
    "Fills in details from the person's Hearth record, like name, date of birth, medications, and allergies.",
    'Record',
  ),

  /**
   * Extracts text from an uploaded document. On iPhone this is on-device
   * OCR (nothing leaves the phone); the extracted text ALWAYS flows through
   * a Human Confirm gate before it is used anywhere.
   */
  'Document Text Extract': defineNode(
    {
      Document: { file: 'one' },
      'Manual Text': { text: 'one', hidden: true, optional: true },
    },
    'Reads the text out of an uploaded document, on this device.',
    'Transform',
  ),

  /** Single-brace template rendering: {Tokens} filled from wired inputs. */
  'Form Fill': defineNode(
    {
      Template: { text: 'one', hidden: true },
      Data: { jsonv: 'many', text: 'many', optional: true },
    },
    'Fills a document template with the collected details.',
    'Transform',
  ),

  /** Ported directly from the reference Logic node. */
  'If Else': defineNode(
    {
      LHS: { text: 'one' },
      Condition: { options: ['equals', 'not equals', 'contains'] as const, text: 'one' },
      RHS: { text: 'one' },
      Value: { text: 'one' },
      'Else Value': { text: 'one', optional: true },
    },
    'Chooses between two values based on a condition.',
    'Logic',
  ),

  /**
   * The safety pause (the reference's Approval node, made local): execution
   * stops here until the caregiver reviews the values and confirms in the
   * app. Every path that renders a document MUST pass one of these.
   */
  'Human Confirm': defineNode(
    {
      Value: { text: 'many', jsonv: 'many', file: 'many' },
      Prompt: { text: 'one', hidden: true },
    },
    'Stops and shows you everything collected so far. Nothing continues until you confirm.',
    'Gate',
  ),

  /** Renders confirmed text into the final printable document (sink). */
  'Document Render': defineNode(
    {
      Body: { text: 'one' },
      Title: { text: 'one', hidden: true },
      'Output Kind': { options: ['letter', 'packet', 'form'] as const, text: 'one', hidden: true },
    },
    'Produces the finished, printable document.',
    'Output',
  ),

  /** Writes confirmed fields INTO the patient record (new-patient intake). */
  'Record Write': defineNode(
    {
      Patient: { text: 'one' },
      Data: { jsonv: 'one' },
      Prompt: { text: 'one', hidden: true },
    },
    "Saves confirmed details into the person's Hearth record.",
    'Output',
  ),
} as const;

export type NodeType = keyof typeof nodeDefinition;

export function isNodeType(t: string): t is NodeType {
  return t in nodeDefinition;
}

/** Sink node types: a valid workflow has exactly one sink. */
export const SINK_TYPES: readonly NodeType[] = ['Document Render', 'Record Write'];

/**
 * Structural safety rule, enforced at template validation time: no path may
 * reach a sink without passing a Human Confirm gate.
 */
export const GATE_TYPE: NodeType = 'Human Confirm';
