import { expect, test } from '@playwright/test';

import { loadApp } from './helpers';

// Noise the static server and browser produce that is not an app bug.
const IGNORED_CONSOLE_LINES = /(favicon|manifest|sourcemap)/i;

test.describe('smoke', () => {
  test('app loads and shows onboarding or the dashboard', async ({ page }) => {
    await loadApp(page);

    await expect(
      page
        .getByText('Press and hold to begin')
        .or(page.getByText('Start your care circle'))
        .or(page.getByText("Today's digest"))
        .first(),
    ).toBeVisible();
  });

  test('no console errors during load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' && !IGNORED_CONSOLE_LINES.test(message.text())) {
        errors.push(message.text());
      }
    });

    await loadApp(page);

    expect(errors).toEqual([]);
  });
});
