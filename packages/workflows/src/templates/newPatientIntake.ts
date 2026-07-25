import { WorkflowBuilder } from '../builder';
import { jsonVal, textVal } from '../values';

/**
 * New Patient Intake - collects the basics for a freshly created (shell)
 * patient and saves them into the RUA record. The sink is Record Write,
 * not Document Render: nothing is printed, the record itself is updated.
 * Graph shape (each arrow is an inputNodeId wire):
 *
 *   [Text Input: full name] ────────┐
 *   [Text Input: date of birth] ────┤
 *   [Text Input: conditions] ───────┼-> [Human Confirm] -> [Record Write]
 *   [Text Input: allergies] ────────┤
 *   [Text Input: primary pharmacy] ─┘
 *
 * Wire names into the gate are the record field names, so the confirmed
 * bundle is exactly the object written to the patient record.
 */

export function newPatientIntake(now: string) {
  const b = new WorkflowBuilder({
    key: 'new-patient-intake',
    name: 'New Patient Intake',
    description:
      'Collects the basics for a new person and saves them to the record. You review and confirm every detail before anything is saved.',
    category: 'Onboarding',
    estMinutes: 6,
    replacesHours: 'replaces ~1 hr',
    version: 1,
  });

  const fullName = b.node('Text Input', 'Their full name', { x: 40, y: 40 }, {}, {
    Value: 'Full name',
  });
  const dob = b.node('Text Input', 'Their date of birth', { x: 40, y: 115 }, {}, {
    Value: 'Date of birth',
  });
  const conditions = b.node('Text Input', 'Conditions they live with', { x: 40, y: 190 }, {}, {
    Value: 'Conditions (comma separated)',
  });
  const allergies = b.node('Text Input', 'Allergies to record', { x: 40, y: 265 }, {}, {
    Value: 'Allergies (comma separated)',
  });
  const pharmacy = b.node('Text Input', 'Where prescriptions are filled', { x: 40, y: 340 }, {}, {
    Value: 'Primary pharmacy',
  });
  const gate = b.node(
    'Human Confirm',
    'Review before saving',
    { x: 560, y: 190 },
    {
      // The Value slot is satisfied with an empty bundle; every fact arrives
      // on a named wire below so the confirmed keys match the record fields.
      Value: [jsonVal({})],
      Prompt: [textVal('Check the spelling, the date of birth, and the allergy list. Nothing is saved until you confirm.')],
    },
  );
  const write = b.node(
    'Record Write',
    'Save to the record',
    { x: 900, y: 190 },
    {
      Prompt: [textVal('Saves the confirmed name, date of birth, conditions, allergies, and primary pharmacy to this person\'s RUA record.')],
    },
  );

  // EVERY fact flows through the gate: names become keys of the confirm
  // bundle, and the bundle is written to the record as-is.
  b.wire(fullName, gate, 'fullName');
  b.wire(dob, gate, 'dob');
  b.wire(conditions, gate, 'conditions');
  b.wire(allergies, gate, 'allergies');
  b.wire(pharmacy, gate, 'primaryPharmacy');
  b.wire(gate, write, 'Data');

  return b;
}
