import { expect, test } from '@playwright/test';

import { loadApp, seedDemo } from './helpers';

// The core caregiver journey, mirroring the Maestro flows in .maestro/:
// onboarding -> seed the demo family -> the digest leads with Robert's
// metformin -> into his record -> the ER sheet is two taps away.
//
// Seeding goes through the real onboarding action (window.confirm accepted
// by the helper), then the journey walks the same path a caregiver would.

test.describe('core journey', () => {
  test('onboarding to seeded digest', async ({ page }) => {
    await loadApp(page);
    await seedDemo(page);

    await expect(page.getByText('NEEDS ACTION')).toBeVisible();
    await expect(page.getByText(/Metformin/).first()).toBeVisible();
  });

  test('patient record shows the allergy banner', async ({ page }) => {
    await loadApp(page);
    await seedDemo(page);

    await page.getByRole('button', { name: /Robert.*Dad/ }).click();

    await expect(page.getByText(/ALLERGY: Penicillin/).first()).toBeVisible();
    await expect(page.getByText('Robert Alvarez')).toBeVisible();
  });

  test('ER sheet is reachable from the record', async ({ page }) => {
    await loadApp(page);
    await seedDemo(page);

    await page.getByRole('button', { name: /Robert.*Dad/ }).click();
    await page.getByText('ER sheet').click();

    await expect(page.getByText(/ALLERGY: Penicillin/).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText('Current medications')).toBeVisible();
    await expect(page.getByText(/Apixaban/).first()).toBeVisible();
  });
});
