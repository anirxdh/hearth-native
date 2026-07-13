/**
 * Input shapes for the print templates.
 *
 * These are deliberately flat, display-ready types. The app maps its
 * domain records into these before printing, so this package never
 * needs to know about storage, encryption, or React Native.
 */

export type PrintAllergy = {
  name: string;
  reaction: string;
  severe: boolean;
};

export type PrintPatient = {
  fullName: string;
  preferredName?: string;
  dob?: string;
  relationship?: string;
  conditions: string[];
  allergies: PrintAllergy[];
};

export type PrintMed = {
  name: string;
  strength?: string;
  sig?: string;
  prn: boolean;
  highAlert: boolean;
  daysLeft?: number | null;
  runOutDate?: string | null;
};

export type PrintVital = {
  label: string;
  value: string;
  recordedOn: string;
};

export type PrintContact = {
  name: string;
  relation?: string;
  phone?: string;
  kind: 'emergency' | 'provider' | 'pharmacy' | 'other';
};

export type PrintNutritionRow = {
  nutrient: string;
  target: string;
  why: string;
};
