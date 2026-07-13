/**
 * Daily nutrition targets for older adults: pure lookup arithmetic.
 *
 * Every target comes from published reference intakes (DRI tables and the
 * PROT-AGE consensus on protein for older adults). No inference, no AI, no
 * randomness: the same input always produces the same strings, so a
 * caregiver can trust that the card they saw yesterday says the same thing
 * today.
 *
 * This module is general nutrition guidance for healthy older adults. It is
 * not medical advice, it does not know about kidney disease, heart failure,
 * fluid restrictions, or drug interactions, and it never doses supplements
 * or medications. Care decisions belong with the person's clinician.
 */

export type NutritionInput = { ageYears: number; sex: 'male' | 'female'; weightLb?: number };

export type NutritionRow = { nutrient: string; target: string; why: string };

const KG_PER_LB = 0.45359237;

/** PROT-AGE recommendation for healthy older adults, grams per kg per day. */
const PROTEIN_G_PER_KG = { low: 1.0, high: 1.2 } as const;

/** General fluid guidance: about 30 mL per kg, never below 1.5 L per day. */
const FLUID_ML_PER_KG = 30;
const FLUID_FLOOR_ML = 1500;

/** Format liters without a trailing ".0" (2 L, not 2.0 L). */
function formatLiters(liters: number): string {
  return liters % 1 === 0 ? String(liters) : liters.toFixed(1);
}

function proteinTarget(weightLb: number | undefined): string {
  if (weightLb === undefined) {
    // Sensible fixed range when weight is unknown: 1.0 to 1.2 g/kg applied
    // to a typical older-adult weight band of roughly 60 to 80 kg.
    return '65 to 90 g';
  }
  const kg = weightLb * KG_PER_LB;
  const low = Math.round(kg * PROTEIN_G_PER_KG.low);
  const high = Math.round(kg * PROTEIN_G_PER_KG.high);
  return `${low} to ${high} g`;
}

function fluidTarget(weightLb: number | undefined): string {
  if (weightLb === undefined) {
    return 'About 1.5 to 2 L';
  }
  const ml = Math.max(weightLb * KG_PER_LB * FLUID_ML_PER_KG, FLUID_FLOOR_ML);
  const liters = Math.round(ml / 100) / 10;
  return `About ${formatLiters(liters)} L`;
}

/** DRI fiber: 30 g men / 21 g women at 51 and over, 38 g / 25 g younger. */
function fiberTarget(ageYears: number, sex: NutritionInput['sex']): string {
  if (ageYears >= 51) return sex === 'male' ? '30 g' : '21 g';
  return sex === 'male' ? '38 g' : '25 g';
}

/**
 * Compute a day's nutrition targets for one older adult.
 *
 * Deterministic: the same input always returns the same rows in the same
 * order. Targets are reference intakes, not prescriptions, and the "why"
 * for each row is one plain sentence a caregiver can read aloud.
 */
export function dailyNeeds(input: NutritionInput): NutritionRow[] {
  const { ageYears, sex, weightLb } = input;
  if (!Number.isFinite(ageYears) || ageYears < 0) {
    throw new Error(`Invalid age: ${ageYears}`);
  }
  if (weightLb !== undefined && (!Number.isFinite(weightLb) || weightLb <= 0)) {
    throw new Error(`Invalid weight: ${weightLb}`);
  }

  return [
    {
      nutrient: 'Protein',
      target: proteinTarget(weightLb),
      why: 'Protein helps maintain muscle and strength, which protects against falls and speeds recovery from illness.',
    },
    {
      nutrient: 'Fluids',
      target: fluidTarget(weightLb),
      why: 'Thirst fades with age, so steady sips through the day help prevent dehydration and urinary infections.',
    },
    {
      nutrient: 'Fiber',
      target: fiberTarget(ageYears, sex),
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
      target: ageYears >= 70 ? '800 IU' : '600 IU',
      why: 'Vitamin D helps the body absorb calcium and supports muscle strength, and skin makes less of it with age.',
    },
    {
      nutrient: 'Vitamin B12',
      target: '2.4 mcg',
      why: 'B12 is absorbed less well with age, and running low can look like fatigue or memory trouble.',
    },
    {
      nutrient: 'Potassium',
      target: sex === 'male' ? '3,400 mg' : '2,600 mg',
      why: 'Potassium from foods like fruits, vegetables, and beans helps steady blood pressure.',
    },
  ];
}
