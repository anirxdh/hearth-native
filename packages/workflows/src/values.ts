import { z } from 'zod';

/**
 * InterNodeVal: the typed value that flows along an edge from one node's
 * output into another node's property. Ported from the nonlinear reference
 * (SpectAI) - text, file, and json values cover every caregiver workflow;
 * the union stays open for future kinds (email, folder) without schema churn.
 */

export const TextValSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});
export type TextVal = z.infer<typeof TextValSchema>;

export const FileValSchema = z.object({
  type: z.literal('file'),
  /** App-sandbox relative path (documents vault) or data: URI in tests. */
  fileUrl: z.string(),
  mimeType: z.string().optional(),
  name: z.string().optional(),
});
export type FileVal = z.infer<typeof FileValSchema>;

export const JsonValSchema = z.object({
  type: z.literal('jsonv'),
  json: z.record(z.string(), z.unknown()),
});
export type JsonVal = z.infer<typeof JsonValSchema>;

export const InterNodeValSchema = z.discriminatedUnion('type', [
  TextValSchema,
  FileValSchema,
  JsonValSchema,
]);
export type InterNodeVal = z.infer<typeof InterNodeValSchema>;

export function textVal(text: string): TextVal {
  return { type: 'text', text };
}
export function jsonVal(json: Record<string, unknown>): JsonVal {
  return { type: 'jsonv', json };
}
export function fileVal(fileUrl: string, extra?: { mimeType?: string; name?: string }): FileVal {
  return { type: 'file', fileUrl, ...extra };
}

/** Flatten values to display/interpolation text, mirroring the reference. */
export function valToText(v: InterNodeVal): string {
  switch (v.type) {
    case 'text':
      return v.text;
    case 'file':
      return v.name ?? v.fileUrl;
    case 'jsonv':
      return JSON.stringify(v.json, null, 2);
  }
}
