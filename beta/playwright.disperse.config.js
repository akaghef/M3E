const { defineConfig, devices } = require('@playwright/test');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const port = 14283;
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'm3e-disperse-'));
module.exports = defineConfig({
  testDir: './tests/disperse', testMatch: 'disperse_force.spec.js', timeout: 60000,
  expect: { timeout: 15000 }, workers: 1, retries: 0,
  use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${port}`, headless: true, launchOptions: { args: ['--use-angle=metal'] }, screenshot: 'only-on-failure' },
  webServer: { command: 'node dist/node/start_viewer.js', url: `http://127.0.0.1:${port}/viewer.html`, reuseExistingServer: false, timeout: 30000,
    env: { M3E_PORT: String(port), M3E_DATA_DIR: data, M3E_WORKSPACE_ID: 'ws_disperse_acceptance', M3E_WORKSPACE_LABEL: 'Disperse verification', M3E_MAP_ID: 'map_disperse_acceptance', M3E_MAP_LABEL: 'Force verification', M3E_OPEN_BROWSER: '0' } },
});
