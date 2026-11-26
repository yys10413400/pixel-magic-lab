import { defineConfig, devices } from '@playwright/test';

// 브라우저 자동 테스트
// - 내 컴퓨터: 설치된 Microsoft Edge 를 써요 (브라우저를 따로 내려받지 않아요)
// - GitHub Actions: `npx playwright install chromium` 으로 받은 Chromium 을 써요
const PORT = 5190;
const ci = !!process.env.CI;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    locale: 'ko-KR',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 }, channel: ci ? undefined : 'msedge' } },
    {
      name: 'tablet',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 }, hasTouch: true, channel: ci ? undefined : 'msedge' },
    },
  ],
  webServer: {
    command: `node node_modules/vite/bin/vite.js --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !ci,
    timeout: 60_000,
  },
});
