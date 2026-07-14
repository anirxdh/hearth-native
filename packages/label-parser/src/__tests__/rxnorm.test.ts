import { RXNORM_SUBSET, type RxEntry } from '../rxnorm';
import { matchRxNorm, normalizeDrugName } from '../match';

const ALLOWED_CLASSES = new Set([
  'anticoagulant',
  'insulin',
  'opioid',
  'hypoglycemic',
  'immunosuppressant',
  'chemotherapy',
  'sedative',
]);

function byName(name: string): RxEntry | undefined {
  return RXNORM_SUBSET.find((e) => e.name === name);
}

describe('RXNORM_SUBSET integrity', () => {
  it('covers roughly 120 generics', () => {
    expect(RXNORM_SUBSET.length).toBeGreaterThanOrEqual(115);
    expect(RXNORM_SUBSET.length).toBeLessThanOrEqual(135);
  });

  it('has no duplicate rxcui except the pending-verify sentinel', () => {
    const numeric = RXNORM_SUBSET.map((e) => e.rxcui).filter(
      (c) => c !== 'pending-verify',
    );
    expect(new Set(numeric).size).toBe(numeric.length);
  });

  it('uses only numeric rxcuis or the pending-verify sentinel', () => {
    for (const entry of RXNORM_SUBSET) {
      expect(entry.rxcui).toMatch(/^(\d+|pending-verify)$/);
    }
  });

  it('uses only allowed highAlertClass values', () => {
    for (const entry of RXNORM_SUBSET) {
      if (entry.highAlertClass !== null) {
        expect(ALLOWED_CLASSES.has(entry.highAlertClass)).toBe(true);
      }
    }
  });

  it('has lowercase names and at least one strength per entry', () => {
    for (const entry of RXNORM_SUBSET) {
      expect(entry.name).toBe(entry.name.toLowerCase());
      expect(entry.name.trim().length).toBeGreaterThan(0);
      expect(entry.ingredient).toBe(entry.ingredient.toLowerCase());
      expect(entry.strengths.length).toBeGreaterThan(0);
    }
  });

  it('bundles all ISMP anticoagulants and classes them correctly', () => {
    const anticoagulants = [
      'warfarin',
      'apixaban',
      'rivaroxaban',
      'dabigatran etexilate',
      'enoxaparin',
    ];
    for (const name of anticoagulants) {
      expect(byName(name)?.highAlertClass).toBe('anticoagulant');
    }
  });

  it('bundles all insulins and classes them correctly', () => {
    const insulins = [
      'insulin glargine',
      'insulin lispro',
      'insulin aspart',
      'insulin detemir',
    ];
    for (const name of insulins) {
      expect(byName(name)?.highAlertClass).toBe('insulin');
    }
    for (const entry of RXNORM_SUBSET) {
      if (entry.name.includes('insulin')) {
        expect(entry.highAlertClass).toBe('insulin');
      }
    }
  });

  it('bundles all ISMP opioids and classes them correctly', () => {
    const opioids = [
      'tramadol',
      'oxycodone',
      'hydrocodone-acetaminophen',
      'morphine',
      'hydromorphone',
      'fentanyl',
      'codeine',
      'buprenorphine',
    ];
    for (const name of opioids) {
      expect(byName(name)?.highAlertClass).toBe('opioid');
    }
  });

  it('classes sulfonylureas as hypoglycemic but not metformin', () => {
    expect(byName('glipizide')?.highAlertClass).toBe('hypoglycemic');
    expect(byName('glyburide')?.highAlertClass).toBe('hypoglycemic');
    expect(byName('glimepiride')?.highAlertClass).toBe('hypoglycemic');
    expect(byName('metformin')?.highAlertClass).toBeNull();
  });
});

describe('normalizeDrugName', () => {
  it('strips strength, salt, and form tokens', () => {
    expect(normalizeDrugName('METFORMIN HCL 500MG TABLETS')).toBe('metformin');
    expect(normalizeDrugName('Amlodipine Besylate 10 mg Tablet')).toBe('amlodipine');
    expect(normalizeDrugName('METOPROLOL SUCCINATE ER 50 MG')).toBe('metoprolol');
    expect(normalizeDrugName('INSULIN GLARGINE 100 UNITS/ML')).toBe('insulin glargine');
  });

  it('keeps a leading salt word so potassium chloride still matches', () => {
    expect(normalizeDrugName('POTASSIUM CHLORIDE ER 20 MEQ')).toBe('potassium');
    expect(normalizeDrugName('potassium chloride')).toBe('potassium');
  });
});

describe('matchRxNorm', () => {
  it('matches METFORMIN HCL 500MG exactly to metformin', () => {
    const match = matchRxNorm('METFORMIN HCL 500MG');
    expect(match?.entry.ingredient).toBe('metformin');
    expect(match?.entry.rxcui).toBe('6809');
    expect(match?.confidence).toBe('exact');
  });

  it('matches the OCR misread Metformn as close', () => {
    const match = matchRxNorm('Metformn');
    expect(match?.entry.ingredient).toBe('metformin');
    expect(match?.confidence).toBe('close');
  });

  it('flags apixaban as an anticoagulant', () => {
    const match = matchRxNorm('apixaban');
    expect(match?.confidence).toBe('exact');
    expect(match?.entry.highAlertClass).toBe('anticoagulant');
  });

  it('returns null for unknown gibberish', () => {
    expect(matchRxNorm('XKWQZ BRVN 900')).toBeNull();
    expect(matchRxNorm('')).toBeNull();
    expect(matchRxNorm('500 MG TABLETS')).toBeNull();
  });

  it('matches salt and release variants exactly', () => {
    expect(matchRxNorm('Losartan Potassium 50 mg')?.confidence).toBe('exact');
    expect(matchRxNorm('HYDROCODONE-ACETAMINOPHEN 5-325 MG')?.entry.name).toBe(
      'hydrocodone-acetaminophen',
    );
    expect(matchRxNorm('VENLAFAXINE HCL ER 75 MG CAPSULES')?.entry.name).toBe(
      'venlafaxine',
    );
  });

  it('matches a bare prefix as close', () => {
    const match = matchRxNorm('ATORVA');
    expect(match?.entry.name).toBe('atorvastatin');
    expect(match?.confidence).toBe('close');
  });

  it('is deterministic across calls', () => {
    const a = matchRxNorm('Metformn');
    const b = matchRxNorm('Metformn');
    expect(a?.entry.rxcui).toBe(b?.entry.rxcui);
    expect(a?.confidence).toBe(b?.confidence);
  });
});
