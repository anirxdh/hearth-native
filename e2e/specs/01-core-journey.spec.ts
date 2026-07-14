import { expect, test } from '@playwright/test';

import { loadApp, seedDemo } from './helpers';

// The core caregiver journey, mirroring the Maestro flows in .maestro/:
// onboarding -> seed the demo family -> the digest leads with Robert's
// metformin -> into his record -> the ER sheet is two taps away.
//
// Tests marked test.fixme need app hooks that land with the web build
// (the confirm-load-demo dialog and web routing for the record screens).
// Flip them on as the hooks arrive.

test.describe('core journey', () => {
  test.fixme('onboarding to seeded digest', async ({ page }) => {
    // Needs the web confirm dialog (data-testid="confirm-load-demo").
    await loadApp(page);
    await seedDemo(page);

    await expect(page.getByText('NEEDS ACTION')).toBeVisible();
    await expect(page.getByText(/Metformin/).first()).toBeVisible();
  });

  test.fixme('patient record shows the allergy banner', async ({ page }) => {
    // Needs web routing into /patient/[id].
    await loadApp(page);
    await seedDemo(page);

    await page.getByText('Robert').first().click();

    await expect(page.getByText(/ALLERGY: Penicillin/).first()).toBeVisible();
    await expect(page.getByText('Robert Alvarez')).toBeVisible();
  });

  test.fixme('ER sheet is reachable from the record', async ({ page }) => {
    // Needs web routing into /patient/[id] and the ER sheet screen.
    await loadApp(page);
    await seedDemo(page);

    await page.getByText('Robert').first().click();
    await page.getByText('ER sheet').click();

    await expect(page.getByText(/ALLERGY: Penicillin/).first()).toBeVisible();
    await expect(page.getByText('Current medications')).toBeVisible();
    await expect(page.getByText(/Apixaban/).first()).toBeVisible();
  });
});
