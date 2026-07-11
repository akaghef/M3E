// @ts-check
const { defineConfig, devices } = require("@playwright/test");

const PORT = process.env.M3E_RUNTIME_BOARD_PORT || "14276";
if (PORT === "4173" && process.env.M3E_ALLOW_VISUAL_TEST_ON_4173 !== "1") {
  throw new Error("Refusing to run runtime-board tests on beta port 4173. Use a dedicated test port.");
}

module.exports = defineConfig({
  testDir: "./tests/visual",
  testMatch: /runtime_board\.spec\.js/,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: `npx vite --host 127.0.0.1 --port ${PORT} --config vite.config.mjs`,
    url: `http://127.0.0.1:${PORT}/src/labs/runtime-board/runtime-board.html`,
    reuseExistingServer: false,
    cwd: __dirname,
    timeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
});
