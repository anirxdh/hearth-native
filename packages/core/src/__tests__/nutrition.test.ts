import { NutritionInput, NutritionRow, dailyNeeds } from '../nutrition';

function row(rows: NutritionRow[], nutrient: string): NutritionRow {
  const found = rows.find((r) => r.nutrient === nutrient);
  if (!found) throw new Error(`Missing row: ${nutrient}`);
  return found;
}

// Every expected string below is pinned by hand. If one of these changes,
// a caregiver-facing number changed: treat that as a product decision,
// not a refactor.

describe('dailyNeeds golden fixtures', () => {
  test('81 year old male, 182 lb', () => {
    const input: NutritionInput = { ageYears: 81, sex: 'male', weightLb: 182 };
    expect(dailyNeeds(input)).toEqual([
      {
        nutrient: 'Protein',
        target: '83 to 99 g',
        why: 'Protein helps maintain muscle and strength, which protects against falls and speeds recovery from illness.',
      },
      {
        nutrient: 'Fluids',
        target: 'About 2.5 L',
        why: 'Thirst fades with age, so steady sips through the day help prevent dehydration and urinary infections.',
      },
      {
        nutrient: 'Fiber',
        target: '30 g',
        why: 'Fiber from whole grains, fruits, and vegetables keeps digestion regular and supports heart health.',
      },
      {
        nutrient: 'Sodium',
        target: 'Under 2,300 mg',
        why: 'Keeping salt modest helps manage blood pressure and eases the workload on the heart.',
      },
      {
        nutrient: 'Calcium',
        target: '1,200 mg',
        why: 'Calcium keeps bones strong, which matters most when a fall could mean a fracture.',
      },
      {
        nutrient: 'Vitamin D',
        target: '800 IU',
        why: 'Vitamin D helps the body absorb calcium and supports muscle strength, and skin makes less of it with age.',
      },
      {
        nutrient: 'Vitamin B12',
        target: '2.4 mcg',
        why: 'B12 is absorbed less well with age, and running low can look like fatigue or memory trouble.',
      },
      {
        nutrient: 'Potassium',
        target: '3,400 mg',
        why: 'Potassium from foods like fruits, vegetables, and beans helps steady blood pressure.',
      },
    ]);
  });

  test('78 year old female, no weight recorded', () => {
    const rows = dailyNeeds({ ageYears: 78, sex: 'female' });
    expect(row(rows, 'Protein').target).toBe('65 to 90 g');
    expect(row(rows, 'Fluids').target).toBe('About 1.5 to 2 L');
    expect(row(rows, 'Fiber').target).toBe('21 g');
    expect(row(rows, 'Sodium').target).toBe('Under 2,300 mg');
    expect(row(rows, 'Calcium').target).toBe('1,200 mg');
    expect(row(rows, 'Vitamin D').target).toBe('800 IU');
    expect(row(rows, 'Vitamin B12').target).toBe('2.4 mcg');
    expect(row(rows, 'Potassium').target).toBe('2,600 mg');
  });

  test('74 year old female, 150 lb', () => {
    const rows = dailyNeeds({ ageYears: 74, sex: 'female', weightLb: 150 });
    expect(row(rows, 'Protein').target).toBe('68 to 82 g');
    expect(row(rows, 'Fluids').target).toBe('About 2 L');
    expect(row(rows, 'Fiber').target).toBe('21 g');
    expect(row(rows, 'Sodium').target).toBe('Under 2,300 mg');
    expect(row(rows, 'Calcium').target).toBe('1,200 mg');
    expect(row(rows, 'Vitamin D').target).toBe('800 IU');
    expect(row(rows, 'Vitamin B12').target).toBe('2.4 mcg');
    expect(row(rows, 'Potassium').target).toBe('2,600 mg');
  });
});

describe('vitamin D boundary at 70', () => {
  test('exactly 70 gets 800 IU', () => {
    const rows = dailyNeeds({ ageYears: 70, sex: 'male' });
    expect(row(rows, 'Vitamin D').target).toBe('800 IU');
  });

  test('69 gets 600 IU', () => {
    const rows = dailyNeeds({ ageYears: 69, sex: 'male' });
    expect(row(rows, 'Vitamin D').target).toBe('600 IU');
  });
});

describe('fluid floor', () => {
  test('a low body weight never drops fluids below 1.5 L', () => {
    // 100 lb is about 45.4 kg; 30 mL/kg would be about 1.36 L, below the floor.
    const rows = dailyNeeds({ ageYears: 82, sex: 'female', weightLb: 100 });
    expect(row(rows, 'Fluids').target).toBe('About 1.5 L');
  });

  test('a weight just above the floor computes normally', () => {
    // 120 lb is about 54.4 kg; 30 mL/kg is about 1.63 L, rounded to 1.6 L.
    const rows = dailyNeeds({ ageYears: 82, sex: 'female', weightLb: 120 });
    expect(row(rows, 'Fluids').target).toBe('About 1.6 L');
  });
});

describe('determinism and shape', () => {
  test('same input produces identical output', () => {
    const input: NutritionInput = { ageYears: 81, sex: 'male', weightLb: 182 };
    expect(dailyNeeds(input)).toEqual(dailyNeeds(input));
  });

  test('always returns eight rows in a fixed order', () => {
    const rows = dailyNeeds({ ageYears: 74, sex: 'female', weightLb: 150 });
    expect(rows.map((r) => r.nutrient)).toEqual([
      'Protein',
      'Fluids',
      'Fiber',
      'Sodium',
      'Calcium',
      'Vitamin D',
      'Vitamin B12',
      'Potassium',
    ]);
  });

  test('every why is one plain sentence', () => {
    for (const r of dailyNeeds({ ageYears: 78, sex: 'female' })) {
      expect(r.why).toMatch(/^[A-Z].*\.$/);
      expect(r.why).not.toContain('—');
    }
  });

  test('rejects invalid inputs', () => {
    expect(() => dailyNeeds({ ageYears: -1, sex: 'male' })).toThrow('Invalid age');
    expect(() => dailyNeeds({ ageYears: 80, sex: 'male', weightLb: 0 })).toThrow('Invalid weight');
  });
});
