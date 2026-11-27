import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { closeConcept, goMode, openApp, openTeacher } from './helpers';

// 자동 접근성 검사 (axe-core, WCAG 2.1 A·AA 규칙)
async function scan(page: Page, where: string) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const found = r.violations.map((v) => `${where} · ${v.id} (${v.impact}): ${v.nodes.length}곳 — ${v.nodes[0]?.target.join(' ')}`);
  return found;
}

test('세 모드와 주요 팝업에 접근성 위반이 없어요', async ({ page }, info) => {
  // 화면 8개를 훑어서 시간이 걸려요 (느린 컴퓨터에서도 넉넉하게)
  test.setTimeout(60_000);
  test.skip(info.project.name !== 'desktop', '한 번만 확인');
  await openApp(page);
  const all: string[] = [];
  all.push(...(await scan(page, '개념 안내 창')));
  await closeConcept(page);
  all.push(...(await scan(page, '미션')));
  await page.getByRole('button', { name: /미션 지도/ }).click();
  all.push(...(await scan(page, '미션 지도')));
  await page.keyboard.press('Escape');
  await goMode(page, '자유 픽셀 공방');
  all.push(...(await scan(page, '공방')));
  await goMode(page, '움직이는 픽셀 극장');
  all.push(...(await scan(page, '극장')));
  await page.getByRole('button', { name: '사용 방법' }).click();
  all.push(...(await scan(page, '사용 방법')));
  await page.keyboard.press('Escape');
  all.push(...(await scan(page, '선생님 도구 비밀번호')));
  await page.keyboard.press('Escape');
  await openTeacher(page);
  all.push(...(await scan(page, '선생님 도구')));
  expect(all).toEqual([]);
});
