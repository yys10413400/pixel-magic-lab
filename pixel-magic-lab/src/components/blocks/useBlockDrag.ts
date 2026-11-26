import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { BlockKind, ColorKey } from '../../engine/types';

// ─────────────────────────────────────────────
// 블록 끌어서 놓기 (마우스 · 펜 · 터치 공용, Pointer Events)
// 놓을 자리는 화면 요소의 data-* 표시로 찾아요:
//   data-trash  팔레트 (블록을 놓으면 지워짐)
//   data-slot   빈 자리 (data-list, data-index)
//   data-row    블록 한 줄 (위/아래 절반으로 앞/뒤 판단, data-head 는 반복 머리, data-foot 은 반복 끝)
//   data-ws     작업 공간 빈 곳 (맨 끝에 붙임)
// ─────────────────────────────────────────────

export type DragSrc = { type: 'palette'; kind: BlockKind; color?: ColorKey } | { type: 'block'; id: string };
export type DropSlot = { listId: string | null; index: number };
export type Drop = DropSlot | { trash: true };

export interface DragState {
  src: DragSrc;
  x: number;
  y: number;
  active: boolean;
  drop: Drop | null;
  label: string;
  cls: string;
}

const DRAG_THRESHOLD = 7;
const EDGE_SCROLL_ZONE = 36;
const EDGE_SCROLL_STEP = 12;

export function isTrash(d: Drop | null | undefined): d is { trash: true } {
  return !!d && 'trash' in d;
}

/** 화면 좌표 → 놓을 자리 */
export function computeDrop(x: number, y: number, src: DragSrc, programLength: number): Drop | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  if (!el) return null;
  if (el.closest('[data-trash]')) return src.type === 'block' ? { trash: true } : null;
  const slot = el.closest<HTMLElement>('[data-slot]');
  if (slot) return { listId: slot.dataset.list || null, index: Number(slot.dataset.index) };
  const row = el.closest<HTMLElement>('[data-row]');
  if (row) {
    const listId = row.dataset.list || null;
    const index = Number(row.dataset.index);
    const r = row.getBoundingClientRect();
    const upper = y < r.top + r.height / 2;
    if (row.dataset.foot) return { listId, index: index + 1 };
    if (row.dataset.head && !upper) return { listId: row.dataset.bid!, index: 0 };
    return { listId, index: upper ? index : index + 1 };
  }
  if (el.closest('[data-ws]')) return { listId: null, index: programLength };
  return null;
}

interface Options {
  workspaceRef: RefObject<HTMLElement | null>;
  getProgramLength: () => number;
  onDrop: (d: DragState) => void;
}

export function useBlockDrag({ workspaceRef, getProgramLength, onDrop }: Options) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  /** 끌기를 막 끝낸 직후의 click 이벤트는 무시 (끌기 = 클릭으로 처리되지 않게) */
  const suppressClick = useRef(false);
  const onDropRef = useRef(onDrop);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onDropRef.current = onDrop;
  });

  // 편집기가 사라질 때 남아 있는 창 이벤트 정리
  useEffect(() => () => cleanupRef.current?.(), []);

  const beginPointer = (e: ReactPointerEvent, src: DragSrc, label: string, cls: string) => {
    if (e.button !== 0) return;
    // 터치에서는 손잡이를 잡았을 때만 블록을 끌어요 (화면 스크롤과 구분)
    if (e.pointerType === 'touch' && src.type === 'block' && !(e.target as HTMLElement).closest('.blk-grip')) return;
    cleanupRef.current?.();
    const startX = e.clientX;
    const startY = e.clientY;
    dragRef.current = { src, x: startX, y: startY, active: false, drop: null, label, cls };
    suppressClick.current = false;

    const move = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (!d.active && Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD) return;
      ev.preventDefault();
      const next: DragState = {
        ...d,
        active: true,
        x: ev.clientX,
        y: ev.clientY,
        drop: computeDrop(ev.clientX, ev.clientY, d.src, getProgramLength()),
      };
      dragRef.current = next;
      setDrag(next);
      // 작업 공간 위/아래 가장자리에서 자동 스크롤
      const ws = workspaceRef.current;
      if (ws) {
        const r = ws.getBoundingClientRect();
        if (ev.clientX > r.left && ev.clientX < r.right) {
          if (ev.clientY < r.top + EDGE_SCROLL_ZONE) ws.scrollTop -= EDGE_SCROLL_STEP;
          else if (ev.clientY > r.bottom - EDGE_SCROLL_ZONE) ws.scrollTop += EDGE_SCROLL_STEP;
        }
      }
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      cleanupRef.current = null;
    };

    const finish = (commit: boolean) => {
      cleanup();
      const d = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!d?.active) return;
      suppressClick.current = true;
      window.setTimeout(() => (suppressClick.current = false), 50);
      if (commit && d.drop) onDropRef.current(d);
    };
    const up = () => finish(true);
    const cancel = () => finish(false);

    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    cleanupRef.current = cleanup;
  };

  return { drag, beginPointer, suppressClick };
}
