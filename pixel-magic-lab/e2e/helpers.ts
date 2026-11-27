import { expect, type Page } from '@playwright/test';

/** 저장소를 비우고 (원하면 설정을 넣고) 앱을 열어요. 콘솔 오류는 모아 둬요. */
export async function openApp(page: Page, settings: { speed?: string; muted?: boolean; welcomed?: boolean } = { muted: true }) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.addInitScript((s) => {
    if (!sessionStorage.getItem('pml.e2e.init')) {
      localStorage.clear();
      // 처음 안내 팝업은 따로 시험해요 (welcomed: false 를 넘기면 보여요)
      localStorage.setItem('pml.settings.v1', JSON.stringify({ welcomed: true, ...s }));
      sessionStorage.setItem('pml.e2e.init', '1');
    }
  }, settings);
  await page.goto('/');
  return errors;
}

export async function closeConcept(page: Page) {
  await page.getByRole('button', { name: '알겠어요!' }).click();
}

export async function goMode(page: Page, label: string) {
  await page
    .getByRole('navigation', { name: '모드 선택' })
    .getByRole('button', { name: new RegExp(label) })
    .click();
}

/** 선생님 도구 열기 (처음이면 비밀번호를 만들고, 있으면 넣어요) */
export async function openTeacher(page: Page, pw = '1234') {
  await page.getByRole('button', { name: '선생님 도구' }).click();
  const dialog = page.getByRole('dialog', { name: '선생님 도구' });
  const again = dialog.getByLabel('한 번 더');
  await dialog.getByLabel('비밀번호', { exact: true }).fill(pw);
  if (await again.isVisible()) await again.fill(pw);
  await dialog.getByRole('button', { name: /비밀번호 정하기|열기/ }).click();
  return dialog;
}

/** 페이지 전체가 세로·가로로 스크롤되지 않는지 */
export async function expectNoPageScroll(page: Page) {
  const { sh, ch, sw, cw } = await page.evaluate(() => {
    const el = document.scrollingElement!;
    return { sh: el.scrollHeight, ch: el.clientHeight, sw: el.scrollWidth, cw: el.clientWidth };
  });
  expect(sh, '세로 스크롤 없음').toBeLessThanOrEqual(ch + 1);
  expect(sw, '가로 스크롤 없음').toBeLessThanOrEqual(cw + 1);
}
