// 화면 사진 찍기 (디자인 확인용)
// 사용: 개발 서버를 켠 뒤  node scripts/screens.mjs [주소] [가로x세로]
//   예) node scripts/screens.mjs http://localhost:5173 1366x768
// 결과: screens/ 폴더에 장면별 PNG (git 에는 올리지 않아요)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:5173';
const [w, h] = (process.argv[3] ?? '1366x768').split('x').map(Number);
const out = 'screens';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'msedge' });
const page = await browser.newPage({ viewport: { width: w, height: h }, locale: 'ko-KR', hasTouch: w < 1100 });
const tag = `${w}x${h}`;
const shot = (name) => page.screenshot({ path: `${out}/${tag}-${name}.png` });
const click = (name, exact = true) => page.getByRole('button', { name, exact }).first().click();

await page.addInitScript(() => {
  if (!sessionStorage.getItem('shots')) {
    localStorage.clear();
    localStorage.setItem('pml.settings.v1', JSON.stringify({ muted: true, speed: 'instant' }));
    sessionStorage.setItem('shots', '1');
  }
});
await page.goto(url);
await shot('01-concept');
await click('알겠어요!');
await shot('02-mission');

// 틀리게 실행 → 마법사 "앗"
for (const n of ['오른쪽', '아래로', '색칠하기']) await click(n);
await page.getByRole('button', { name: /실행하기/ }).click();
await page.waitForTimeout(400);
await shot('03-mission-fail');

// 고쳐서 성공
await page.getByRole('button', { name: /비우기/ }).click();
await click('모두 지우기');
for (const n of ['오른쪽', '오른쪽', '아래로', '아래로', '색칠하기']) await click(n);
await page.getByRole('button', { name: /실행하기/ }).click();
await page.waitForTimeout(1200);
await shot('04-mission-success');
await click('코드 다시 보기');

await page.getByRole('button', { name: /미션 지도/ }).click();
await page.waitForTimeout(400);
await shot('05-mission-map');
await page.keyboard.press('Escape');

await page
  .getByRole('navigation', { name: '모드 선택' })
  .getByRole('button', { name: /자유 픽셀 공방/ })
  .click();
for (const n of ['N번 반복하기', '오른쪽', '색칠하기']) await click(n);
await shot('06-workshop');

await page
  .getByRole('navigation', { name: '모드 선택' })
  .getByRole('button', { name: /움직이는 픽셀 극장/ })
  .click();
await click('저장 없이 이동');
await page.waitForTimeout(300);
await shot('07-theater');

await browser.close();
console.log(`${out}/ 에 ${tag} 화면을 저장했어요`);
