const { defineConfig, devices } = require("@playwright/test");

const PORT = process.env.M3E_AGENT_ORRERY_PORT || "14287";
module.exports = defineConfig({
  testDir: "./tests/visual",
  testMatch: "agent-orrery-lab.spec.js",
  timeout: 30_000,
  reporter: [["list"]],
  use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${PORT}` },
  webServer: {
    command: `npx vite --host 127.0.0.1 --port ${PORT} --strictPort --config vite.config.mjs`,
    url: `http://127.0.0.1:${PORT}/src/labs/agent-orrery/agent-orrery-lab.html`,
    reuseExistingServer: false,
    cwd: __dirname,
    timeout: 30_000,
  },
});
