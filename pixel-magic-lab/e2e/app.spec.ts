import { expect, test } from '@playwright/test';
import { closeConcept, expectNoPageScroll, goMode, openApp } from './helpers';

test.describe('첫 화면과 세 가지 모드', () => {
  test('오류 없이 열리고, 1366×768 에서 모드마다 페이지가 스크롤되지 않아요', async ({ page }, info) => {
    const errors = await openApp(page);
    await closeConcept(page);
    await expect(page.getByRole('heading', { name: '첫 번째 마법 점' })).toBeVisible();
    if (info.project.name === 'desktop') await expectNoPageScroll(page);
    for (const mode of ['자유 픽셀 공방', '움직이는 픽셀 극장']) {
      await goMode(page, mode);
      if (info.project.name === 'desktop') await expectNoPageScroll(page);
    }
    expect(errors).toEqual([]);
  });
});

test.describe('미션', () => {
  test('미션 1을 블록으로 풀면 성공하고, 새로고침해도 기록이 남아요', async ({ page }) => {
    await openApp(page, { muted: true, speed: 'fast' });
    await closeConcept(page);
    for (const name of ['오른쪽', '오른쪽', '아래로', '아래로', '색칠하기']) await page.getByRole('button', { name, exact: true }).click();
    await page.getByRole('button', { name: /실행하기/ }).click();
    await expect(page.getByRole('heading', { name: '미션 성공!' })).toBeVisible({ timeout: 10_000 });
    await page.reload();
    const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('pml.progress.v1') ?? '{}'));
    expect(progress.missions['1'].stars).toBe(3);
  });

  test('블록을 끌어서 작업 공간에 놓을 수 있어요', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', '터치 끌기는 손잡이로만 시작해서 마우스 시험은 데스크톱에서만');
    await openApp(page);
    await closeConcept(page);
    const ws = page.getByRole('region', { name: '명령 블록 작업 공간' });
    await page.getByRole('button', { name: '색칠하기', exact: true }).dragTo(ws);
    await expect(ws.getByRole('group', { name: /색칠하기/ })).toHaveCount(1);
  });
});

test.describe('공방과 극장', () => {
  test('공방: 작품을 저장하면 새로고침 뒤에도 보관함에 있어요', async ({ page }) => {
    await openApp(page);
    await closeConcept(page);
    await goMode(page, '자유 픽셀 공방');
    await page.getByRole('textbox', { name: /작품 이름/ }).fill('무지개');
    await page.getByRole('button', { name: '색칠하기', exact: true }).click();
    await page.getByRole('button', { name: /^저장하기/ }).click();
    await page.reload();
    await goMode(page, '자유 픽셀 공방');
    await page.getByRole('button', { name: /작품 보관함/ }).click();
    await expect(page.getByRole('dialog').getByText('무지개')).toBeVisible();
  });

  test('공방: PNG 그림 파일을 내려받아요', async ({ page }) => {
    await openApp(page);
    await closeConcept(page);
    await goMode(page, '자유 픽셀 공방');
    await page.getByRole('button', { name: '색칠하기', exact: true }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: /PNG 내려받기/ }).click();
    expect((await download).suggestedFilename()).toMatch(/\.png$/);
  });

  test('극장: 움직이는 GIF 를 내려받아요', async ({ page }) => {
    await openApp(page);
    await closeConcept(page);
    await goMode(page, '움직이는 픽셀 극장');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'GIF', exact: true }).first().click();
    const d = await download;
    expect(d.suggestedFilename()).toMatch(/\.gif$/);
    const stream = await d.createReadStream();
    const head = await new Promise<Buffer>((res) => stream.once('data', (c) => res(c as Buffer)));
    expect(head.subarray(0, 6).toString('ascii')).toBe('GIF89a');
  });
});
