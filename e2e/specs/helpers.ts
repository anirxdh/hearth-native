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
  // The threshold is orb-only now: hold it through the ritual, then use the
  // demo door inside onboarding. Account holders' empty home keeps its link.
  page.once('dialog', (d) => {
    d.accept().catch(() => {});
  });
  const hint = page.getByText('Press and hold to begin');
  if (await hint.isVisible()) {
    const sphere = page.getByTestId('threshold-sphere');
    const box = (await sphere.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(3600);
    await page.mouse.up();
    await page.getByTestId('ob-demo').click();
  } else {
    const exploreLink = page.getByText('Explore with a demo family');
    if (await exploreLink.isVisible()) {
      await exploreLink.click();
    } else {
      return; // dashboard already has people
    }
  }
  await page.getByText('NEEDS ACTION').waitFor({ timeout: 10_000 });
}
