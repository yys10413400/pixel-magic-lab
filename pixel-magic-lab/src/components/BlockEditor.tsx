import { Fragment, useEffect, useRef, useState } from 'react';
import type { Block, BlockKind, ColorKey, LoopFrame, Program } from '../engine/types';
import {
  canInsert,
  countBlocks,
  createBlock,
  findBlock,
  insertBlock,
  listLength,
  locate,
  moveBlock,
  removeBlock,
  updateBlock,
  cloneBlock,
  MAX_NEST_DEPTH,
} from '../engine/program';
import { PALETTE, colorHex, colorName, colorInfo } from '../engine/palette';
import { Icon, type IconName } from './Icon';
import { play } from '../lib/sound';

// ─────────────────────────────────────────────
// 명령 블록 편집기
// - 클릭으로 추가 (✦ 표시가 있는 곳에 들어가요)
// - 끌어서 놓기 (마우스·터치 모두), 팔레트로 끌어다 놓으면 삭제
// - 선택한 블록의 ▲▼ 버튼으로 이동 (반복 안/밖으로도 이동)
// ─────────────────────────────────────────────

export const KIND_INFO: Record<BlockKind, { label: string; icon: IconName; cls: string }> = {
  up: { label: '위로 1칸', icon: 'up', cls: 'move' },
  down: { label: '아래로 1칸', icon: 'down', cls: 'move' },
  left: { label: '왼쪽으로 1칸', icon: 'left', cls: 'move' },
  right: { label: '오른쪽으로 1칸', icon: 'right', cls: 'move' },
  paint: { label: '색칠하기', icon: 'brush', cls: 'paint' },
  erase: { label: '지우기', icon: 'eraser', cls: 'erase' },
  color: { label: '색 바꾸기', icon: 'drop', cls: 'color' },
  repeat: { label: '반복하기', icon: 'loop', cls: 'repeat' },
};

/** 팔레트 버튼에 쓰는 짧은 이름 */
const PAL_LABEL: Record<BlockKind, string> = {
  up: '위로',
  down: '아래로',
  left: '왼쪽',
  right: '오른쪽',
  paint: '색칠하기',
  erase: '지우기',
  color: '색 바꾸기',
  repeat: 'N번 반복하기',
};

const REPEAT_MIN = 1;
const REPEAT_MAX = 50;

type Cursor = { listId: string | null; index: number | null };
type DragSrc = { type: 'palette'; kind: BlockKind; color?: ColorKey } | { type: 'block'; id: string };
type Drop = { listId: string | null; index: number } | { trash: true };

interface DragState {
  src: DragSrc;
  x: number;
  y: number;
  active: boolean;
  drop: Drop | null;
  label: string;
  cls: string;
}

interface Props {
  program: Program;
  onChange: (p: Program) => void;
  kinds: BlockKind[];
  activeId?: string | null;
  errorId?: string | null;
  errorMessage?: string | null;
  loops?: LoopFrame[];
  title?: string;
  extraHeader?: React.ReactNode;
  emptyHint?: string;
  startLabel?: string;
}

function blockLabel(b: Block): string {
  if (b.type === 'move') return KIND_INFO[b.dir].label;
  if (b.type === 'color') return `색 바꾸기: ${colorName(b.color)}`;
  if (b.type === 'repeat') return `${b.times}번 반복하기`;
  return KIND_INFO[b.type].label;
}
function blockCls(b: Block): string {
  return b.type === 'move' ? 'move' : KIND_INFO[b.type].cls;
}

export function BlockEditor(props: Props) {
  const { program, onChange, kinds } = props;
  const [cursor, setCursor] = useState<Cursor>({ listId: null, index: null });
  const [selected, setSelected] = useState<string | null>(null);
  const [colorFor, setColorFor] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClick = useRef(false);
  const wsRef = useRef<HTMLDivElement>(null);
  const programRef = useRef(program);
  programRef.current = program;
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;

  // 커서/선택이 사라진 블록을 가리키면 정리
  const validCursor: Cursor = cursor.listId !== null && !findBlock(program, cursor.listId) ? { listId: null, index: null } : cursor;
  const curLen = listLength(program, validCursor.listId);
  const curIndex = validCursor.index === null ? curLen : Math.min(validCursor.index, curLen);
  const selectedValid = selected && findBlock(program, selected) ? selected : null;

  const showToast = (t: string) => {
    setToast(t);
    window.setTimeout(() => setToast((x) => (x === t ? null : x)), 2600);
  };

  const commit = (p: Program) => {
    if (p !== programRef.current) {
      programRef.current = p; // 빠른 연속 클릭에도 최신 상태 유지
      onChange(p);
    }
  };

  // ── 추가 ──
  const addBlock = (block: Block, at?: { listId: string | null; index: number }) => {
    const p = programRef.current;
    let listId = at ? at.listId : validCursor.listId;
    let index = at ? at.index : curIndex;
    if (!canInsert(p, listId, block)) {
      showToast(`반복 안의 반복은 ${MAX_NEST_DEPTH}겹까지만 넣을 수 있어요. 바깥에 넣었어요.`);
      listId = null;
      index = p.length;
    }
    const next = insertBlock(p, listId, index, block);
    commit(next);
    play('add');
    setSelected(block.id);
    if (block.type === 'repeat') setCursor({ listId: block.id, index: null });
    else setCursor({ listId, index: (at ? at.index : validCursor.index === null ? null : index) === null ? null : index + 1 });
  };

  const addKind = (kind: BlockKind, color?: ColorKey) => addBlock(createBlock(kind, color));

  // ── 선택한 블록 이동 (▲▼) : 반복 안/밖으로도 들어가고 나와요 ──
  const nudge = (id: string, dir: -1 | 1) => {
    const p = programRef.current;
    const loc = locate(p, id);
    if (!loc) return;
    const len = listLength(p, loc.listId);
    const list = loc.listId === null ? p : (findBlock(p, loc.listId) as Extract<Block, { type: 'repeat' }>).body;
    const block = list[loc.index];
    let next = p;
    if (dir === -1) {
      if (loc.index > 0) {
        const prev = list[loc.index - 1];
        if (prev.type === 'repeat' && canInsert(removeBlock(p, id), prev.id, block)) next = moveBlock(p, id, prev.id, prev.body.length);
        else next = moveBlock(p, id, loc.listId, loc.index - 1);
      } else if (loc.listId !== null) {
        const parent = locate(p, loc.listId)!;
        next = moveBlock(p, id, parent.listId, parent.index);
      }
    } else {
      if (loc.index < len - 1) {
        const nb = list[loc.index + 1];
        if (nb.type === 'repeat' && canInsert(removeBlock(p, id), nb.id, block)) next = moveBlock(p, id, nb.id, 0);
        else next = moveBlock(p, id, loc.listId, loc.index + 2);
      } else if (loc.listId !== null) {
        const parent = locate(p, loc.listId)!;
        next = moveBlock(p, id, parent.listId, parent.index + 1);
      }
    }
    if (next !== p) {
      play('click');
      commit(next);
      const nl = locate(next, id);
      if (nl) setCursor({ listId: nl.listId, index: nl.index + 1 });
    }
  };

  const remove = (id: string) => {
    const p = programRef.current;
    const loc = locate(p, id);
    commit(removeBlock(p, id));
    play('erase');
    setSelected(null);
    if (loc) setCursor({ listId: loc.listId, index: loc.index });
  };

  const duplicate = (id: string) => {
    const p = programRef.current;
    const b = findBlock(p, id);
    const loc = locate(p, id);
    if (!b || !loc) return;
    const copy = cloneBlock(b);
    if (!canInsert(p, loc.listId, copy)) return;
    commit(insertBlock(p, loc.listId, loc.index + 1, copy));
    play('add');
    setSelected(copy.id);
    setCursor({ listId: loc.listId, index: loc.index + 2 });
  };

  const selectBlock = (id: string) => {
    if (suppressClick.current) return;
    setSelected(id);
    const loc = locate(programRef.current, id);
    if (loc) setCursor({ listId: loc.listId, index: loc.index + 1 });
  };

  const clearAll = () => {
    if (programRef.current.length === 0) return;
    if (!window.confirm('작업 공간의 블록을 모두 지울까요?')) return;
    commit([]);
    setCursor({ listId: null, index: null });
    setSelected(null);
  };

  // ── 끌어서 놓기 ──
  const computeDrop = (x: number, y: number, src: DragSrc): Drop | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!el) return null;
    if (el.closest('[data-trash]')) return src.type === 'block' ? { trash: true } : null;
    const slot = el.closest('[data-slot]') as HTMLElement | null;
    if (slot) return { listId: slot.dataset.list || null, index: Number(slot.dataset.index) };
    const row = el.closest('[data-row]') as HTMLElement | null;
    if (row) {
      const listId = row.dataset.list || null;
      const index = Number(row.dataset.index);
      const r = row.getBoundingClientRect();
      const upper = y < r.top + r.height / 2;
      if (row.dataset.foot) return { listId, index: index + 1 };
      if (row.dataset.head && !upper) return { listId: row.dataset.bid!, index: 0 };
      return { listId, index: upper ? index : index + 1 };
    }
    if (el.closest('[data-ws]')) return { listId: null, index: programRef.current.length };
    return null;
  };

  const beginPointer = (e: React.PointerEvent, src: DragSrc, label: string, cls: string) => {
    if (e.button !== 0) return;
    // 터치에서는 손잡이를 잡았을 때만 끌기 (화면 스크롤과 구분)
    if (e.pointerType === 'touch' && src.type === 'block' && !(e.target as HTMLElement).closest('.blk-grip')) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const st: DragState = { src, x: startX, y: startY, active: false, drop: null, label, cls };
    dragRef.current = st;
    suppressClick.current = false;

    const move = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (!d.active && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 7) return;
      ev.preventDefault();
      const drop = computeDrop(ev.clientX, ev.clientY, d.src);
      const nd = { ...d, active: true, x: ev.clientX, y: ev.clientY, drop };
      dragRef.current = nd;
      setDrag(nd);
      // 작업 공간 가장자리에서 자동 스크롤
      const ws = wsRef.current;
      if (ws) {
        const r = ws.getBoundingClientRect();
        if (ev.clientX > r.left && ev.clientX < r.right) {
          if (ev.clientY < r.top + 36) ws.scrollTop -= 12;
          else if (ev.clientY > r.bottom - 36) ws.scrollTop += 12;
        }
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      const d = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!d || !d.active) return;
      suppressClick.current = true;
      window.setTimeout(() => (suppressClick.current = false), 50);
      const drop = d.drop;
      if (!drop) return;
      if ('trash' in drop) {
        if (d.src.type === 'block') remove(d.src.id);
        return;
      }
      if (d.src.type === 'palette') {
        addBlock(createBlock(d.src.kind, d.src.color), drop);
      } else {
        const p = programRef.current;
        const next = moveBlock(p, d.src.id, drop.listId, drop.index);
        if (next === p) {
          showToast('그 자리에는 놓을 수 없어요.');
          return;
        }
        commit(next);
        play('click');
        setSelected(d.src.id);
        const nl = locate(next, d.src.id);
        if (nl) setCursor({ listId: nl.listId, index: nl.index + 1 });
      }
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  // 키보드: 선택한 블록 지우기
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!selectedValid) return;
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT') return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      remove(selectedValid);
    } else if (e.key === 'ArrowUp' && e.altKey) {
      e.preventDefault();
      nudge(selectedValid, -1);
    } else if (e.key === 'ArrowDown' && e.altKey) {
      e.preventDefault();
      nudge(selectedValid, 1);
    }
  };

  useEffect(() => {
    if (!colorFor) return;
    const close = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('.color-pop')) setColorFor(null);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [colorFor]);

  const loopMap = new Map((props.loops ?? []).map((l) => [l.blockId, l]));
  const dropTarget = drag?.active && drag.drop && !('trash' in drag.drop) ? drag.drop : null;

  const markerAt = (listId: string | null, i: number) => {
    if (drag?.active) return dropTarget !== null && dropTarget.listId === listId && dropTarget.index === i ? 'drop' : null;
    return validCursor.listId === listId && curIndex === i ? 'cursor' : null;
  };

  const Marker = ({ kind }: { kind: 'drop' | 'cursor' }) => (
    <div className={'ins-marker ' + kind} aria-hidden>
      <Icon name="sparkle" size={13} />
      <span>{kind === 'drop' ? '여기에 놓아요' : '다음 블록이 들어갈 곳'}</span>
    </div>
  );

  const renderList = (blocks: Program, listId: string | null) => (
    <div className="blist">
      {blocks.map((b, i) => {
        const mk = markerAt(listId, i);
        return (
          <Fragment key={b.id}>
            {mk && <Marker kind={mk} />}
            {renderBlock(b, i, listId)}
          </Fragment>
        );
      })}
      {(() => {
        const mk = markerAt(listId, blocks.length);
        return mk && (listId !== null || blocks.length > 0) ? <Marker kind={mk} /> : null;
      })()}
      {listId !== null && (
        <button
          type="button"
          className={'loop-slot' + (validCursor.listId === listId ? ' on' : '') + (blocks.length === 0 ? ' empty' : '')}
          data-slot
          data-list={listId}
          data-index={blocks.length}
          onClick={() => {
            setCursor({ listId, index: null });
            setSelected(null);
          }}
        >
          <Icon name="plus" size={14} />
          {blocks.length === 0 ? '반복할 블록을 여기에 넣어요' : '안에 더 넣기'}
        </button>
      )}
    </div>
  );

  const Tools = ({ b }: { b: Block }) => (
    <span className="blk-tools" onPointerDown={(e) => e.stopPropagation()}>
      <button type="button" className="tool" title="위로 옮기기" aria-label="위로 옮기기" onClick={(e) => (e.stopPropagation(), nudge(b.id, -1))}>
        <Icon name="chevUp" size={16} />
      </button>
      <button type="button" className="tool" title="아래로 옮기기" aria-label="아래로 옮기기" onClick={(e) => (e.stopPropagation(), nudge(b.id, 1))}>
        <Icon name="chevDown" size={16} />
      </button>
      <button type="button" className="tool" title="복사하기" aria-label="복사하기" onClick={(e) => (e.stopPropagation(), duplicate(b.id))}>
        <Icon name="copy" size={15} />
      </button>
      <button type="button" className="tool del" title="지우기" aria-label="블록 지우기" onClick={(e) => (e.stopPropagation(), remove(b.id))}>
        <Icon name="trash" size={15} />
      </button>
    </span>
  );

  const renderBlock = (b: Block, index: number, listId: string | null) => {
    const isSel = selectedValid === b.id;
    const isActive = props.activeId === b.id;
    const isErr = props.errorId === b.id;
    const cls = 'blk blk-' + blockCls(b) + (isSel ? ' sel' : '') + (isActive ? ' running' : '') + (isErr ? ' err' : '') + (drag?.active && drag.src.type === 'block' && drag.src.id === b.id ? ' dragging' : '');
    const common = {
      'data-row': true,
      'data-list': listId ?? '',
      'data-index': index,
      'data-bid': b.id,
      onPointerDown: (e: React.PointerEvent) => beginPointer(e, { type: 'block', id: b.id }, blockLabel(b), blockCls(b)),
      onClick: () => selectBlock(b.id),
    };
    const errBubble = isErr && props.errorMessage ? (
      <div className="blk-err-msg" role="alert">
        <b>!</b> {props.errorMessage}
      </div>
    ) : null;

    if (b.type === 'repeat') {
      const lf = loopMap.get(b.id);
      return (
        <div className={'brep' + (isActive || lf ? ' live' : '')}>
          <div className={cls} {...common} data-head="1" ref={isActive ? scrollIntoViewRef : undefined}>
            <span className="blk-grip" title="잡고 끌어서 옮기기">
              <Icon name="grip" size={16} />
            </span>
            <span className="blk-ico">
              <Icon name="loop" size={22} />
            </span>
            <span className="stepper" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
              <button type="button" aria-label="반복 횟수 줄이기" onClick={() => commit(updateBlock(programRef.current, b.id, { times: Math.max(REPEAT_MIN, b.times - 1) }))}>
                −
              </button>
              <input
                aria-label="반복 횟수"
                inputMode="numeric"
                value={b.times}
                onChange={(e) => {
                  const n = parseInt(e.target.value.replace(/\D/g, ''), 10);
                  commit(updateBlock(programRef.current, b.id, { times: Number.isFinite(n) ? Math.max(0, Math.min(99, n)) : REPEAT_MIN }));
                }}
              />
              <button type="button" aria-label="반복 횟수 늘리기" onClick={() => commit(updateBlock(programRef.current, b.id, { times: Math.min(REPEAT_MAX, b.times + 1) }))}>
                +
              </button>
            </span>
            <span className="blk-label">번 반복하기</span>
            {lf && (
              <span className="loop-badge" aria-live="polite">
                {lf.iter}/{lf.total}
              </span>
            )}
            {isSel && <Tools b={b} />}
          </div>
          {errBubble}
          <div className="brep-body">{renderList(b.body, b.id)}</div>
          <div className="brep-foot" data-row data-foot="1" data-list={listId ?? ''} data-index={index} />
        </div>
      );
    }

    return (
      <div className="bwrap">
        <div className={cls} {...common} ref={isActive ? scrollIntoViewRef : undefined}>
          <span className="blk-grip" title="잡고 끌어서 옮기기">
            <Icon name="grip" size={16} />
          </span>
          <span className="blk-ico">
            <Icon name={b.type === 'move' ? KIND_INFO[b.dir].icon : KIND_INFO[b.type].icon} size={22} />
          </span>
          {b.type === 'color' ? (
            <>
              <span className="blk-label">색 바꾸기</span>
              <span className="color-pick" onPointerDown={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="swatch-btn"
                  aria-label={`색 고르기 (지금: ${colorName(b.color)})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setColorFor(colorFor === b.id ? null : b.id);
                  }}
                >
                  <span className="sw" style={{ background: colorHex(b.color) }} />
                  {colorName(b.color)}
                </button>
                {colorFor === b.id && (
                  <span className="color-pop" role="listbox" aria-label="물감 고르기">
                    {PALETTE.map((c) => (
                      <button
                        type="button"
                        key={c.key}
                        className={'pop-sw' + (c.key === b.color ? ' on' : '')}
                        style={{ background: c.hex }}
                        title={c.name}
                        aria-label={c.name}
                        onClick={(e) => {
                          e.stopPropagation();
                          commit(updateBlock(programRef.current, b.id, { color: c.key }));
                          setColorFor(null);
                          play('click');
                        }}
                      />
                    ))}
                  </span>
                )}
              </span>
            </>
          ) : (
            <span className="blk-label">{blockLabel(b)}</span>
          )}
          {isSel && <Tools b={b} />}
        </div>
        {errBubble}
      </div>
    );
  };

  const total = countBlocks(program);
  const showKinds = kinds.filter((k) => k !== 'color');
  const hasColor = kinds.includes('color');

  return (
    <div className="block-editor" onKeyDown={onKeyDown}>
      <div className={'palette' + (drag?.active && drag.src.type === 'block' ? ' trash-on' : '')} data-trash>
        <div className="panel-title">
          <Icon name="wand" size={20} />
          <span>마법 블록</span>
          <small>누르면 ✦ 자리에 들어가요 · 끌어 놓아도 돼요</small>
        </div>
        {drag?.active && drag.src.type === 'block' ? (
          <div className="trash-zone">
            <Icon name="trash" size={26} />
            여기에 놓으면 블록이 지워져요
          </div>
        ) : (
          <>
            <div className="pal-grid">
              {showKinds.map((k) => (
                <button
                  type="button"
                  key={k}
                  className={'pal-blk blk-' + KIND_INFO[k].cls + ' k-' + k}
                  onPointerDown={(e) => beginPointer(e, { type: 'palette', kind: k }, KIND_INFO[k].label, KIND_INFO[k].cls)}
                  onClick={() => !suppressClick.current && addKind(k)}
                >
                  <Icon name={KIND_INFO[k].icon} size={22} />
                  <span>{PAL_LABEL[k]}</span>
                </button>
              ))}
            </div>
            {hasColor && (
              <div className="pal-colors">
                <span className="pal-colors-label">
                  <Icon name="drop" size={18} /> 색 바꾸기
                </span>
                <div className="pal-swatches">
                  {PALETTE.map((c) => (
                    <button
                      type="button"
                      key={c.key}
                      className="pal-sw"
                      style={{ background: c.hex }}
                      title={`색 바꾸기: ${c.name}`}
                      aria-label={`색 바꾸기 블록: ${c.name}`}
                      onPointerDown={(e) => beginPointer(e, { type: 'palette', kind: 'color', color: c.key }, `색 바꾸기: ${c.name}`, 'color')}
                      onClick={() => !suppressClick.current && addKind('color', c.key)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="ws-head">
        <span className="ws-title">
          <Icon name="code" size={20} />
          {props.title ?? '나의 마법 주문'}
        </span>
        <span className="ws-count" title="사용한 블록 수">
          블록 <b>{total}</b>개
        </span>
        {props.extraHeader}
        <button type="button" className="btn-mini" onClick={clearAll} disabled={program.length === 0} title="블록 모두 지우기">
          <Icon name="trash" size={16} /> 비우기
        </button>
      </div>
      <div
        className={'workspace' + (drag?.active ? ' dragging' : '')}
        ref={wsRef}
        data-ws
        tabIndex={0}
        aria-label="명령 블록 작업 공간"
        onClick={(e) => {
          if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('ws-pad')) {
            setCursor({ listId: null, index: null });
            setSelected(null);
          }
        }}
      >
        <div className="ws-start">
          <Icon name="star" size={14} /> {props.startLabel ?? '시작: 펜은 (0,0)에서 출발해요'}
        </div>
        {program.length === 0 ? (
          <div className={'ws-empty' + (markerAt(null, 0) ? ' on' : '')} data-slot data-list="" data-index={0}>
            <Icon name="sparkle" size={26} />
            <p>{props.emptyHint ?? '위의 마법 블록을 눌러서 주문을 시작해요!'}</p>
          </div>
        ) : (
          renderList(program, null)
        )}
        <div className="ws-pad" />
      </div>
      {toast && <div className="editor-toast">{toast}</div>}
      {drag?.active && (
        <div className={'drag-ghost blk blk-' + drag.cls} style={{ left: drag.x + 8, top: drag.y + 8 }}>
          {drag.src.type === 'palette' && drag.src.color ? <span className="sw" style={{ background: colorInfo(drag.src.color)?.hex }} /> : null}
          {drag.label}
        </div>
      )}
    </div>
  );
}

function scrollIntoViewRef(el: HTMLDivElement | null) {
  if (el) {
    try {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } catch {
      /* 무시 */
    }
  }
}

/** 읽기 전용 블록 목록 (정답 예시 보기용) */
export function BlockListView({ program }: { program: Program }) {
  const render = (list: Program) =>
    list.map((b) =>
      b.type === 'repeat' ? (
        <div key={b.id} className="brep ro">
          <div className="blk blk-repeat">
            <span className="blk-ico">
              <Icon name="loop" size={20} />
            </span>
            <span className="blk-label">
              <b className="times-ro">{b.times}</b>번 반복하기
            </span>
          </div>
          <div className="brep-body">
            <div className="blist">{render(b.body)}</div>
          </div>
          <div className="brep-foot" />
        </div>
      ) : (
        <div key={b.id} className={'blk ro blk-' + blockCls(b)}>
          <span className="blk-ico">
            <Icon name={b.type === 'move' ? KIND_INFO[b.dir].icon : KIND_INFO[b.type].icon} size={20} />
          </span>
          {b.type === 'color' && <span className="sw" style={{ background: colorHex(b.color) }} />}
          <span className="blk-label">{blockLabel(b)}</span>
        </div>
      ),
    );
  return <div className="blist ro-list">{render(program)}</div>;
}
