import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';

// `npm run build:html` 로 만든 한 파일 HTML 을 서버 없이(file://, 더블클릭과 같은 방식) 열어 봐요
const file = resolve(import.meta.dirname, '..', 'pixel-magic-lab.html');

test('한 파일 HTML 을 더블클릭하듯 열어도 작동해요', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', '한 번만 확인');
  test.skip(!existsSync(file), '먼저 npm run build:html 을 실행하세요');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(pathToFileURL(file).href);
  await page.getByRole('button', { name: '알겠어요!' }).click();
  for (const name of ['오른쪽', '오른쪽', '아래로', '아래로', '색칠하기']) await page.getByRole('button', { name, exact: true }).click();
  await page.getByRole('button', { name: /실행하기/ }).click();
  await expect(page.getByRole('heading', { name: '미션 성공!' })).toBeVisible({ timeout: 10_000 });
  // 글꼴도 파일 안에 들어 있어요
  expect(await page.evaluate(() => document.fonts.check('16px Jua'))).toBe(true);
  expect(errors).toEqual([]);
});
