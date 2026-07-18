import { expect, test } from '@playwright/test';

import { loadApp } from './helpers';

// The first-time journey: from the empty home through the five-step wizard
// (account, Face ID, first person with a photo, papers, the demo band) to
// the arrival summary and a populated dashboard.
//
// The web DB is in-memory per page load (apps/mobile/src/db/webdb.web.ts),
// so the whole journey rides one load and navigates client-side. Native
// pickers render file inputs on web (expo-image-picker / expo-document-picker),
// which Playwright intercepts via the filechooser event; the files are tiny
// buffers generated inline. window.confirm / window.alert dialogs are
// auto-accepted by the page dialog handler, house style.

/** A valid 1x1 PNG, enough for the image picker to read real metadata. */
function tinyPng(): Buffer {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
}

/** A minimal but well-formed-enough PDF for the document picker. */
function tinyPdf(): Buffer {
  return Buffer.from(
    [
      '%PDF-1.4',
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >> endobj',
      'trailer << /Root 1 0 R >>',
      '%%EOF',
    ].join('\n'),
    'utf-8',
  );
}

test.describe('first-time onboarding', () => {
  test('guided setup: account, security, person, papers, band, arrival', async ({ page }) => {
    page.on('dialog', (dialog) => {
      dialog.accept().catch(() => {});
    });

    await loadApp(page);

    // The threshold: the sphere, its hint, and both dignified alternatives.
    await expect(page.getByText('Press and hold to begin')).toBeVisible();
    // orb-only: no links below the sphere anymore
    // THE RITUAL: press and hold the threshold sphere until the ring fills.
    const sphere = page.getByTestId('threshold-sphere');
    await expect(sphere).toBeVisible();
    const box = (await sphere.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(3600);
    await page.mouse.up();

    // Step 1: welcome and the account.
    await expect(page.getByText('Step 1 of 4')).toBeVisible();
    await expect(page.getByText('One glance, every medication')).toBeVisible(); // the hero carousel
    await page.getByTestId('ob-name').fill('Maria Alvarez');
    await page.getByTestId('ob-email').fill('maria@example.com');
    await page.getByTestId('ob-create').getByRole('button').click();
    // Face ID and notifications are native sheets now (web skips them).

    // Step 2: the first person, with a photo from the (web) file input.
    await expect(page.getByText('Step 2 of 4')).toBeVisible();
    await page.getByTestId('ob-person-name').fill('Robert Alvarez');
    await page.getByTestId('ob-person-relationship').fill('Dad');
    await page.getByTestId('ob-person-dob').fill('1945-02-14');

    const photoChooser = page.waitForEvent('filechooser');
    await page.getByTestId('ob-photo').getByRole('button').click();
    await (await photoChooser).setFiles({
      name: 'robert.png',
      mimeType: 'image/png',
      buffer: tinyPng(),
    });
    await expect(page.getByTestId('ob-photo-set')).toBeVisible();

    await page.getByTestId('ob-attest').getByRole('checkbox').click();
    await page.getByTestId('ob-person-save').getByRole('button').click();

    // Step 4: papers. Insurance card via the image picker...
    await expect(page.getByText('Step 3 of 4')).toBeVisible();
    const insuranceChooser = page.waitForEvent('filechooser');
    await page.getByTestId('ob-upload-insurance').getByRole('button').click();
    await (await insuranceChooser).setFiles({
      name: 'insurance-card.png',
      mimeType: 'image/png',
      buffer: tinyPng(),
    });
    await expect(page.getByTestId('ob-insurance-done')).toBeVisible();
    await expect(page.getByTestId('ob-insurance-done')).toContainText('insurance-card');

    // ...and records via the document picker with a generated PDF.
    const recordsChooser = page.waitForEvent('filechooser');
    await page.getByTestId('ob-upload-records').getByRole('button').click();
    await (await recordsChooser).setFiles({
      name: 'medication-list.pdf',
      mimeType: 'application/pdf',
      buffer: tinyPdf(),
    });
    await expect(page.getByTestId('ob-records-done')).toBeVisible();
    await expect(page.getByTestId('ob-records-done')).toContainText('medication-list');

    await page.getByTestId('ob-continue-uploads').getByRole('button').click();

    // Step 5: the demo band backfills daily readings into the vitals table.
    await expect(page.getByText('Step 4 of 4')).toBeVisible();
    await page.getByTestId('ob-connect-band').getByRole('button').click();
    await expect(page.getByTestId('ob-band-done')).toContainText('readings');

    await page.getByTestId('ob-continue-wearables').getByRole('button').click();

    // Arrival: the summary reads back what the repo now holds. Earlier wizard
    // screens stay mounted (hidden) in the web stack, so visible-filter any
    // text they could also carry.
    await expect(page.getByText('You are set up.')).toBeVisible();
    await expect(page.getByText('Maria Alvarez').filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText('Robert Alvarez').filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText('2 in the vault')).toBeVisible();
    await expect(page.getByText(/\d+ readings/).filter({ visible: true }).first()).toBeVisible();

    await page.getByTestId('ob-open-hearth').getByRole('button').click();

    // Home is no longer empty: the digest leads and Robert has a card.
    await expect(
      page.getByText("Today's digest").filter({ visible: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Robert.*Dad/ }).filter({ visible: true }).first(),
    ).toBeVisible();
  });
});
