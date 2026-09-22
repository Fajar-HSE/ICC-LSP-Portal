import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30000,
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  use: {
    baseURL: 'http://127.0.0.1:5173',
  },
  webServer: {
    command: 'npx vite --port 5173 --strictPort',
    port: 5173,
    reuseExistingServer: true,
  },
});
