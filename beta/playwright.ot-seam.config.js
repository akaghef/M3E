// @ts-check
const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/visual",
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:14278",
    headless: true,
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: "npx vite preview --host 127.0.0.1 --port 14278 --config vite.config.mjs",
    url: "http://127.0.0.1:14278/src/labs/ot/routes/surface-overview.html",
    reuseExistingServer: false,
    cwd: __dirname,
    timeout: 30_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
