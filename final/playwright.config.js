// @ts-check
const { defineConfig, devices } = require("@playwright/test");
const PORT = process.env.M3E_PORT || "14174";

if (PORT === "4173" && process.env.M3E_ALLOW_VISUAL_TEST_ON_4173 !== "1") {
  throw new Error("Refusing to run visual tests on beta port 4173. Use a dedicated test port.");
}

module.exports = defineConfig({
  testDir: "./tests/visual",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: "disabled",
      caret: "hide",
    },
  },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1600, height: 1000 },
  },
  webServer: {
    command: "node ./test_server.js",
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
