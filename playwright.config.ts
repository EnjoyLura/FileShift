import { defineConfig, devices } from '@playwright/test';

/**
 * FileShift E2E 测试配置
 * 文档：https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],

  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // 桌面端 Chromium
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // 移动端 iPhone 13
    {
      name: 'iphone-13',
      use: { ...devices['iPhone 13'] },
    },
  ],

  // 开发服务器配置
  webServer: [
    {
      command: 'npx pnpm --filter @fileshift/server dev',
      port: 3000,
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npx pnpm --filter @fileshift/client dev',
      port: 5173,
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
