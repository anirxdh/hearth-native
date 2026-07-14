import { WorkflowBuilder } from '../builder';
import { textVal } from '../values';

/**
 * Medicaid Renewal Packet - a cover letter plus a checklist so nothing is
 * missing from the envelope. Graph shape (each arrow is an inputNodeId wire):
 *
 *   [File Input: proof documents] -> [Document Text Extract] ─┐
 *   [Text Input: case or renewal number] ─────────────────────┤
 *   [Text Input: household size] ─────────────────────────────┼-> [Human Confirm] -> [Form Fill] -> [Document Render]
 *   [Text Input: monthly income summary] ─────────────────────┤
 *   [Patient Record Pull] ────────────────────────────────────┘
 */

const RENEWAL_TEMPLATE = `To the Medicaid Renewal Unit,

RE: Medicaid renewal
Case or renewal number: {Case or renewal number}
Member: {fullName} (DOB {dob})

Please find enclosed the renewal paperwork and proof documents for the member named above. I am submitting this packet on the member's behalf as their caregiver.

Household size: {Household size}
Monthly income summary: {Monthly income summary}

The proof documents submitted with this renewal are listed in the checklist below, and the text read from the uploaded copies is attached for reference. Please contact me directly if anything further is required so that coverage continues without interruption.

Sincerely,
{caregiverLine}

----------------------------------------
DOCUMENT CHECKLIST (mark each item as it goes into the envelope)

[ ] Signed renewal form
[ ] Proof of income for every earner in the household
[ ] Proof of address (utility bill or lease)
[ ] Copies of insurance cards, front and back
[ ] Award letters, if any (Social Security, pension, unemployment)
[ ] This cover letter, placed on top of the packet

----------------------------------------
ATTACHMENT: Proof documents (as read)
{Proof documents text}`;

export function medicaidRenewal(now: string) {
  const b = new WorkflowBuilder({
    key: 'medicaid-renewal',
    name: 'Medicaid Renewal Packet',
    description:
      'Assembles a renewal cover letter and a document checklist so coverage does not lapse. You confirm every fact before anything is written.',
    category: 'Insurance & benefits',
    estMinutes: 12,
    replacesHours: 'replaces ~3 hrs',
    version: 1,
  });

  const proofFile = b.node('File Input', 'Upload the proof documents', { x: 40, y: 40 }, {}, {
    Value: 'Proof documents (pay stubs, award letters)',
  });
  const extract = b.node('Document Text Extract', 'Read the documents', { x: 300, y: 40 });
  const caseNo = b.node('Text Input', 'Case or renewal number', { x: 40, y: 140 }, {}, {
    Value: 'Case or renewal number',
  });
  const household = b.node('Text Input', 'People in the household', { x: 40, y: 240 }, {}, {
    Value: 'Household size',
  });
  const income = b.node('Text Input', 'Income each month', { x: 40, y: 340 }, {}, {
    Value: 'Monthly income summary',
  });
  const record = b.node(
    'Patient Record Pull',
    'Pull patient facts',
    { x: 300, y: 200 },
    { Fields: [textVal('fullName, dob, caregiverLine')] },
  );
  const gate = b.node(
    'Human Confirm',
    'Review every fact',
    { x: 560, y: 170 },
    { Prompt: [textVal('Check the case number, household size, and income against your paperwork. Nothing is written until you confirm.')] },
  );
  const fill = b.node(
    'Form Fill',
    'Assemble the packet',
    { x: 820, y: 170 },
    { Template: [textVal(RENEWAL_TEMPLATE)] },
  );
  const render = b.node(
    'Document Render',
    'Renewal cover letter and checklist',
    { x: 1080, y: 170 },
    {
      Title: [textVal('Medicaid renewal packet')],
      'Output Kind': [textVal('packet')],
    },
  );

  b.wire(proofFile, extract, 'Document');
  // EVERY fact flows through the gate: names become keys of the confirm bundle
  b.wire(extract, gate, 'Proof documents text');
  b.wire(caseNo, gate, 'Case or renewal number');
  b.wire(household, gate, 'Household size');
  b.wire(income, gate, 'Monthly income summary');
  b.wire(record, gate, 'Value');
  b.wire(gate, fill, 'Data');
  b.wire(fill, render, 'Body');

  return b;
}
