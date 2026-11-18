import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 12_000 },
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e-report.json' }]],
  use: { baseURL: 'http://127.0.0.1:4173', browserName: 'chromium', channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true, acceptDownloads: true, viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort', port: 4173, reuseExistingServer: true, timeout: 20_000 },
});
