import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  timeout: 30000,
  use: { baseURL: 'http://localhost:5173', trace: 'off', screenshot: 'off' },
  webServer: [
    {
      command: process.env.CI ? 'npm run start -w backend' : 'npm run dev:backend',
      url: 'http://127.0.0.1:4000/health/ready',
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npm run dev -w frontend -- --host 127.0.0.1 --port 5173 --strictPort',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
