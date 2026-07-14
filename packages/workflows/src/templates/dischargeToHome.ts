import { WorkflowBuilder } from '../builder';
import { textVal } from '../values';

/**
 * Discharge to Home Setup - turns discharge paperwork into a one-page setup
 * sheet: med reconciliation, follow-ups, and warning signs. Graph shape
 * (each arrow is an inputNodeId wire):
 *
 *   [File Input: discharge summary] -> [Document Text Extract] ─┐
 *   [Text Input: discharging facility] ─────────────────────────┤
 *   [Text Input: follow-up appointments] -> [If Else] ──────────┼-> [Human Confirm] -> [Form Fill] -> [Document Render]
 *   [Patient Record Pull] ──────────────────────────────────────┘
 *
 * The If Else covers the common failure mode where the paperwork lists no
 * follow-ups at all: instead of a blank section, the sheet tells the
 * caregiver to call the facility and confirm.
 */

const SETUP_SHEET_TEMPLATE = `DISCHARGE TO HOME SETUP SHEET

Patient: {fullName}
Discharged from: {Discharging facility}

----------------------------------------
MEDICATION RECONCILIATION
Compare the two lists below line by line. If a medication appears in one list but not the other, or a dose differs, call the discharging facility or the primary clinician before giving the next dose.

Medications on record in Hearth:
{medsList}

Medications as stated in the discharge summary:
{Discharge summary text}

----------------------------------------
FOLLOW-UP APPOINTMENTS
{Follow-up plan}

Write each appointment on the calendar today and arrange transportation now, not the day before.

----------------------------------------
WARNING SIGNS: WHEN TO CALL
Call the clinician or the discharging facility right away if any of these appear in the first days home:
- New or worsening pain, fever, or shortness of breath
- Confusion or drowsiness that is new or getting worse
- A wound that is redder, warmer, or draining more than before
- Not eating, not drinking, or not passing urine
- Any medication question you cannot answer from the lists above

If it feels like an emergency, call 911 first.

This sheet was assembled from the discharge paperwork and the Hearth record. Every value above was reviewed and confirmed by the caregiver before printing.`;

export function dischargeToHome(now: string) {
  const b = new WorkflowBuilder({
    key: 'discharge-to-home',
    name: 'Discharge to Home Setup',
    description:
      'Turns discharge paperwork into a clear setup sheet: medication check, follow-ups, and warning signs. You confirm every fact before anything is written.',
    category: 'Care transitions',
    estMinutes: 10,
    replacesHours: 'replaces ~2.5 hrs',
    version: 1,
  });

  const summaryFile = b.node('File Input', 'Upload the discharge summary', { x: 40, y: 40 }, {}, {
    Value: 'Discharge summary document',
  });
  const extract = b.node('Document Text Extract', 'Read the summary', { x: 300, y: 40 });
  const facility = b.node('Text Input', 'Where they were discharged from', { x: 40, y: 150 }, {}, {
    Value: 'Discharging facility',
  });
  const followUp = b.node('Text Input', 'Follow-ups from the paperwork', { x: 40, y: 260 }, {}, {
    Value: 'Follow-up appointments as stated',
  });
  const followUpPlan = b.node(
    'If Else',
    'Cover a missing follow-up list',
    { x: 300, y: 260 },
    {
      LHS: [textVal('{Follow-up appointments}')],
      Condition: [textVal('equals')],
      RHS: [textVal('')],
      Value: [textVal('No follow-up appointments were listed. Call the discharging facility to confirm.')],
      'Else Value': [textVal('{Follow-up appointments}')],
    },
  );
  const record = b.node(
    'Patient Record Pull',
    'Pull patient facts',
    { x: 300, y: 150 },
    { Fields: [textVal('fullName, medsList')] },
  );
  const gate = b.node(
    'Human Confirm',
    'Review every fact',
    { x: 560, y: 150 },
    { Prompt: [textVal('Check the medication lists against the paperwork with special care. Nothing is written until you confirm.')] },
  );
  const fill = b.node(
    'Form Fill',
    'Assemble the setup sheet',
    { x: 820, y: 150 },
    { Template: [textVal(SETUP_SHEET_TEMPLATE)] },
  );
  const render = b.node(
    'Document Render',
    'Setup sheet',
    { x: 1080, y: 150 },
    {
      Title: [textVal('Discharge to home setup sheet')],
      'Output Kind': [textVal('form')],
    },
  );

  b.wire(summaryFile, extract, 'Document');
  b.wire(followUp, followUpPlan, 'Follow-up appointments');
  // EVERY fact flows through the gate: names become keys of the confirm bundle
  b.wire(extract, gate, 'Discharge summary text');
  b.wire(facility, gate, 'Discharging facility');
  b.wire(followUpPlan, gate, 'Follow-up plan');
  b.wire(record, gate, 'Value');
  b.wire(gate, fill, 'Data');
  b.wire(fill, render, 'Body');

  return b;
}
