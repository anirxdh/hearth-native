import { WorkflowBuilder } from '../builder';
import { textVal } from '../values';

/**
 * Claim Denial Appeal Builder - the P25 proving fixture and the highest-value
 * paperwork automation. Graph shape (each arrow is an inputNodeId wire):
 *
 *   [File Input: denial letter] -> [Document Text Extract] ─┐
 *   [Text Input: denial reason] ────────────────────────────┤
 *   [Patient Record Pull] ──────────────────────────────────┼-> [Human Confirm] -> [Form Fill] -> [Document Render]
 *   [Text Input: claim number] ─────────────────────────────┘
 */

const APPEAL_TEMPLATE = `To the Appeals Department,

RE: Appeal of claim denial
Patient: {fullName} (DOB {dob})
Claim number: {Claim number}
Denial reason as stated: {Denial reason}

I am writing on behalf of {fullName} to formally appeal the denial of the above claim.

The denial letter states: "{Denial reason}". Based on the patient's record and the attached documentation, this service was medically necessary and properly ordered by the treating clinician. The relevant conditions on record are: {conditions}.

The full text of the denial letter is attached below for reference, together with supporting records.

I request a full review of this decision and a written response within the timeframe required by the plan and applicable law. Please contact me for any additional documentation.

Sincerely,
{caregiverLine}

----------------------------------------
ATTACHMENT: Denial letter (as read)
{Denial letter text}`;

export function claimDenialAppeal(now: string) {
  const b = new WorkflowBuilder({
    key: 'claim-denial-appeal',
    name: 'Claim Denial Appeal Builder',
    description:
      'Turns a denial letter into a complete, mail-ready appeal. You confirm every fact before anything is written.',
    category: 'Insurance & benefits',
    estMinutes: 12,
    replacesHours: 'replaces ~3.5 hrs',
    version: 1,
  });

  const denialFile = b.node('File Input', 'Upload the denial letter', { x: 40, y: 40 }, {}, {
    Value: 'Denial letter or EOB',
  });
  const extract = b.node('Document Text Extract', 'Read the denial', { x: 300, y: 40 });
  const reason = b.node('Text Input', 'Denial reason code or sentence', { x: 40, y: 200 }, {}, {
    Value: 'Denial reason (from the letter)',
  });
  const claimNo = b.node('Text Input', 'Claim number', { x: 40, y: 320 }, {}, {
    Value: 'Claim number',
  });
  const record = b.node(
    'Patient Record Pull',
    'Pull patient facts',
    { x: 300, y: 200 },
    { Fields: [textVal('fullName, dob, conditions, caregiverLine')] },
  );
  const gate = b.node(
    'Human Confirm',
    'Review every fact',
    { x: 560, y: 120 },
    { Prompt: [textVal('Check each value against the letter. Nothing is written until you confirm.')] },
  );
  const fill = b.node(
    'Form Fill',
    'Assemble the appeal',
    { x: 820, y: 120 },
    { Template: [textVal(APPEAL_TEMPLATE)] },
  );
  const render = b.node(
    'Document Render',
    'Appeal letter',
    { x: 1080, y: 120 },
    {
      Title: [textVal('Claim denial appeal')],
      'Output Kind': [textVal('letter')],
    },
  );

  b.wire(denialFile, extract, 'Document');
  // EVERY fact flows through the gate: names become keys of the confirm bundle
  b.wire(extract, gate, 'Denial letter text');
  b.wire(reason, gate, 'Denial reason');
  b.wire(claimNo, gate, 'Claim number');
  b.wire(record, gate, 'Value');
  b.wire(gate, fill, 'Data');
  b.wire(fill, render, 'Body');

  return b;
}
