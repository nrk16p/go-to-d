// End-to-end checks in real browsers, against the production build served at the GitHub Pages base
// path. `npm run e2e` builds first; `npx playwright test` alone serves whatever is in dist/.
// Kept out of `npm test` (vitest) and out of the deploy workflow: browsers add minutes.

import { defineConfig, devices } from 'playwright/test'

/** Not Vite's default 4173, so a preview running in another checkout is never picked up by mistake. */
const PORT = 4179

/** A phone: 390×844 with a touch screen, so the board's tap, ghost and confirm flow is the one tested. */
const PHONE = { viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, hasTouch: true, isMobile: true }

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}/go-to-d/`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium-phone', use: { ...devices['Pixel 7'], ...PHONE } },
    { name: 'webkit-phone', use: { ...devices['iPhone 14'], ...PHONE } },
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/go-to-d/`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
