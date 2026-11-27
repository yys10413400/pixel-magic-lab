import { expect, test } from '@playwright/test';
import { closeConcept, expectNoPageScroll, goMode, openApp, openTeacher } from './helpers';

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
    const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('pml.progress.v2') ?? '{}'));
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

test.describe('처음 안내와 선생님 비밀번호', () => {
  test('처음 열면 짧은 안내가 나오고 [코딩 시작!]을 누르면 시작해요. 다음부터는 안 나와요', async ({ page }) => {
    await openApp(page, { muted: true, welcomed: false });
    const welcome = page.getByRole('dialog', { name: '이렇게 놀아요' });
    await expect(welcome).toBeVisible();
    await expect(welcome.getByRole('button', { name: '코딩 시작!' })).toBeFocused();
    await welcome.getByRole('button', { name: '코딩 시작!' }).click();
    // 안내를 닫으면 미션 1의 개념 카드가 이어서 나와요
    await expect(page.getByRole('button', { name: '알겠어요!' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('dialog', { name: '이렇게 놀아요' })).toHaveCount(0);
    // [?] 버튼으로 다시 볼 수 있어요
    await page.getByRole('button', { name: '알겠어요!' }).click();
    await page.getByRole('button', { name: '사용 방법' }).click();
    await expect(page.getByRole('dialog', { name: '이렇게 놀아요' })).toBeVisible();
  });

  test('선생님 도구는 비밀번호를 만들고, 다음부터는 맞는 비밀번호로만 열려요', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', '한 번만 확인');
    await openApp(page);
    await closeConcept(page);
    const dialog = await openTeacher(page, '7788');
    await expect(dialog.getByText('미션 진행 현황')).toBeVisible();
    await page.keyboard.press('Escape');
    // 다시 열면 잠겨 있어요
    await page.getByRole('button', { name: '선생님 도구' }).click();
    const d2 = page.getByRole('dialog', { name: '선생님 도구' });
    await d2.getByLabel('비밀번호', { exact: true }).fill('0000');
    await d2.getByRole('button', { name: '열기' }).click();
    await expect(d2.getByRole('alert')).toHaveText(/비밀번호가 달라요/);
    await expect(d2.getByText('미션 진행 현황')).toHaveCount(0);
    await d2.getByLabel('비밀번호', { exact: true }).fill('7788');
    await d2.getByRole('button', { name: '열기' }).click();
    await expect(d2.getByText('미션 진행 현황')).toBeVisible();
  });
});
