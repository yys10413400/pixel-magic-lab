// 첫 화면 속도 재기 (느린 학교 와이파이 흉내)
// 사용: npm run build 후 `npx vite preview --port 4173` 을 켜고  node scripts/perf.mjs http://localhost:4173
// 네트워크: 내려받기 1.6Mbps · 지연 150ms (느린 4G/붐비는 와이파이) · CPU 4배 느리게
import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'http://localhost:4173';
const runs = Number(process.argv[3] ?? 3);
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'msedge' });

const results = [];
for (let i = 0; i < runs; i++) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  // 실제로 주고받은 양 (압축된 크기)
  let bytes = 0;
  cdp.on('Network.loadingFinished', (e) => (bytes += e.encodedDataLength));
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'commit' });
  await page.getByRole('button', { name: /실행하기/ }).waitFor();
  const ready = Date.now() - t0;
  await page.evaluate(() => document.fonts.ready);
  const fonts = Date.now() - t0;
  const lcp = await page.evaluate(
    () =>
      new Promise((res) => {
        new PerformanceObserver((l) => {
          const e = l.getEntries();
          res(Math.round(e[e.length - 1].startTime));
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        setTimeout(() => res(-1), 3000);
      }),
  );
  results.push({ ready, fonts, lcp, kb: Math.round(bytes / 1024) });
  await ctx.close();
}
await browser.close();
const med = (k) => results.map((r) => r[k]).sort((a, b) => a - b)[Math.floor(results.length / 2)];
console.log(results);
console.log(`가운값  화면 사용 가능 ${med('ready')}ms · 글꼴까지 ${med('fonts')}ms · LCP ${med('lcp')}ms · 받은 양 ${med('kb')}KB`);
