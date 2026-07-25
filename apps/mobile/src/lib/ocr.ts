/**
 * On-device OCR bridge for the scan-a-label flow (P21).
 *
 * The reading itself never leaves the phone. On iOS the pipeline is Apple
 * Vision (VNRecognizeTextRequest) wrapped in a small Expo Module named
 * "RuaVision". The spike (docs/ocr-scorecard.md) proved that pipeline
 * end to end against a 40-label corpus; packaging the Swift module into
 * the app binary needs a device build, so it is a P21 finishing item on
 * TODO. Until that build lands, the module is looked up OPTIONALLY: when
 * it is registered we use it, when it is not we return null and the
 * capture screen explains that reading is not available in this build.
 *
 * On web (the Playwright test surface) and in demos, a text fixture can be
 * planted at (globalThis as any).__ruaOcrFixture; it stands in for the
 * recognized text so the parse -> confirm -> save path is exercised with
 * zero native dependencies.
 */
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import type { OcrLine } from '@rua/label-parser';

interface RuaVisionModule {
  /** Recognized text of the image, one line per visual line, or null. */
  recognizeText(uri: string): Promise<string | null>;
}

/** Test/demo hook: a planted string stands in for recognized label text. */
function fixtureText(): string | null {
  const fixture = (globalThis as { __ruaOcrFixture?: unknown }).__ruaOcrFixture;
  return typeof fixture === 'string' ? fixture : null;
}

/**
 * Extract the text of a label photo, entirely on this device.
 * Returns null when no on-device recognizer is available in this build.
 */
export async function extractTextFromImage(uri: string): Promise<string | null> {
  if (Platform.OS === 'ios') {
    const vision = requireOptionalNativeModule<RuaVisionModule>('RuaVision');
    if (vision) {
      try {
        const text = await vision.recognizeText(uri);
        if (text && text.trim().length > 0) return text;
      } catch {
        // Fall through: an unreadable photo is handled by the caller.
      }
    }
  }
  return fixtureText();
}

/**
 * Adapt plain recognized text to the parser's OcrLine shape.
 *
 * The deterministic parser reasons about rows and left edges, so each text
 * line gets a synthetic bounding box: reading order becomes the y axis and
 * leading whitespace becomes the x offset. The native module will later
 * emit real Vision bounding boxes; this adapter keeps the parser contract
 * identical for both sources.
 */
export function ocrLinesFromText(text: string, confidence = 0.95): OcrLine[] {
  const lines: OcrLine[] = [];
  const rows = text.split(/\r?\n/);
  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i] ?? '';
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;
    const indent = raw.length - raw.trimStart().length;
    lines.push({
      text: trimmed,
      x: indent * 8,
      y: i * 32,
      w: trimmed.length * 10,
      h: 24,
      confidence,
    });
  }
  return lines;
}
