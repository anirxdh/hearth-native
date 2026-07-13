import { highAlertMatch, isHighAlert } from '../highAlert';

describe('highAlertMatch positives', () => {
  test('apixaban flags as anticoagulant', () => {
    expect(highAlertMatch('apixaban')).toEqual({
      label: 'Anticoagulant (blood thinner)',
      matched: 'apixaban',
    });
  });

  test('brand name Eliquis flags as anticoagulant', () => {
    expect(highAlertMatch('Eliquis 5 mg tablet')).toEqual({
      label: 'Anticoagulant (blood thinner)',
      matched: 'eliquis',
    });
  });

  test('warfarin flags as anticoagulant', () => {
    expect(highAlertMatch('Warfarin Sodium 2 mg')).toEqual({
      label: 'Anticoagulant (blood thinner)',
      matched: 'warfarin',
    });
  });

  test('insulin glargine flags as insulin', () => {
    const m = highAlertMatch('insulin glargine (Lantus) 100 units/mL');
    expect(m).not.toBeNull();
    expect(m!.label).toBe('Insulin');
  });

  test('glargine alone still flags as insulin', () => {
    expect(highAlertMatch('glargine U-100 pen')).toEqual({ label: 'Insulin', matched: 'glargine' });
  });

  test('full dose strings still match by substring', () => {
    expect(isHighAlert('Apixaban 5mg oral tablet, twice daily')).toBe(true);
    expect(isHighAlert('Coumadin 1 mg')).toBe(true);
  });
});

describe('highAlertMatch negatives', () => {
  test.each([
    'metformin 500 mg',
    'lisinopril 10 mg',
    'levothyroxine 75 mcg',
    'atorvastatin 40 mg',
    'donepezil 10 mg',
    'sertraline 50 mg',
    'amlodipine 5 mg',
    'ibuprofen 200 mg',
  ])('%s is not high-alert', (name) => {
    expect(highAlertMatch(name)).toBeNull();
    expect(isHighAlert(name)).toBe(false);
  });

  test('empty and unrelated strings are not high-alert', () => {
    expect(highAlertMatch('')).toBeNull();
    expect(highAlertMatch('vitamin D3 2000 IU')).toBeNull();
  });
});

describe('case insensitivity', () => {
  test('uppercase input matches lowercase patterns', () => {
    expect(highAlertMatch('APIXABAN')).toEqual({
      label: 'Anticoagulant (blood thinner)',
      matched: 'apixaban',
    });
    expect(isHighAlert('ELIQUIS')).toBe(true);
    expect(isHighAlert('INSULIN GLARGINE')).toBe(true);
  });

  test('mixed case matches', () => {
    expect(isHighAlert('WaRfArIn')).toBe(true);
    expect(highAlertMatch('Lantus SoloStar')!.label).toBe('Insulin');
  });

  test('case does not create false positives', () => {
    expect(isHighAlert('METFORMIN')).toBe(false);
    expect(isHighAlert('Levothyroxine')).toBe(false);
    expect(isHighAlert('LISINOPRIL')).toBe(false);
  });
});
