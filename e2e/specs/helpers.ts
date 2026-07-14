import { expect, type Page } from '@playwright/test';

// Shared helpers for the web E2E specs. Selectors prefer getByRole and
// getByText so they track what a person actually sees, not implementation
// details. The two anchor strings below come from apps/mobile/src/app:
// 'Start your care circle' is the empty-state title, "Today's digest" is
// the dashboard section header.

/** Open the app and wait until either the onboarding or the dashboard shows. */
export async function loadApp(page: Page): Promise<void> {
  await page.goto('/');
  await expect(
    page
      .getByText('Start your care circle')
      .or(page.getByText("Today's digest"))
      .first(),
  ).toBeVisible();
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
  const exploreLink = page.getByText('Explore with a demo family');
  if (!(await exploreLink.isVisible())) {
    return;
  }
  await exploreLink.click();

  const confirmByText = page
    .getByRole('button', { name: 'Load demo' })
    .or(page.getByText('Load demo', { exact: true }))
    .first();
  try {
    await confirmByText.click({ timeout: 5_000 });
  } catch {
    await page.getByTestId('confirm-load-demo').click();
  }

  // Seeding lands on the dashboard.
  await expect(page.getByText("Today's digest")).toBeVisible();
}
