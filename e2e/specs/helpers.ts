import { expect, type Page } from '@playwright/test';

// Shared helpers for the web E2E specs. Selectors prefer getByRole and
// getByText so they track what a person actually sees, not implementation
// details. The two anchor strings below come from apps/mobile/src/app:
// 'Start your care circle' is the empty-state title, "Today's digest" is
// the dashboard section header.

/** Open the app and wait until either the onboarding or the dashboard shows. */
export async function loadApp(page: Page): Promise<void> {
  // Fresh visitors land on the threshold (the sphere); known apps land on
  // onboarding-done states or the dashboard.
  await page.goto('/');
  await page
    .getByText('Press and hold to begin')
    .or(page.getByText('Start your care circle'))
    .or(page.getByText("Today's digest"))
    .first()
    .waitFor({ timeout: 20_000 });
}

/**
 * Seed the demo family if the empty state is showing; no-op otherwise.
 *
 * On native the confirm step is an Alert.alert. Alert.alert does not exist
 * on web, so the app renders a fallback dialog whose confirm button carries
 * data-testid="confirm-load-demo". Try the visible button text first, then
 * fall back to the testid.
 */
export async function seedDemo(page: Page): Promise<void> {
  // The demo link lives on the threshold for brand-new visitors and on the
  // empty home for account holders; both confirm via window.confirm.
  const thresholdDemo = page.getByTestId('threshold-demo');
  const exploreLink = page.getByText('Explore with a demo family');
  page.once('dialog', (d) => {
    d.accept().catch(() => {});
  });
  if (await thresholdDemo.isVisible()) {
    await thresholdDemo.click();
  } else if (await exploreLink.isVisible()) {
    await exploreLink.click();
  } else {
    return; // dashboard already has people
  }
  await page.getByText('NEEDS ACTION').waitFor({ timeout: 10_000 });
}
