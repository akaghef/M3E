const { defineConfig, devices } = require('@playwright/test');
const port = 14284;
module.exports = defineConfig({
  testDir: './tests/visual', testMatch: /agent_node_lab\.spec\.js/,
  timeout: 30000, reporter: 'list',
  use: { baseURL: `http://127.0.0.1:${port}`, viewport: { width: 1400, height: 900 } },
  webServer: { command: `node node_modules/typescript/bin/tsc -p tsconfig.browser.json && node node_modules/vite/bin/vite.js build --configLoader runner && node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port} --strictPort --configLoader runner`,
    url: `http://127.0.0.1:${port}/src/labs/node/node-lab.html`, timeout: 120000, reuseExistingServer: false, cwd: __dirname },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
});
