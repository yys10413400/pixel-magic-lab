import { expect, test, type Page } from '@playwright/test';
import { openApp } from './helpers';

// 마우스 없이 키보드만으로 쓸 수 있는지 확인해요

/** Tab 을 눌러 가며 이름이 name 인 곳까지 초점을 옮겨요 */
async function tabTo(page: Page, name: string | RegExp, max = 80) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const label = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return (el?.getAttribute('aria-label') ?? el?.textContent ?? '').trim();
    });
    if (typeof name === 'string' ? label === name : name.test(label)) return;
  }
  throw new Error(`Tab 으로 "${name}" 에 닿지 못했어요`);
}

/** 개념 안내 창의 [알겠어요!]에 초점이 간 것을 확인하고 Enter 로 닫아요 */
async function closeConceptByKey(page: Page) {
  await expect(page.getByRole('button', { name: '알겠어요!' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

const focusedName = (page: Page) =>
  page.evaluate(() => (document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent ?? '').trim());

test.describe('키보드만으로', () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name !== 'desktop', '데스크톱에서 확인');
  });

  test('미션 1을 처음부터 끝까지 풀어요', async ({ page }) => {
    await openApp(page, { muted: true, speed: 'instant' });
    // 개념 안내 창은 [알겠어요!]에 초점이 가 있어요
    await expect(page.getByRole('button', { name: '알겠어요!' })).toBeFocused();
    await page.keyboard.press('Enter');

    await tabTo(page, '오른쪽');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await tabTo(page, '아래로');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await tabTo(page, '색칠하기');
    await page.keyboard.press('Enter');
    await tabTo(page, /실행하기/);
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('dialog', { name: '미션 성공' });
    await expect(dialog).toBeVisible();
    // 성공 창은 [다음 미션]에 초점, Esc 로 닫으면 초점이 [실행하기]로 돌아와요
    await expect(dialog.getByRole('button', { name: /다음 미션/ })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    expect(await focusedName(page)).toMatch(/실행하기/);
  });

  test('블록을 키보드로 고르고, 옮기고, 지워요', async ({ page }) => {
    await openApp(page, { muted: true, speed: 'instant' });
    await closeConceptByKey(page);
    await tabTo(page, '오른쪽');
    await page.keyboard.press('Enter');
    await tabTo(page, '아래로');
    await page.keyboard.press('Enter');
    // 작업 공간의 [아래로 1칸] 블록으로 가서 Alt+↑ 로 위로 옮기기
    await tabTo(page, /^아래로 1칸/);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Alt+ArrowUp');
    const blocks = page.getByRole('region', { name: '명령 블록 작업 공간' }).locator('[aria-roledescription="블록"]');
    await expect(blocks.first()).toHaveAttribute('aria-label', /^아래로 1칸/);
    await page.keyboard.press('Delete');
    await expect(blocks).toHaveCount(1);
  });

  test('"하나 고르기" 묶음은 Tab 한 번에 들어가고 화살표로 골라요', async ({ page }) => {
    await openApp(page, { muted: true, speed: 'normal' });
    await closeConceptByKey(page);
    await tabTo(page, '보통');
    const speed = page.getByRole('radiogroup', { name: '실행 속도' });
    await page.keyboard.press('ArrowRight');
    await expect(speed.getByRole('radio', { name: '빠르게' })).toHaveAttribute('aria-checked', 'true');
    await expect(speed.getByRole('radio', { name: '빠르게' })).toBeFocused();
    // 다음 Tab 은 묶음 밖으로 나가요
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.getAttribute('role'))).not.toBe('radio');
  });

  test('팝업이 열려 있으면 Tab 이 팝업 안에서만 돌아요', async ({ page }) => {
    await openApp(page);
    await closeConceptByKey(page);
    await page.getByRole('button', { name: /미션 지도/ }).click();
    const dialog = page.getByRole('dialog', { name: '미션 지도' });
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
});
