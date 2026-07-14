import { WorkflowBuilder } from '../builder';
import { textVal } from '../values';

/**
 * HIPAA Records Release - a signature-ready authorization letter so records
 * can move between providers. Graph shape (each arrow is an inputNodeId wire):
 *
 *   [Text Input: releasing provider] ──┐
 *   [Text Input: receiving provider] ──┤
 *   [Text Input: date range] ──────────┼-> [Human Confirm] -> [Form Fill] -> [Document Render]
 *   [Text Input: purpose] ─────────────┤
 *   [Patient Record Pull] ─────────────┘
 */

const RELEASE_TEMPLATE = `AUTHORIZATION FOR RELEASE OF PROTECTED HEALTH INFORMATION

Patient: {fullName}
Date of birth: {dob}

TO (releasing provider or organization):
{Releasing provider}

PLEASE RELEASE RECORDS TO:
{Receiving provider}

I authorize the releasing provider or organization named above to disclose protected health information about the patient named above to the receiving provider listed.

DESCRIPTION OF INFORMATION TO BE RELEASED:
Complete medical records for the period {Records date range}, including office visit notes, hospital and discharge records, test and laboratory results, imaging reports, medication lists, immunization records, and billing records related to treatment during that period.

PURPOSE OF THIS RELEASE:
{Purpose}

EXPIRATION:
This authorization expires 1 year from the date of signature below, unless it is revoked earlier in writing.

RIGHT TO REVOKE:
I understand that I may revoke this authorization at any time by sending written notice to the releasing provider, except to the extent that action has already been taken in reliance on it. I understand that treatment, payment, enrollment, or eligibility for benefits may not be conditioned on signing this authorization. I also understand that information disclosed under this authorization may be redisclosed by the recipient and may no longer be protected by federal privacy rules.

Signature of patient or personal representative: ______________________________

Printed name: ______________________________

Relationship to patient (if personal representative): ______________________________

Date: ______________________

Prepared with the help of {caregiverLine}.`;

export function hipaaRecordsRelease(now: string) {
  const b = new WorkflowBuilder({
    key: 'hipaa-records-release',
    name: 'HIPAA Records Release',
    description:
      'Prepares a signature-ready HIPAA authorization so records can move between providers. You confirm every detail before the letter is written.',
    category: 'Records',
    estMinutes: 8,
    replacesHours: 'replaces ~1.5 hrs',
    version: 1,
  });

  const releasing = b.node('Text Input', 'Who holds the records', { x: 40, y: 40 }, {}, {
    Value: 'Releasing provider or organization',
  });
  const receiving = b.node('Text Input', 'Who should receive them', { x: 40, y: 140 }, {}, {
    Value: 'Receiving provider and fax or address',
  });
  const range = b.node('Text Input', 'Which dates to cover', { x: 40, y: 240 }, {}, {
    Value: 'Records date range',
  });
  const purpose = b.node('Text Input', 'Why the records are needed', { x: 40, y: 340 }, {}, {
    Value: 'Purpose of the release',
  });
  const record = b.node(
    'Patient Record Pull',
    'Pull patient facts',
    { x: 300, y: 190 },
    { Fields: [textVal('fullName, dob, caregiverLine')] },
  );
  const gate = b.node(
    'Human Confirm',
    'Review every detail',
    { x: 560, y: 190 },
    { Prompt: [textVal('Check the names, dates, and purpose. Nothing is written until you confirm.')] },
  );
  const fill = b.node(
    'Form Fill',
    'Assemble the authorization',
    { x: 820, y: 190 },
    { Template: [textVal(RELEASE_TEMPLATE)] },
  );
  const render = b.node(
    'Document Render',
    'Authorization letter',
    { x: 1080, y: 190 },
    {
      Title: [textVal('HIPAA records release authorization')],
      'Output Kind': [textVal('letter')],
    },
  );

  // EVERY fact flows through the gate: names become keys of the confirm bundle
  b.wire(releasing, gate, 'Releasing provider');
  b.wire(receiving, gate, 'Receiving provider');
  b.wire(range, gate, 'Records date range');
  b.wire(purpose, gate, 'Purpose');
  b.wire(record, gate, 'Value');
  b.wire(gate, fill, 'Data');
  b.wire(fill, render, 'Body');

  return b;
}
