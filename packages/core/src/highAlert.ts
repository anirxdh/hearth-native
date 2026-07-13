/**
 * Bundled high-alert medication reference, derived from the ISMP community/
 * ambulatory high-alert classes. Matching is by lowercase substring against
 * the medication name so common brand/generic spellings are caught offline.
 *
 * This list flags for EXTRA CONFIRMATION in the UI; it never blocks care.
 * P22 upgrades matching to RxNorm ingredient classes.
 */

interface HighAlertEntry {
  /** Ingredient or class label shown to the caregiver. */
  label: string;
  /** Lowercase substrings that trigger the flag. */
  patterns: string[];
}

export const HIGH_ALERT_LIST: HighAlertEntry[] = [
  {
    label: 'Anticoagulant (blood thinner)',
    patterns: [
      'warfarin', 'coumadin', 'apixaban', 'eliquis', 'rivaroxaban', 'xarelto',
      'dabigatran', 'pradaxa', 'edoxaban', 'savaysa', 'enoxaparin', 'lovenox',
      'heparin', 'fondaparinux',
    ],
  },
  {
    label: 'Insulin',
    patterns: [
      'insulin', 'lantus', 'humalog', 'novolog', 'levemir', 'tresiba', 'basaglar',
      'glargine', 'lispro', 'aspart', 'degludec', 'detemir',
    ],
  },
  {
    label: 'Oral hypoglycemic (sulfonylurea)',
    patterns: ['glipizide', 'glyburide', 'glimepiride', 'chlorpropamide'],
  },
  {
    label: 'Opioid',
    patterns: [
      'oxycodone', 'oxycontin', 'hydrocodone', 'vicodin', 'norco', 'morphine',
      'fentanyl', 'hydromorphone', 'dilaudid', 'methadone', 'tramadol', 'codeine',
      'buprenorphine',
    ],
  },
  { label: 'Methotrexate (non-oncologic)', patterns: ['methotrexate', 'trexall'] },
  { label: 'Digoxin', patterns: ['digoxin', 'lanoxin', 'digitek'] },
  { label: 'Lithium', patterns: ['lithium', 'lithobid'] },
  { label: 'Immunosuppressant', patterns: ['tacrolimus', 'prograf', 'cyclosporine', 'azathioprine', 'imuran', 'mycophenolate', 'cellcept'] },
  { label: 'Antiarrhythmic', patterns: ['amiodarone', 'pacerone', 'sotalol', 'betapace', 'flecainide', 'dofetilide', 'tikosyn'] },
  { label: 'Chemotherapy (oral)', patterns: ['capecitabine', 'xeloda', 'temozolomide', 'temodar', 'imatinib', 'gleevec'] },
];

export interface HighAlertMatch {
  label: string;
  matched: string;
}

export function highAlertMatch(medicationName: string): HighAlertMatch | null {
  const name = medicationName.toLowerCase();
  for (const entry of HIGH_ALERT_LIST) {
    for (const p of entry.patterns) {
      if (name.includes(p)) return { label: entry.label, matched: p };
    }
  }
  return null;
}

export function isHighAlert(medicationName: string): boolean {
  return highAlertMatch(medicationName) !== null;
}
