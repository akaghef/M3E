// @ts-check
const { defineConfig, devices } = require("@playwright/test");
const PORT = process.env.M3E_PORT || "14173";

/**
 * Playwright config for E2E tests.
 *
 * Separate from the visual test config (playwright.config.js) to avoid
 * interference. Uses a dedicated port (14173) and temp SQLite database.
 */
module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  outputDir: "./tests/e2e/test-results",
  webServer: {
    command: "node ./e2e_test_server.js",
    url: `http://127.0.0.1:${PORT}/viewer.html`,
    reuseExistingServer: false,
    cwd: __dirname,
    timeout: 30_000,
    env: {
      M3E_PORT: PORT,
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
