/**
 * Bundled offline RxNorm subset for P22 scan-confirm matching.
 *
 * Curated list of the most-dispensed US generics for older adults. Each
 * entry carries an ingredient-level RXCUI where the value is confidently
 * known; entries whose RXCUI still needs to be checked against the RxNorm
 * API carried the sentinel 'pending-verify' until resolved against the live
 * NLM RxNav API (2026-07-14); every entry now has a verified
 * number. Names and ingredients are lowercase, matching RxNorm's own
 * ingredient naming. Strengths are common US dispensed strengths, for
 * display in the confirm UI only.
 *
 * highAlertClass follows the ISMP high-alert medication categories that
 * matter in a home-care setting. null means the drug is not on the ISMP
 * community/ambulatory high-alert list (antiplatelets, corticosteroids,
 * and non-sulfonylurea diabetes drugs are intentionally null).
 */

export type HighAlertClass =
  | 'anticoagulant'
  | 'insulin'
  | 'opioid'
  | 'hypoglycemic'
  | 'immunosuppressant'
  | 'chemotherapy'
  | 'sedative';

export type RxEntry = {
  /** Ingredient-level RXCUI, verified against the live NLM RxNav API. */
  rxcui: string;
  name: string;
  ingredient: string;
  strengths: string[];
  highAlertClass: HighAlertClass | null;
};

export const RXNORM_SUBSET: RxEntry[] = [
  // Blood pressure and heart
  { rxcui: '29046', name: 'lisinopril', ingredient: 'lisinopril', strengths: ['2.5 mg', '5 mg', '10 mg', '20 mg', '40 mg'], highAlertClass: null },
  { rxcui: '3827', name: 'enalapril', ingredient: 'enalapril', strengths: ['2.5 mg', '5 mg', '10 mg', '20 mg'], highAlertClass: null },
  { rxcui: '35296', name: 'ramipril', ingredient: 'ramipril', strengths: ['2.5 mg', '5 mg', '10 mg'], highAlertClass: null },
  { rxcui: '52175', name: 'losartan', ingredient: 'losartan', strengths: ['25 mg', '50 mg', '100 mg'], highAlertClass: null },
  { rxcui: '69749', name: 'valsartan', ingredient: 'valsartan', strengths: ['40 mg', '80 mg', '160 mg', '320 mg'], highAlertClass: null },
  { rxcui: '17767', name: 'amlodipine', ingredient: 'amlodipine', strengths: ['2.5 mg', '5 mg', '10 mg'], highAlertClass: null },
  { rxcui: '7417', name: 'nifedipine', ingredient: 'nifedipine', strengths: ['30 mg', '60 mg', '90 mg'], highAlertClass: null },
  { rxcui: '3443', name: 'diltiazem', ingredient: 'diltiazem', strengths: ['120 mg', '180 mg', '240 mg'], highAlertClass: null },
  { rxcui: '6918', name: 'metoprolol', ingredient: 'metoprolol', strengths: ['25 mg', '50 mg', '100 mg', '200 mg'], highAlertClass: null },
  { rxcui: '1202', name: 'atenolol', ingredient: 'atenolol', strengths: ['25 mg', '50 mg', '100 mg'], highAlertClass: null },
  { rxcui: '20352', name: 'carvedilol', ingredient: 'carvedilol', strengths: ['3.125 mg', '6.25 mg', '12.5 mg', '25 mg'], highAlertClass: null },
  { rxcui: '8787', name: 'propranolol', ingredient: 'propranolol', strengths: ['10 mg', '20 mg', '40 mg', '80 mg'], highAlertClass: null },
  { rxcui: '4603', name: 'furosemide', ingredient: 'furosemide', strengths: ['20 mg', '40 mg', '80 mg'], highAlertClass: null },
  { rxcui: '5487', name: 'hydrochlorothiazide', ingredient: 'hydrochlorothiazide', strengths: ['12.5 mg', '25 mg', '50 mg'], highAlertClass: null },
  { rxcui: '2409', name: 'chlorthalidone', ingredient: 'chlorthalidone', strengths: ['25 mg', '50 mg'], highAlertClass: null },
  { rxcui: '9997', name: 'spironolactone', ingredient: 'spironolactone', strengths: ['25 mg', '50 mg', '100 mg'], highAlertClass: null },
  { rxcui: '703', name: 'amiodarone', ingredient: 'amiodarone', strengths: ['100 mg', '200 mg', '400 mg'], highAlertClass: null },
  { rxcui: '3407', name: 'digoxin', ingredient: 'digoxin', strengths: ['0.125 mg', '0.25 mg'], highAlertClass: null },
  { rxcui: '2599', name: 'clonidine', ingredient: 'clonidine', strengths: ['0.1 mg', '0.2 mg', '0.3 mg'], highAlertClass: null },
  { rxcui: '4917', name: 'nitroglycerin', ingredient: 'nitroglycerin', strengths: ['0.4 mg'], highAlertClass: null },
  { rxcui: '8591', name: 'potassium chloride', ingredient: 'potassium chloride', strengths: ['10 mEq', '20 mEq'], highAlertClass: null },

  // Cholesterol
  { rxcui: '83367', name: 'atorvastatin', ingredient: 'atorvastatin', strengths: ['10 mg', '20 mg', '40 mg', '80 mg'], highAlertClass: null },
  { rxcui: '36567', name: 'simvastatin', ingredient: 'simvastatin', strengths: ['5 mg', '10 mg', '20 mg', '40 mg'], highAlertClass: null },
  { rxcui: '301542', name: 'rosuvastatin', ingredient: 'rosuvastatin', strengths: ['5 mg', '10 mg', '20 mg', '40 mg'], highAlertClass: null },
  { rxcui: '42463', name: 'pravastatin', ingredient: 'pravastatin', strengths: ['10 mg', '20 mg', '40 mg', '80 mg'], highAlertClass: null },
  { rxcui: '341248', name: 'ezetimibe', ingredient: 'ezetimibe', strengths: ['10 mg'], highAlertClass: null },

  // Blood thinners and antiplatelets
  { rxcui: '11289', name: 'warfarin', ingredient: 'warfarin', strengths: ['1 mg', '2 mg', '2.5 mg', '5 mg', '10 mg'], highAlertClass: 'anticoagulant' },
  { rxcui: '1364430', name: 'apixaban', ingredient: 'apixaban', strengths: ['2.5 mg', '5 mg'], highAlertClass: 'anticoagulant' },
  { rxcui: '1114195', name: 'rivaroxaban', ingredient: 'rivaroxaban', strengths: ['10 mg', '15 mg', '20 mg'], highAlertClass: 'anticoagulant' },
  { rxcui: '1037042', name: 'dabigatran etexilate', ingredient: 'dabigatran etexilate', strengths: ['75 mg', '110 mg', '150 mg'], highAlertClass: 'anticoagulant' },
  { rxcui: '67108', name: 'enoxaparin', ingredient: 'enoxaparin', strengths: ['40 mg/0.4 mL', '80 mg/0.8 mL'], highAlertClass: 'anticoagulant' },
  { rxcui: '32968', name: 'clopidogrel', ingredient: 'clopidogrel', strengths: ['75 mg'], highAlertClass: null },
  { rxcui: '1191', name: 'aspirin', ingredient: 'aspirin', strengths: ['81 mg', '325 mg'], highAlertClass: null },

  // Diabetes
  { rxcui: '6809', name: 'metformin', ingredient: 'metformin', strengths: ['500 mg', '850 mg', '1000 mg'], highAlertClass: null },
  { rxcui: '4821', name: 'glipizide', ingredient: 'glipizide', strengths: ['5 mg', '10 mg'], highAlertClass: 'hypoglycemic' },
  { rxcui: '4815', name: 'glyburide', ingredient: 'glyburide', strengths: ['2.5 mg', '5 mg'], highAlertClass: 'hypoglycemic' },
  { rxcui: '25789', name: 'glimepiride', ingredient: 'glimepiride', strengths: ['1 mg', '2 mg', '4 mg'], highAlertClass: 'hypoglycemic' },
  { rxcui: '33738', name: 'pioglitazone', ingredient: 'pioglitazone', strengths: ['15 mg', '30 mg', '45 mg'], highAlertClass: null },
  { rxcui: '593411', name: 'sitagliptin', ingredient: 'sitagliptin', strengths: ['25 mg', '50 mg', '100 mg'], highAlertClass: null },
  { rxcui: '1100699', name: 'linagliptin', ingredient: 'linagliptin', strengths: ['5 mg'], highAlertClass: null },
  { rxcui: '1545653', name: 'empagliflozin', ingredient: 'empagliflozin', strengths: ['10 mg', '25 mg'], highAlertClass: null },
  { rxcui: '1488564', name: 'dapagliflozin', ingredient: 'dapagliflozin', strengths: ['5 mg', '10 mg'], highAlertClass: null },
  { rxcui: '1991302', name: 'semaglutide', ingredient: 'semaglutide', strengths: ['0.25 mg', '0.5 mg', '1 mg', '2 mg'], highAlertClass: null },
  { rxcui: '475968', name: 'liraglutide', ingredient: 'liraglutide', strengths: ['6 mg/mL'], highAlertClass: null },
  { rxcui: '1551291', name: 'dulaglutide', ingredient: 'dulaglutide', strengths: ['0.75 mg/0.5 mL', '1.5 mg/0.5 mL'], highAlertClass: null },
  { rxcui: '274783', name: 'insulin glargine', ingredient: 'insulin glargine', strengths: ['100 units/mL', '300 units/mL'], highAlertClass: 'insulin' },
  { rxcui: '86009', name: 'insulin lispro', ingredient: 'insulin lispro', strengths: ['100 units/mL', '200 units/mL'], highAlertClass: 'insulin' },
  { rxcui: '51428', name: 'insulin aspart', ingredient: 'insulin aspart', strengths: ['100 units/mL'], highAlertClass: 'insulin' },
  { rxcui: '139825', name: 'insulin detemir', ingredient: 'insulin detemir', strengths: ['100 units/mL'], highAlertClass: 'insulin' },

  // Thyroid and steroids
  { rxcui: '10582', name: 'levothyroxine', ingredient: 'levothyroxine', strengths: ['25 mcg', '50 mcg', '75 mcg', '100 mcg', '125 mcg', '150 mcg'], highAlertClass: null },
  { rxcui: '8640', name: 'prednisone', ingredient: 'prednisone', strengths: ['1 mg', '5 mg', '10 mg', '20 mg'], highAlertClass: null },

  // Stomach and nausea
  { rxcui: '7646', name: 'omeprazole', ingredient: 'omeprazole', strengths: ['20 mg', '40 mg'], highAlertClass: null },
  { rxcui: '40790', name: 'pantoprazole', ingredient: 'pantoprazole', strengths: ['20 mg', '40 mg'], highAlertClass: null },
  { rxcui: '283742', name: 'esomeprazole', ingredient: 'esomeprazole', strengths: ['20 mg', '40 mg'], highAlertClass: null },
  { rxcui: '4278', name: 'famotidine', ingredient: 'famotidine', strengths: ['20 mg', '40 mg'], highAlertClass: null },
  { rxcui: '26225', name: 'ondansetron', ingredient: 'ondansetron', strengths: ['4 mg', '8 mg'], highAlertClass: null },

  // Mood and mental health
  { rxcui: '36437', name: 'sertraline', ingredient: 'sertraline', strengths: ['25 mg', '50 mg', '100 mg'], highAlertClass: null },
  { rxcui: '4493', name: 'fluoxetine', ingredient: 'fluoxetine', strengths: ['10 mg', '20 mg', '40 mg'], highAlertClass: null },
  { rxcui: '2556', name: 'citalopram', ingredient: 'citalopram', strengths: ['10 mg', '20 mg', '40 mg'], highAlertClass: null },
  { rxcui: '321988', name: 'escitalopram', ingredient: 'escitalopram', strengths: ['5 mg', '10 mg', '20 mg'], highAlertClass: null },
  { rxcui: '72625', name: 'duloxetine', ingredient: 'duloxetine', strengths: ['20 mg', '30 mg', '60 mg'], highAlertClass: null },
  { rxcui: '39786', name: 'venlafaxine', ingredient: 'venlafaxine', strengths: ['37.5 mg', '75 mg', '150 mg'], highAlertClass: null },
  { rxcui: '42347', name: 'bupropion', ingredient: 'bupropion', strengths: ['75 mg', '100 mg', '150 mg', '300 mg'], highAlertClass: null },
  { rxcui: '15996', name: 'mirtazapine', ingredient: 'mirtazapine', strengths: ['7.5 mg', '15 mg', '30 mg', '45 mg'], highAlertClass: null },
  { rxcui: '10737', name: 'trazodone', ingredient: 'trazodone', strengths: ['50 mg', '100 mg', '150 mg'], highAlertClass: null },
  { rxcui: '51272', name: 'quetiapine', ingredient: 'quetiapine', strengths: ['25 mg', '50 mg', '100 mg', '200 mg'], highAlertClass: null },
  { rxcui: '35636', name: 'risperidone', ingredient: 'risperidone', strengths: ['0.5 mg', '1 mg', '2 mg'], highAlertClass: null },
  { rxcui: '89013', name: 'aripiprazole', ingredient: 'aripiprazole', strengths: ['2 mg', '5 mg', '10 mg', '15 mg'], highAlertClass: null },

  // Sleep and anxiety (Beers-list sedatives, flagged for older adults)
  { rxcui: '596', name: 'alprazolam', ingredient: 'alprazolam', strengths: ['0.25 mg', '0.5 mg', '1 mg', '2 mg'], highAlertClass: 'sedative' },
  { rxcui: '6470', name: 'lorazepam', ingredient: 'lorazepam', strengths: ['0.5 mg', '1 mg', '2 mg'], highAlertClass: 'sedative' },
  { rxcui: '2598', name: 'clonazepam', ingredient: 'clonazepam', strengths: ['0.5 mg', '1 mg', '2 mg'], highAlertClass: 'sedative' },
  { rxcui: '3322', name: 'diazepam', ingredient: 'diazepam', strengths: ['2 mg', '5 mg', '10 mg'], highAlertClass: 'sedative' },
  { rxcui: '10355', name: 'temazepam', ingredient: 'temazepam', strengths: ['15 mg', '30 mg'], highAlertClass: 'sedative' },
  { rxcui: '39993', name: 'zolpidem', ingredient: 'zolpidem', strengths: ['5 mg', '10 mg'], highAlertClass: 'sedative' },
  { rxcui: '461016', name: 'eszopiclone', ingredient: 'eszopiclone', strengths: ['1 mg', '2 mg', '3 mg'], highAlertClass: 'sedative' },

  // Memory, seizures, and nerve pain
  { rxcui: '135446', name: 'donepezil', ingredient: 'donepezil', strengths: ['5 mg', '10 mg', '23 mg'], highAlertClass: null },
  { rxcui: '6719', name: 'memantine', ingredient: 'memantine', strengths: ['5 mg', '10 mg', '28 mg'], highAlertClass: null },
  { rxcui: '183379', name: 'rivastigmine', ingredient: 'rivastigmine', strengths: ['1.5 mg', '3 mg', '4.5 mg', '6 mg'], highAlertClass: null },
  { rxcui: '2690627', name: 'galantamine', ingredient: 'galantamine', strengths: ['4 mg', '8 mg', '12 mg'], highAlertClass: null },
  { rxcui: '25480', name: 'gabapentin', ingredient: 'gabapentin', strengths: ['100 mg', '300 mg', '400 mg', '600 mg', '800 mg'], highAlertClass: null },
  { rxcui: '187832', name: 'pregabalin', ingredient: 'pregabalin', strengths: ['25 mg', '50 mg', '75 mg', '150 mg'], highAlertClass: null },
  { rxcui: '114477', name: 'levetiracetam', ingredient: 'levetiracetam', strengths: ['250 mg', '500 mg', '750 mg', '1000 mg'], highAlertClass: null },
  { rxcui: '28439', name: 'lamotrigine', ingredient: 'lamotrigine', strengths: ['25 mg', '100 mg', '150 mg', '200 mg'], highAlertClass: null },
  { rxcui: '103990', name: 'carbidopa-levodopa', ingredient: 'carbidopa-levodopa', strengths: ['10-100 mg', '25-100 mg', '25-250 mg'], highAlertClass: null },

  // Pain
  { rxcui: '10689', name: 'tramadol', ingredient: 'tramadol', strengths: ['50 mg', '100 mg'], highAlertClass: 'opioid' },
  { rxcui: '7804', name: 'oxycodone', ingredient: 'oxycodone', strengths: ['5 mg', '10 mg', '15 mg', '20 mg', '30 mg'], highAlertClass: 'opioid' },
  { rxcui: '214182', name: 'hydrocodone-acetaminophen', ingredient: 'hydrocodone-acetaminophen', strengths: ['5-325 mg', '7.5-325 mg', '10-325 mg'], highAlertClass: 'opioid' },
  { rxcui: '7052', name: 'morphine', ingredient: 'morphine', strengths: ['15 mg', '30 mg', '60 mg'], highAlertClass: 'opioid' },
  { rxcui: '3423', name: 'hydromorphone', ingredient: 'hydromorphone', strengths: ['2 mg', '4 mg', '8 mg'], highAlertClass: 'opioid' },
  { rxcui: '4337', name: 'fentanyl', ingredient: 'fentanyl', strengths: ['12 mcg/hr', '25 mcg/hr', '50 mcg/hr'], highAlertClass: 'opioid' },
  { rxcui: '2670', name: 'codeine', ingredient: 'codeine', strengths: ['15 mg', '30 mg', '60 mg'], highAlertClass: 'opioid' },
  { rxcui: '1819', name: 'buprenorphine', ingredient: 'buprenorphine', strengths: ['2 mg', '8 mg'], highAlertClass: 'opioid' },
  { rxcui: '161', name: 'acetaminophen', ingredient: 'acetaminophen', strengths: ['325 mg', '500 mg', '650 mg'], highAlertClass: null },
  { rxcui: '5640', name: 'ibuprofen', ingredient: 'ibuprofen', strengths: ['200 mg', '400 mg', '600 mg', '800 mg'], highAlertClass: null },
  { rxcui: '7258', name: 'naproxen', ingredient: 'naproxen', strengths: ['220 mg', '250 mg', '375 mg', '500 mg'], highAlertClass: null },
  { rxcui: '41493', name: 'meloxicam', ingredient: 'meloxicam', strengths: ['7.5 mg', '15 mg'], highAlertClass: null },
  { rxcui: '140587', name: 'celecoxib', ingredient: 'celecoxib', strengths: ['100 mg', '200 mg'], highAlertClass: null },
  { rxcui: '21949', name: 'cyclobenzaprine', ingredient: 'cyclobenzaprine', strengths: ['5 mg', '10 mg'], highAlertClass: null },

  // Breathing and allergy
  { rxcui: '435', name: 'albuterol', ingredient: 'albuterol', strengths: ['90 mcg/actuation', '2.5 mg/3 mL'], highAlertClass: null },
  { rxcui: '88249', name: 'montelukast', ingredient: 'montelukast', strengths: ['4 mg', '5 mg', '10 mg'], highAlertClass: null },
  { rxcui: '41126', name: 'fluticasone', ingredient: 'fluticasone', strengths: ['50 mcg/actuation'], highAlertClass: null },
  { rxcui: '28889', name: 'loratadine', ingredient: 'loratadine', strengths: ['10 mg'], highAlertClass: null },
  { rxcui: '20610', name: 'cetirizine', ingredient: 'cetirizine', strengths: ['5 mg', '10 mg'], highAlertClass: null },
  { rxcui: '5553', name: 'hydroxyzine', ingredient: 'hydroxyzine', strengths: ['10 mg', '25 mg', '50 mg'], highAlertClass: null },
  { rxcui: '6676', name: 'meclizine', ingredient: 'meclizine', strengths: ['12.5 mg', '25 mg'], highAlertClass: null },

  // Antibiotics
  { rxcui: '723', name: 'amoxicillin', ingredient: 'amoxicillin', strengths: ['250 mg', '500 mg', '875 mg'], highAlertClass: null },
  { rxcui: '18631', name: 'azithromycin', ingredient: 'azithromycin', strengths: ['250 mg', '500 mg'], highAlertClass: null },
  { rxcui: '2231', name: 'cephalexin', ingredient: 'cephalexin', strengths: ['250 mg', '500 mg'], highAlertClass: null },
  { rxcui: '2551', name: 'ciprofloxacin', ingredient: 'ciprofloxacin', strengths: ['250 mg', '500 mg', '750 mg'], highAlertClass: null },
  { rxcui: '3640', name: 'doxycycline', ingredient: 'doxycycline', strengths: ['50 mg', '100 mg'], highAlertClass: null },
  { rxcui: '7454', name: 'nitrofurantoin', ingredient: 'nitrofurantoin', strengths: ['50 mg', '100 mg'], highAlertClass: null },

  // Bladder, prostate, bone, gout, eyes, vitamins
  { rxcui: '77492', name: 'tamsulosin', ingredient: 'tamsulosin', strengths: ['0.4 mg'], highAlertClass: null },
  { rxcui: '25025', name: 'finasteride', ingredient: 'finasteride', strengths: ['1 mg', '5 mg'], highAlertClass: null },
  { rxcui: '7512', name: 'oxybutynin', ingredient: 'oxybutynin', strengths: ['5 mg', '10 mg'], highAlertClass: null },
  { rxcui: '519', name: 'allopurinol', ingredient: 'allopurinol', strengths: ['100 mg', '300 mg'], highAlertClass: null },
  { rxcui: '46041', name: 'alendronate', ingredient: 'alendronate', strengths: ['35 mg', '70 mg'], highAlertClass: null },
  { rxcui: '43611', name: 'latanoprost', ingredient: 'latanoprost', strengths: ['0.005%'], highAlertClass: null },
  { rxcui: '10600', name: 'timolol', ingredient: 'timolol', strengths: ['0.25%', '0.5%'], highAlertClass: null },
  { rxcui: '2418', name: 'cholecalciferol', ingredient: 'cholecalciferol', strengths: ['1000 units', '2000 units', '5000 units'], highAlertClass: null },

  // Immunosuppressants and related
  { rxcui: '6851', name: 'methotrexate', ingredient: 'methotrexate', strengths: ['2.5 mg'], highAlertClass: 'chemotherapy' },
  { rxcui: '1256', name: 'azathioprine', ingredient: 'azathioprine', strengths: ['50 mg'], highAlertClass: 'immunosuppressant' },
  { rxcui: '68149', name: 'mycophenolate mofetil', ingredient: 'mycophenolate mofetil', strengths: ['250 mg', '500 mg'], highAlertClass: 'immunosuppressant' },
  { rxcui: '42316', name: 'tacrolimus', ingredient: 'tacrolimus', strengths: ['0.5 mg', '1 mg', '5 mg'], highAlertClass: 'immunosuppressant' },
];
