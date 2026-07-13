/**
 * Types shared between the Vision OCR bridge and the deterministic parser.
 *
 * OcrLine mirrors exactly what the Swift VisionOCR CLI (and later the Expo
 * module) emits: one recognized text line with a pixel-space bounding box
 * (top-left origin) and Vision's recognition confidence.
 */

export interface OcrLine {
  text: string;
  /** Left edge, pixels from image left. */
  x: number;
  /** Top edge, pixels from image top. */
  y: number;
  w: number;
  h: number;
  /** Vision recognition confidence, 0..1. */
  confidence: number;
}

export interface ParsedField<T = string> {
  value: T;
  /**
   * 0..1. Product of the source line's OCR confidence and a heuristic
   * factor (1.0 for an explicitly labeled extraction, lower for
   * positional or fuzzy fallbacks). The P22 confirm UI flags low values.
   */
  confidence: number;
}

export interface ParsedLabel {
  patientName?: ParsedField;
  /** Canonical generic name from the bundled list, uppercase. */
  drugName?: ParsedField;
  /** As printed, e.g. "500 MG" or "100 UNITS/ML". */
  strength?: ParsedField;
  sig?: ParsedField;
  /** ISO YYYY-MM-DD. */
  fillDate?: ParsedField;
  daySupply?: ParsedField<number>;
  quantity?: ParsedField<number>;
  refills?: ParsedField<number>;
  rxNumber?: ParsedField;
  /** Digits only, 10 digits, leading US country code stripped. */
  pharmacyPhone?: ParsedField;
}
