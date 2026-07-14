import { defineConfig, devices } from '@playwright/test';

// Playwright runs against the Expo WEB export of the mobile app.
// Build it first with `npx expo export --platform web` in apps/mobile;
// the webServer block below serves the resulting dist/ as a static SPA.
export default defineConfig({
  testDir: './specs',
  forbidOnly: !!process.env.CI,
  expect: {
    timeout: 10_000,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:8090',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npx serve ../apps/mobile/dist -l 8090 -s',
    url: 'http://localhost:8090',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
