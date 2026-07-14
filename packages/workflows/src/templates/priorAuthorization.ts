import { WorkflowBuilder } from '../builder';
import { textVal } from '../values';

/**
 * Prior Authorization Request - turns the prescriber's note into a complete
 * request letter with the supporting document attached. Graph shape (each
 * arrow is an inputNodeId wire):
 *
 *   [File Input: supporting document] -> [Document Text Extract] ─┐
 *   [Text Input: medication or service] ──────────────────────────┤
 *   [Text Input: prescriber name] ────────────────────────────────┼-> [Human Confirm] -> [Form Fill] -> [Document Render]
 *   [Text Input: insurance plan + member ID] ─────────────────────┤
 *   [Text Input: clinical justification] ─────────────────────────┤
 *   [Patient Record Pull] ────────────────────────────────────────┘
 */

const PRIOR_AUTH_TEMPLATE = `To the Prior Authorization Department,

RE: Prior authorization request
Patient: {fullName} (DOB {dob})
Plan and member ID: {Insurance plan and member ID}
Medication or service requested: {Medication or service}
Prescribing clinician: {Prescriber name}

I am writing on behalf of {fullName} to request prior authorization for the medication or service listed above, which has been ordered by {Prescriber name}.

Clinical justification, as stated by the prescriber:
{Clinical justification}

The patient's relevant conditions on record are: {conditions}. The prescriber considers this treatment medically necessary, and a supporting document from the clinical record is attached below for your review.

Please review this request and send a written determination to both the prescriber and me as soon as possible. If any additional documentation is needed, contact me directly and I will provide it promptly.

Sincerely,
{caregiverLine}

----------------------------------------
ATTACHMENT: Supporting document (as read)
{Supporting document text}`;

export function priorAuthorization(now: string) {
  const b = new WorkflowBuilder({
    key: 'prior-authorization',
    name: 'Prior Authorization Request',
    description:
      'Builds a complete prior authorization request from the prescriber note. You confirm every fact before anything is written.',
    category: 'Insurance & benefits',
    estMinutes: 15,
    replacesHours: 'replaces ~4 hrs',
    version: 1,
  });

  const supportFile = b.node('File Input', 'Upload the supporting document', { x: 40, y: 40 }, {}, {
    Value: 'Supporting document (prescriber note or records)',
  });
  const extract = b.node('Document Text Extract', 'Read the document', { x: 300, y: 40 });
  const medication = b.node('Text Input', 'What needs authorization', { x: 40, y: 130 }, {}, {
    Value: 'Medication or service needing authorization',
  });
  const prescriber = b.node('Text Input', 'Who ordered it', { x: 40, y: 220 }, {}, {
    Value: 'Prescriber name',
  });
  const insurance = b.node('Text Input', 'Plan and member ID', { x: 40, y: 310 }, {}, {
    Value: 'Insurance plan and member ID',
  });
  const justification = b.node('Text Input', 'Why it is needed', { x: 300, y: 310 }, {}, {
    Value: 'Clinical justification (from the prescriber note)',
  });
  const record = b.node(
    'Patient Record Pull',
    'Pull patient facts',
    { x: 300, y: 190 },
    { Fields: [textVal('fullName, dob, conditions, caregiverLine')] },
  );
  const gate = b.node(
    'Human Confirm',
    'Review every fact',
    { x: 560, y: 170 },
    { Prompt: [textVal('Check each value against the prescriber note. Nothing is written until you confirm.')] },
  );
  const fill = b.node(
    'Form Fill',
    'Assemble the request',
    { x: 820, y: 170 },
    { Template: [textVal(PRIOR_AUTH_TEMPLATE)] },
  );
  const render = b.node(
    'Document Render',
    'Prior authorization letter',
    { x: 1080, y: 170 },
    {
      Title: [textVal('Prior authorization request')],
      'Output Kind': [textVal('letter')],
    },
  );

  b.wire(supportFile, extract, 'Document');
  // EVERY fact flows through the gate: names become keys of the confirm bundle
  b.wire(extract, gate, 'Supporting document text');
  b.wire(medication, gate, 'Medication or service');
  b.wire(prescriber, gate, 'Prescriber name');
  b.wire(insurance, gate, 'Insurance plan and member ID');
  b.wire(justification, gate, 'Clinical justification');
  b.wire(record, gate, 'Value');
  b.wire(gate, fill, 'Data');
  b.wire(fill, render, 'Body');

  return b;
}
