const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/visual",
  testMatch: "agent-orrery-lab.spec.js",
  timeout: 30_000,
  reporter: [["list"]],
  use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:14277" },
  webServer: {
    command: "npx vite --host 127.0.0.1 --port 14277 --config vite.config.mjs",
    url: "http://127.0.0.1:14277/src/labs/agent-orrery/agent-orrery-lab.html",
    reuseExistingServer: false,
    cwd: __dirname,
    timeout: 30_000,
  },
});
