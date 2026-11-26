import { createContext, Fragment, useContext, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Block, LoopFrame, Program, RepeatBlock } from '../../engine/types';
import { PALETTE, colorHex, colorName } from '../../engine/palette';
import { Icon } from '../Icon';
import { REPEAT_MAX, REPEAT_MIN, REPEAT_TYPED_MAX, blockCls, blockIcon, blockLabel } from './blockMeta';
import type { DragSrc } from './useBlockDrag';

// 작업 공간 안의 블록 목록 (반복 블록은 안에 목록을 품어요)

export interface EditorCtx {
  selectedId: string | null;
  activeId: string | null;
  errorId: string | null;
  errorMessage: string | null;
  draggingId: string | null;
  colorFor: string | null;
  loops: Map<string, LoopFrame>;
  /** 이 자리(listId, index)에 표시할 끼워 넣기 표시 */
  markerAt: (listId: string | null, index: number) => 'drop' | 'cursor' | null;
  cursorListId: string | null;
  select: (id: string) => void;
  setCursorEnd: (listId: string) => void;
  nudge: (id: string, dir: -1 | 1) => void;
  duplicate: (id: string) => void;
  remove: (id: string) => void;
  setTimes: (id: string, times: number) => void;
  setColor: (id: string, color: string) => void;
  toggleColorPop: (id: string) => void;
  beginDrag: (e: ReactPointerEvent, src: DragSrc, label: string, cls: string) => void;
}

const Ctx = createContext<EditorCtx | null>(null);
export const EditorProvider = Ctx.Provider;

function useEditor(): EditorCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('BlockList 는 EditorProvider 안에서만 쓸 수 있어요');
  return c;
}

export function InsertMarker({ kind }: { kind: 'drop' | 'cursor' }) {
  return (
    <div className={'ins-marker ' + kind} aria-hidden>
      <Icon name="sparkle" size={13} />
      <span>{kind === 'drop' ? '여기에 놓아요' : '다음 블록이 들어갈 곳'}</span>
    </div>
  );
}

export function BlockList({ blocks, listId }: { blocks: Program; listId: string | null }) {
  const ed = useEditor();
  const endMarker = ed.markerAt(listId, blocks.length);
  return (
    <div className="blist">
      {blocks.map((b, i) => {
        const mk = ed.markerAt(listId, i);
        return (
          <Fragment key={b.id}>
            {mk && <InsertMarker kind={mk} />}
            <BlockItem block={b} index={i} listId={listId} />
          </Fragment>
        );
      })}
      {endMarker && (listId !== null || blocks.length > 0) && <InsertMarker kind={endMarker} />}
      {listId !== null && (
        <button
          type="button"
          className={'loop-slot' + (ed.cursorListId === listId ? ' on' : '') + (blocks.length === 0 ? ' empty' : '')}
          data-slot
          data-list={listId}
          data-index={blocks.length}
          onClick={() => ed.setCursorEnd(listId)}
        >
          <Icon name="plus" size={14} />
          {blocks.length === 0 ? '반복할 블록을 여기에 넣어요' : '안에 더 넣기'}
        </button>
      )}
    </div>
  );
}

function BlockTools({ id }: { id: string }) {
  const ed = useEditor();
  const act = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };
  return (
    <span className="blk-tools" onPointerDown={(e) => e.stopPropagation()}>
      <button type="button" className="tool" title="위로 옮기기" aria-label="위로 옮기기" onClick={act(() => ed.nudge(id, -1))}>
        <Icon name="chevUp" size={16} />
      </button>
      <button type="button" className="tool" title="아래로 옮기기" aria-label="아래로 옮기기" onClick={act(() => ed.nudge(id, 1))}>
        <Icon name="chevDown" size={16} />
      </button>
      <button type="button" className="tool" title="복사하기" aria-label="복사하기" onClick={act(() => ed.duplicate(id))}>
        <Icon name="copy" size={15} />
      </button>
      <button type="button" className="tool del" title="지우기" aria-label="블록 지우기" onClick={act(() => ed.remove(id))}>
        <Icon name="trash" size={15} />
      </button>
    </span>
  );
}

function RepeatStepper({ block }: { block: RepeatBlock }) {
  const ed = useEditor();
  // 입력하는 동안에는 칸을 비워 둘 수 있어요 (지우고 새 숫자 쓰기). 칸을 벗어나면 블록 값으로 돌아가요.
  const [typing, setTyping] = useState<string | null>(null);
  const step = (times: number) => {
    setTyping(null);
    ed.setTimes(block.id, times);
  };
  return (
    // 숫자 상자를 누르거나 끌 때 블록 선택·끌기가 시작되지 않도록 막아요
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <span className="stepper" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label="반복 횟수 줄이기"
        disabled={block.times <= REPEAT_MIN}
        onClick={() => step(Math.max(REPEAT_MIN, block.times - 1))}
      >
        −
      </button>
      <input
        aria-label="반복 횟수"
        inputMode="numeric"
        value={typing ?? String(block.times)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 2);
          setTyping(digits);
          if (digits) ed.setTimes(block.id, Math.min(REPEAT_TYPED_MAX, parseInt(digits, 10)));
        }}
        onBlur={() => setTyping(null)}
      />
      <button
        type="button"
        aria-label="반복 횟수 늘리기"
        disabled={block.times >= REPEAT_MAX}
        onClick={() => step(Math.min(REPEAT_MAX, block.times + 1))}
      >
        +
      </button>
    </span>
  );
}

function ColorPicker({ id, color }: { id: string; color: string }) {
  const ed = useEditor();
  return (
    <span className="color-pick" onPointerDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="swatch-btn"
        aria-label={`색 고르기 (지금: ${colorName(color)})`}
        aria-expanded={ed.colorFor === id}
        onClick={(e) => {
          e.stopPropagation();
          ed.toggleColorPop(id);
        }}
      >
        <span className="sw" style={{ background: colorHex(color) }} />
        {colorName(color)}
      </button>
      {ed.colorFor === id && (
        <span className="color-pop" role="group" aria-label="물감 고르기">
          {PALETTE.map((c) => (
            <button
              type="button"
              key={c.key}
              className={'pop-sw' + (c.key === color ? ' on' : '')}
              style={{ background: c.hex }}
              title={c.name}
              aria-label={c.name}
              aria-pressed={c.key === color}
              onClick={(e) => {
                e.stopPropagation();
                ed.setColor(id, c.key);
              }}
            />
          ))}
        </span>
      )}
    </span>
  );
}

function scrollIntoViewRef(el: HTMLDivElement | null) {
  try {
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } catch {
    /* 오래된 브라우저: 스크롤 없이 넘어가요 */
  }
}

function BlockItem({ block: b, index, listId }: { block: Block; index: number; listId: string | null }) {
  const ed = useEditor();
  const isSel = ed.selectedId === b.id;
  const isActive = ed.activeId === b.id;
  const isErr = ed.errorId === b.id;
  const cls =
    'blk blk-' +
    blockCls(b) +
    (isSel ? ' sel' : '') +
    (isActive ? ' running' : '') +
    (isErr ? ' err' : '') +
    (ed.draggingId === b.id ? ' dragging' : '');
  const rowProps = {
    'data-row': true,
    'data-list': listId ?? '',
    'data-index': index,
    'data-bid': b.id,
    // 안에 버튼(옮기기·복사·지우기)이 들어가므로 button 대신 group 으로 두고, Enter/Space 로 고를 수 있게 해요
    role: 'group' as const,
    tabIndex: 0,
    'aria-roledescription': '블록',
    'aria-label': blockLabel(b) + (isSel ? ' (골랐어요)' : ''),
    onPointerDown: (e: ReactPointerEvent) => ed.beginDrag(e, { type: 'block', id: b.id }, blockLabel(b), blockCls(b)),
    onClick: () => ed.select(b.id),
    onKeyDown: (e: React.KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
        e.preventDefault();
        ed.select(b.id);
      }
    },
    ref: isActive ? scrollIntoViewRef : undefined,
  };
  const errBubble =
    isErr && ed.errorMessage ? (
      <div className="blk-err-msg" role="alert">
        <b>!</b> {ed.errorMessage}
      </div>
    ) : null;
  const grip = (
    <span className="blk-grip" title="잡고 끌어서 옮기기">
      <Icon name="grip" size={16} />
    </span>
  );

  if (b.type === 'repeat') {
    const lf = ed.loops.get(b.id);
    return (
      <div className={'brep' + (isActive || lf ? ' live' : '')}>
        <div className={cls} {...rowProps} data-head="1">
          {grip}
          <span className="blk-ico">
            <Icon name="loop" size={22} />
          </span>
          <RepeatStepper block={b} />
          <span className="blk-label">번 반복하기</span>
          {lf && (
            <span className="loop-badge" aria-live="polite">
              {lf.iter}/{lf.total}
            </span>
          )}
          {isSel && <BlockTools id={b.id} />}
          <span className="blk-nub" aria-hidden />
        </div>
        {errBubble}
        <div className="brep-body">
          <BlockList blocks={b.body} listId={b.id} />
        </div>
        <div className="brep-foot" data-row data-foot="1" data-list={listId ?? ''} data-index={index} />
      </div>
    );
  }

  return (
    <div className="bwrap">
      <div className={cls} {...rowProps}>
        {grip}
        <span className="blk-ico">
          <Icon name={blockIcon(b)} size={22} />
        </span>
        {b.type === 'color' ? (
          <>
            <span className="blk-label">색 바꾸기</span>
            <ColorPicker id={b.id} color={b.color} />
          </>
        ) : (
          <span className="blk-label">{blockLabel(b)}</span>
        )}
        {isSel && <BlockTools id={b.id} />}
        <span className="blk-nub" aria-hidden />
      </div>
      {errBubble}
    </div>
  );
}

/** 읽기 전용 블록 목록 (정답 예시 보기용) */
export function BlockListView({ program }: { program: Program }) {
  return (
    <div className="blist ro-list">
      <ReadOnlyList blocks={program} />
    </div>
  );
}

function ReadOnlyList({ blocks }: { blocks: Program }) {
  return (
    <>
      {blocks.map((b) =>
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
              <div className="blist">
                <ReadOnlyList blocks={b.body} />
              </div>
            </div>
            <div className="brep-foot" />
          </div>
        ) : (
          <div key={b.id} className={'blk ro blk-' + blockCls(b)}>
            <span className="blk-ico">
              <Icon name={blockIcon(b)} size={20} />
            </span>
            {b.type === 'color' && <span className="sw" style={{ background: colorHex(b.color) }} />}
            <span className="blk-label">{blockLabel(b)}</span>
          </div>
        ),
      )}
    </>
  );
}
