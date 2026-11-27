import type { KeyboardEvent } from 'react';

// ─────────────────────────────────────────────
// "하나 고르기" 버튼 묶음 (WAI-ARIA 라디오 그룹)
// - Tab 은 묶음 안에서 지금 고른 버튼 하나에만 멈춰요
// - ← → ↑ ↓ 로 옆 버튼으로 옮기면 바로 골라져요 (끝에서는 처음으로), Home/End 는 처음/끝
// 사용: <div role="radiogroup" onKeyDown={onRadioKeys}> <button {...radioProps(고른것)} /> </div>
// ─────────────────────────────────────────────

export function radioProps(checked: boolean) {
  return { role: 'radio' as const, 'aria-checked': checked, tabIndex: checked ? 0 : -1 };
}

const NEXT = new Set(['ArrowRight', 'ArrowDown']);
const PREV = new Set(['ArrowLeft', 'ArrowUp']);

export function onRadioKeys(e: KeyboardEvent<HTMLElement>) {
  if (!NEXT.has(e.key) && !PREV.has(e.key) && e.key !== 'Home' && e.key !== 'End') return;
  const radios = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')).filter(
    (r) => !(r as HTMLButtonElement).disabled,
  );
  const i = radios.indexOf(document.activeElement as HTMLElement);
  if (i < 0 || radios.length === 0) return;
  e.preventDefault();
  const n = radios.length;
  const j = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : NEXT.has(e.key) ? (i + 1) % n : (i - 1 + n) % n;
  radios[j].focus();
  radios[j].click();
}
