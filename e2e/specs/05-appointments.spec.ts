import { expect, test } from '@playwright/test';

// The appointment kit journey (P24): seed the demo family, add a visit for
// Robert, check the patient-first list, open the kit and its deterministic
// prep sheet, record what happened, and watch the visit move to the past.
//
// The web DB is in-memory per page load (see apps/mobile/src/db/webdb.web.ts),
// so the spec seeds on /appointments itself (its empty state offers the demo
// family) and navigates client-side from there; a page.goto would wipe the
// seed. The web confirm dialog is window.confirm, so a dialog handler
// accepts it.

/** Local calendar date `days` from now, matching the app's local today(). */
function localDatePlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

test.describe('appointments', () => {
  test('add a visit, read the prep sheet, record what happened', async ({ page }) => {
    page.on('dialog', (dialog) => {
      dialog.accept().catch(() => {});
    });

    await page.goto('/appointments');
    await expect(page.getByRole('heading', { name: 'Appointments' })).toBeVisible();

    // Seed the demo family from the empty state.
    await page.getByText('Explore with a demo family').click();
    await expect(page.getByRole('button', { name: 'Add appointment' })).toBeVisible();

    // Add an appointment for Robert, three days out.
    await page.getByRole('button', { name: 'Add appointment' }).click();
    await page.getByRole('tab', { name: 'Robert' }).click();
    await page.getByTestId('appt-provider').fill('Dr. Chen');
    await page.getByTestId('appt-specialty').fill('cardiology');
    await page.getByTestId('appt-date').fill(localDatePlusDays(3));
    await page.getByTestId('appt-driver').fill('Maria');
    await page.getByRole('button', { name: 'Add appointment' }).click();

    // Patient-first list: Robert leads the row, the provider follows.
    const row = page.getByTestId('appt-row').filter({ hasText: 'Robert' });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Dr. Chen');
    await expect(row).toContainText('Maria drives');
    await expect(row).toContainText('Prep ready');

    // The kit: prep sheet lists current meds and drafts questions.
    await row.click();
    await expect(page.getByText('Current medications')).toBeVisible();
    await expect(page.getByText('Metformin 500 mg')).toBeVisible();
    const questions = page.getByTestId('prep-question');
    expect(await questions.count()).toBeGreaterThan(0);
    const firstQuestion = ((await questions.first().textContent()) ?? '').trim();
    expect(firstQuestion.endsWith('?')).toBe(true);

    // Record what happened; the visit is marked done.
    await page
      .getByTestId('post-visit-input')
      .fill('Dose unchanged. Follow-up in three months.');
    await page.getByTestId('post-visit-save').click();
    await expect(page.getByText('What happened')).toBeVisible();
    await expect(page.getByTestId('visit-recorded')).toBeAttached();

    // Back on the list, the visit now lives under Past visits.
    await page.getByLabel('Back to appointments').click();
    await expect(page.getByText('Past visits')).toBeVisible();
    const pastRow = page.getByTestId('past-row').filter({ hasText: 'Robert' });
    await expect(pastRow).toHaveCount(1);
    await expect(pastRow).toContainText('Dr. Chen');
    await expect(page.getByTestId('appt-row')).toHaveCount(0);
    await expect(page.getByText('No upcoming appointments')).toBeVisible();
  });
});
