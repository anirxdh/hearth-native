import { expect, test, type Page } from '@playwright/test';

// The admin-workflow suite (P26-P28): one test per bundled workflow, each
// driving the full journey: library -> preview card -> inputs -> run ->
// Human Confirm gate (edit a value) -> finished document or record write.
//
// NOTE on seeding: the web build keeps SQLite in memory per page load (see
// apps/mobile/src/db/webdb.web.ts), so a page.goto() after seeding on the
// home screen would wipe the demo family. Each test therefore boots straight
// into /workflows and seeds the demo family from the patient picker's own
// "Load the demo family" link; the window.confirm dialog it raises is
// auto-accepted by the handler installed in openLibrary.

const OCR_FIXTURE = 'DENIAL: service 99213 not medically necessary per plan policy B-12.';

async function openLibrary(page: Page): Promise<void> {
  page.on('dialog', (dialog) => {
    dialog.accept().catch(() => {});
  });
  await page.goto('/workflows');
  await expect(page.getByText('Paperwork, automated')).toBeVisible();
}

async function openWorkflow(page: Page, name: string): Promise<void> {
  await page.getByText(name, { exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Run workflow' })).toBeVisible();
}

/** Seed the demo family via the picker's link, then choose Robert. */
async function pickRobert(page: Page): Promise<void> {
  await page.getByTestId('picker-load-demo').click();
  await page.getByText('Robert Alvarez').first().click();
}

async function fillByLabel(page: Page, label: string, value: string): Promise<void> {
  await page.getByLabel(label, { exact: true }).fill(value);
}

/**
 * Install the on-device OCR fixture (the app's extractText hook reads
 * window.__ruaOcrFixture), then satisfy the file input with the built-in
 * sample document link.
 */
async function useSampleDocument(page: Page): Promise<void> {
  await page.evaluate((fixture) => {
    (window as { __ruaOcrFixture?: string }).__ruaOcrFixture = fixture;
  }, OCR_FIXTURE);
  await page.getByTestId(/^sample-doc-/).click();
}

/** Run, then wait for the Human Confirm card to appear. */
async function runToConfirm(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Run workflow' }).click();
  await expect(page.getByTestId('confirm-continue')).toBeVisible();
}

/** Append ' EDITED' to one confirm field; returns the edited value. */
async function editConfirmField(page: Page, key: string): Promise<string> {
  const field = page.getByTestId(`confirm-field-${key}`);
  await expect(field).toBeVisible();
  const current = await field.inputValue();
  const edited = `${current} EDITED`;
  await field.fill(edited);
  return edited;
}

async function confirmAndContinue(page: Page): Promise<void> {
  // The Human Confirm card breathes (an infinite, sub-pixel scale loop that
  // draws the eye while the run is paused), so Playwright's "stable" check
  // never settles on anything inside it. Assert visibility, then click
  // without the stability wait; at scale 1.008 the button center is still
  // the button.
  const button = page.getByTestId('confirm-continue');
  await expect(button).toBeVisible();
  await button.click({ force: true });
}

test.describe('admin workflows', () => {
  test('claim denial appeal: denial letter to mail-ready appeal', async ({ page }) => {
    await openLibrary(page);
    await openWorkflow(page, 'Claim Denial Appeal Builder');
    await pickRobert(page);

    await fillByLabel(page, 'Denial reason (from the letter)', 'Not medically necessary');
    await fillByLabel(page, 'Claim number', '88-431');
    await useSampleDocument(page);

    await runToConfirm(page);
    const edited = await editConfirmField(page, 'Claim number');
    await confirmAndContinue(page);

    const output = page.getByTestId('workflow-output');
    await expect(output).toBeVisible();
    await expect(output).toContainText('RE: Appeal of claim denial');
    await expect(output).toContainText(`Claim number: ${edited}`);
    // The OCR fixture text flows through the gate into the attachment.
    await expect(output).toContainText('per plan policy B-12');
  });

  test('hipaa records release: signature-ready authorization', async ({ page }) => {
    await openLibrary(page);
    await openWorkflow(page, 'HIPAA Records Release');
    await pickRobert(page);

    await fillByLabel(page, 'Releasing provider or organization', 'Mission Medical Group, 415-555-0111');
    await fillByLabel(page, 'Receiving provider and fax or address', 'Sunrise Cardiology, fax 415-555-0122');
    await fillByLabel(page, 'Records date range', 'January 2024 to June 2026');
    await fillByLabel(page, 'Purpose of the release', 'Continuity of care after a referral');

    await runToConfirm(page);
    const edited = await editConfirmField(page, 'Purpose');
    await confirmAndContinue(page);

    const output = page.getByTestId('workflow-output');
    await expect(output).toBeVisible();
    await expect(output).toContainText('AUTHORIZATION FOR RELEASE OF PROTECTED HEALTH INFORMATION');
    await expect(output).toContainText(edited);
    await expect(output).toContainText('Sunrise Cardiology');
  });

  test('prior authorization: prescriber note to request letter', async ({ page }) => {
    await openLibrary(page);
    await openWorkflow(page, 'Prior Authorization Request');
    await pickRobert(page);

    await fillByLabel(page, 'Medication or service needing authorization', 'Continuous glucose monitor');
    await fillByLabel(page, 'Prescriber name', 'Dr. Naomi Chen');
    await fillByLabel(page, 'Insurance plan and member ID', 'Golden State PPO, member 4482-991');
    await fillByLabel(
      page,
      'Clinical justification (from the prescriber note)',
      'Frequent hypoglycemia despite adherence to the current regimen',
    );
    await useSampleDocument(page);

    await runToConfirm(page);
    const edited = await editConfirmField(page, 'Prescriber name');
    await confirmAndContinue(page);

    const output = page.getByTestId('workflow-output');
    await expect(output).toBeVisible();
    await expect(output).toContainText('RE: Prior authorization request');
    await expect(output).toContainText(`Prescribing clinician: ${edited}`);
    await expect(output).toContainText('per plan policy B-12');
  });

  test('medicaid renewal: cover letter and checklist', async ({ page }) => {
    await openLibrary(page);
    await openWorkflow(page, 'Medicaid Renewal Packet');
    await pickRobert(page);

    await fillByLabel(page, 'Case or renewal number', 'CA-2291-88');
    await fillByLabel(page, 'Household size', '2 adults');
    await fillByLabel(page, 'Monthly income summary', 'Social Security, 1840 per month');
    await useSampleDocument(page);

    await runToConfirm(page);
    const edited = await editConfirmField(page, 'Case or renewal number');
    await confirmAndContinue(page);

    const output = page.getByTestId('workflow-output');
    await expect(output).toBeVisible();
    await expect(output).toContainText('RE: Medicaid renewal');
    await expect(output).toContainText('DOCUMENT CHECKLIST');
    await expect(output).toContainText(`Case or renewal number: ${edited}`);
  });

  test('discharge to home: paperwork to setup sheet', async ({ page }) => {
    await openLibrary(page);
    await openWorkflow(page, 'Discharge to Home Setup');
    await pickRobert(page);

    await fillByLabel(page, 'Discharging facility', 'St. Mary Regional Hospital');
    await fillByLabel(
      page,
      'Follow-up appointments as stated',
      'Cardiology with Dr. Chen on 2026-07-28 at 9:30',
    );
    await useSampleDocument(page);

    await runToConfirm(page);
    const edited = await editConfirmField(page, 'Discharging facility');
    await confirmAndContinue(page);

    const output = page.getByTestId('workflow-output');
    await expect(output).toBeVisible();
    await expect(output).toContainText('DISCHARGE TO HOME SETUP SHEET');
    await expect(output).toContainText(`Discharged from: ${edited}`);
    await expect(output).toContainText('MEDICATION RECONCILIATION');
    await expect(output).toContainText('Cardiology with Dr. Chen on 2026-07-28 at 9:30');
  });

  test('new patient intake: confirmed details saved to the record', async ({ page }) => {
    await openLibrary(page);
    await openWorkflow(page, 'New Patient Intake');
    await pickRobert(page);

    await fillByLabel(page, 'Full name', 'Pat Delgado');
    await fillByLabel(page, 'Date of birth', '1949-03-22');
    await fillByLabel(page, 'Conditions (comma separated)', 'COPD, arthritis');
    await fillByLabel(page, 'Allergies (comma separated)', 'Sulfa drugs');
    await fillByLabel(page, 'Primary pharmacy', 'Mission Pharmacy');

    await runToConfirm(page);
    const edited = await editConfirmField(page, 'conditions');
    await confirmAndContinue(page);

    // A Record Write sink saves to the record instead of printing.
    const saved = page.getByTestId('workflow-saved');
    await expect(saved).toBeVisible();
    await expect(saved).toContainText('Saved to');
    await expect(saved).toContainText('Pat Delgado');
    await expect(saved).toContainText('record');
    expect(edited).toContain('EDITED');
  });

  test('the canvas: nodes, edges, live run data on the flow', async ({ page }) => {
    await openLibrary(page);
    await openWorkflow(page, 'Claim Denial Appeal Builder');

    // Static structure: every node card and the full edge layer render.
    await page.getByText('View the flow').click();
    for (const nodeTitle of [
      'Upload the denial',
      'Read the denial',
      'Review every fact',
      'Assemble the appeal',
      'Appeal letter',
    ]) {
      await expect(page.getByText(nodeTitle).first()).toBeAttached();
    }
    const edgePaths = page.locator('svg path');
    expect(await edgePaths.count()).toBeGreaterThanOrEqual(6);

    // Live data: run to the gate, then view the run on the flow.
    await page.goBack();
    await expect(page.getByRole('button', { name: 'Run workflow' })).toBeVisible();
    await pickRobert(page);
    await fillByLabel(page, 'Denial reason (from the letter)', 'Not medically necessary');
    await fillByLabel(page, 'Claim number', '88-431');
    await useSampleDocument(page);
    await runToConfirm(page);

    await page.getByLabel('View this run on the flow').click();
    const chip = page.getByLabel('View data from Read the denial').first();
    await expect(chip).toBeVisible();
    await chip.click();
    // The inspector shows the extracted denial text carried on that edge.
    await expect(page.getByText('per plan policy B-12').filter({ visible: true }).first()).toBeVisible();
  });

  test('a paused run can be canceled, and stays canceled', async ({ page }) => {
    await openLibrary(page);
    await openWorkflow(page, 'Claim Denial Appeal Builder');
    await pickRobert(page);
    await fillByLabel(page, 'Denial reason (from the letter)', 'Not medically necessary');
    await fillByLabel(page, 'Claim number', '88-431');
    await useSampleDocument(page);
    await runToConfirm(page);

    await page.getByTestId('cancel-run').click(); // window.confirm auto-accepted
    await expect(page.getByText('Canceled').filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByTestId('confirm-continue')).toHaveCount(0);
    await expect(page.getByTestId('cancel-run')).toHaveCount(0);
  });
});
