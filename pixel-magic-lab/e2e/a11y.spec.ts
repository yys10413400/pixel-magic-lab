import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { closeConcept, goMode, openApp } from './helpers';

// 자동 접근성 검사 (axe-core, WCAG 2.1 A·AA 규칙)
async function scan(page: Page, where: string) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const found = r.violations.map((v) => `${where} · ${v.id} (${v.impact}): ${v.nodes.length}곳 — ${v.nodes[0]?.target.join(' ')}`);
  return found;
}

test('세 모드와 주요 팝업에 접근성 위반이 없어요', async ({ page }, info) => {
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
  await page.getByRole('button', { name: '선생님 도구' }).click();
  all.push(...(await scan(page, '선생님 도구')));
  expect(all).toEqual([]);
});
