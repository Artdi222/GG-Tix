import { defineConfig, devices } from '@playwright/test'

// Runs against a throwaway backend + database (backend/scripts/test-server.sh),
// never against the dev data.
const API_PORT = 3998
const WEB_PORT = 3997

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // e.g. PW_CHANNEL=chrome to use the installed Google Chrome instead of the bundled build.
    channel: process.env.PW_CHANNEL
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ }
  ],
  webServer: [
    {
      command: 'bash ../backend/scripts/test-server.sh',
      url: `http://localhost:${API_PORT}/api/health`,
      env: { TEST_API_PORT: String(API_PORT) },
      timeout: 120_000,
      reuseExistingServer: false
    },
    {
      command: `bunx nuxt dev --port ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}`,
      env: { NUXT_BUILD_DIR: '.nuxt-e2e', NUXT_PUBLIC_API_BASE: `http://localhost:${API_PORT}/api` },
      timeout: 180_000,
      reuseExistingServer: false
    }
  ]
})
