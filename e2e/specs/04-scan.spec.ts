import { expect, test, type Page } from '@playwright/test';

import { loadApp } from './helpers';

// The scan-a-label pipeline (P21-P23): capture -> parse -> verification-first
// confirm -> scan-to-med save. The web build has no camera or Vision module,
// so these specs ride the same fixture hook the App Review demo path uses:
// (globalThis as any).__ruaOcrFixture stands in for the recognized text,
// and the 'Use sample label' link (testID scan-sample) feeds it through the
// exact parse -> confirm -> save pipeline a native capture takes.

/** MM/DD/YYYY as printed on US pharmacy labels. */
function usDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${d.getFullYear()}`;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

/**
 * Seed the demo family from the empty home. Tracks helpers.seedDemo but
 * tolerates both web confirm implementations: a rendered dialog (button
 * 'Load demo' / testid confirm-load-demo) and window.confirm (accepted by
 * the page dialog handler registered in beforeEach).
 */
async function seedDemoFamily(page: Page): Promise<void> {
  // Orb-only threshold: hold through the ritual, then the demo door inside
  // onboarding seeds the family and lands on the digest.
  const hint = page.getByText('Press and hold to begin');
  if (await hint.isVisible().catch(() => false)) {
    const sphere = page.getByTestId('threshold-sphere');
    const box = (await sphere.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(3600);
    await page.mouse.up();
    await page.getByTestId('ob-demo').click();
  }
  await expect(page.getByText("Today's digest")).toBeVisible({ timeout: 10_000 });
}

/**
 * Open /scan without a full page load: the web test DB is in-memory per
 * tab, so a hard navigation would wipe the seeded family. Prefer the app's
 * own entry point when it is wired; otherwise drive the router through the
 * History API, which react-navigation's web linking listens to.
 */
async function openScan(page: Page): Promise<void> {
  const entry = page.getByText('Scan a label', { exact: true }).first();
  if (await entry.isVisible().catch(() => false)) {
    await entry.click();
  } else {
    await page.evaluate(() => {
      window.history.pushState(null, '', '/scan');
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    });
  }
  await expect(page.getByText(/Photograph the bottle label/)).toBeVisible();
}

/** Dismiss the rendered info dialog if one exists (window.alert self-dismisses). */
async function dismissInfoDialog(page: Page): Promise<void> {
  const ok = page.getByRole('button', { name: /^(OK|Done)$/ }).first();
  await ok.click({ timeout: 1_500 }).catch(() => {});
}

test.describe('scan a label', () => {
  test.beforeEach(async ({ page }) => {
    // Accept window.confirm / window.alert wherever the app still uses them.
    page.on('dialog', (dialog) => {
      dialog.accept().catch(() => {});
    });
  });

  test('sample label flows end to end into a scan-sourced fill', async ({ page }) => {
    await loadApp(page);
    await seedDemoFamily(page);

    // The seeded digest leads with Robert's metformin at ~3 days of runway.
    await expect(page.getByText(/Metformin runs out/).first()).toBeVisible();

    await openScan(page);
    await page.getByText('Robert Alvarez', { exact: true }).click();
    await page.getByTestId('scan-sample').click();

    // The illustrated scanning moment plays before confirm opens.
    await expect(page.getByText('SCANNING LABEL')).toBeVisible();

    // Verification-first confirm: the raw label line each field was read
    // from is visible, and the drug name resolved against RxNorm.
    await expect(page.getByText('Check what was read')).toBeVisible();
    await expect(page.getByText('METFORMIN HCL 500 MG TABLETS').first()).toBeVisible();
    await expect(page.getByTestId('rxnorm-status')).toContainText('metformin');

    // The result card sums up what the save will create, live from the fields.
    await expect(page.getByTestId('scan-result-card')).toBeVisible();
    await expect(page.getByTestId('scan-result-card')).toContainText('Metformin');

    await page.getByTestId('scan-save').getByRole('button').click();
    await dismissInfoDialog(page);

    // Robert already takes metformin 500 mg, so the scan lands as a refill
    // on the existing medication and the new fill drives the runway:
    // filled 3 days ago with a 30-day supply = 27 days left, from scan.
    await expect(page.getByText('Metformin').first()).toBeVisible();
    await expect(page.getByText('27 days left')).toBeVisible();
    await expect(page.getByText(/from scan/).first()).toBeVisible();

    // Back on home the digest has recomputed from the scanned fill: the
    // metformin lead is gone (its runway is 27 days now, not 3), which is
    // the observable proof the refill updated the runway and the digest.
    await page.getByLabel('Back', { exact: true }).click();
    await page.getByLabel('Back to home').click();
    await expect(page.getByText("Today's digest")).toBeVisible();
    await expect(page.getByText(/Metformin runs out/)).toHaveCount(0);
  });

  test('patient-mismatch and high-alert gates hold until deliberately cleared', async ({
    page,
  }) => {
    await loadApp(page);
    await seedDemoFamily(page);

    // Plant a high-alert label printed for a different household member.
    const filled = usDate(daysAgo(1));
    await page.evaluate((fixture) => {
      (globalThis as { __ruaOcrFixture?: string }).__ruaOcrFixture = fixture;
    }, [
      'MISSION PHARMACY',
      '(415) 555-0144',
      'RX# 771204',
      'ELEANOR ALVAREZ',
      'APIXABAN 5 MG TABLETS',
      'TAKE 1 TABLET BY MOUTH TWICE DAILY',
      'QTY: 60',
      `DATE FILLED: ${filled}`,
      'DAYS SUPPLY: 30',
    ].join('\n'));

    await openScan(page);
    await page.getByText('Robert Alvarez', { exact: true }).click();
    await page.getByTestId('scan-sample').click();

    await expect(page.getByText('Check what was read')).toBeVisible();

    // Patient-match gate: the save button is replaced by the paused
    // explanation until the caregiver explicitly claims the medication.
    await expect(page.getByText(/label reads ELEANOR ALVAREZ/).first()).toBeVisible();
    await expect(page.getByTestId('patient-mismatch')).toBeVisible();
    await expect(page.getByTestId('scan-save')).toHaveCount(0);

    await page.getByTestId('patient-override').getByRole('checkbox').click();
    await expect(page.getByTestId('patient-mismatch')).toHaveCount(0);
    await expect(page.getByTestId('scan-save')).toBeVisible();

    // High-alert gate: apixaban is an anticoagulant, so saving also needs
    // the checked-it-twice confirmation; the button stays disabled without it.
    await expect(page.getByTestId('highalert-check')).toBeVisible();
    const saveButton = page.getByTestId('scan-save').getByRole('button');
    await expect(saveButton).toHaveAttribute('aria-disabled', 'true');

    await page.getByTestId('highalert-check').getByRole('checkbox').click();
    await saveButton.click();
    await dismissInfoDialog(page);

    // Robert already takes apixaban 5 mg, so the gated save lands as a
    // refill on his existing record.
    await expect(page.getByText('Apixaban').first()).toBeVisible();
    await expect(page.getByText(/from scan/).first()).toBeVisible();
  });
});
