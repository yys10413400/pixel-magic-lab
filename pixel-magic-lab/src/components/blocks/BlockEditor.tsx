import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Block, BlockKind, ColorKey, LoopFrame, Program } from '../../engine/types';
import {
  canInsert,
  cloneBlock,
  countBlocks,
  createBlock,
  createCall,
  defines,
  findBlock,
  findList,
  isContainer,
  insertBlock,
  listLength,
  locate,
  moveBlock,
  nudgeBlock,
  removeBlock,
  removeDefine,
  topLevelOf,
  updateBlock,
  MAX_NEST_DEPTH,
} from '../../engine/program';
import { colorInfo } from '../../engine/palette';
import { Icon } from '../Icon';
import { ConfirmDialog } from '../ui';
import { play } from '../../lib/sound';
import { BlockPalette } from './BlockPalette';
import { BlockList, EditorProvider, type EditorCtx } from './BlockList';
import { isTrash, useBlockDrag, type DragState, type DropSlot } from './useBlockDrag';

// ─────────────────────────────────────────────
// 명령 블록 편집기
// - 누르면 ✦ 표시 자리에 블록이 들어가요
// - 끌어서 놓기 (마우스·터치 모두), 팔레트 위로 끌어다 놓으면 지워져요
// - 고른 블록의 ▲▼ 버튼(또는 Alt+↑/↓)으로 옮겨요. 반복 안/밖으로도 들어가고 나와요
// - Delete/Backspace 로 고른 블록 지우기
// ─────────────────────────────────────────────

type Cursor = { listId: string | null; index: number | null };

interface Props {
  program: Program;
  onChange: (p: Program) => void;
  kinds: BlockKind[];
  activeId?: string | null;
  errorId?: string | null;
  errorMessage?: string | null;
  loops?: LoopFrame[];
  title?: string;
  extraHeader?: ReactNode;
  emptyHint?: string;
  startLabel?: string;
}

const TOAST_MS = 2600;

export function BlockEditor(props: Props) {
  const { program, onChange, kinds } = props;
  const [cursor, setCursor] = useState<Cursor>({ listId: null, index: null });
  const [selected, setSelected] = useState<string | null>(null);
  const [colorFor, setColorFor] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const wsRef = useRef<HTMLDivElement>(null);

  // 빠른 연속 클릭에도 최신 프로그램으로 계산하도록 ref 에 함께 보관 (렌더 중에는 읽지 않아요)
  const programRef = useRef(program);
  useLayoutEffect(() => {
    programRef.current = program;
  }, [program]);

  // 커서/선택이 사라진 블록을 가리키면 정리
  const validCursor: Cursor = cursor.listId !== null && !findList(program, cursor.listId) ? { listId: null, index: null } : cursor;
  const curLen = listLength(program, validCursor.listId);
  const curIndex = validCursor.index === null ? curLen : Math.min(validCursor.index, curLen);
  const selectedValid = selected && findBlock(program, selected) ? selected : null;

  const toastTimer = useRef<number | null>(null);
  const showToast = (t: string) => {
    setToast(t);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_MS);
  };
  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const commit = (p: Program) => {
    if (p !== programRef.current) {
      programRef.current = p;
      onChange(p);
    }
  };

  /** 블록을 놓은 뒤 커서를 그 블록 바로 뒤로 */
  const placeCursorAfter = (p: Program, id: string) => {
    const nl = locate(p, id);
    if (nl) setCursor({ listId: nl.listId, index: nl.index + 1 });
  };

  // ── 추가 ──
  const addBlock = (block: Block, at?: DropSlot) => {
    const p = programRef.current;
    let listId = at ? at.listId : validCursor.listId;
    let index = at ? at.index : curIndex;
    // 나만의 블록을 자기 자신의 [만들기] 안에 넣으면 끝없이 돌아요 → 바깥 맨 아래에 넣어요
    if (block.type === 'call' && topLevelOf(p, listId) === block.defId) {
      showToast('나만의 블록 안에는 자기 자신을 넣을 수 없어요. 바깥 맨 아래에 넣었어요.');
      listId = null;
      index = p.length;
    } else if (!canInsert(p, listId, block)) {
      showToast(
        block.type === 'define'
          ? '나만의 블록 만들기는 맨 바깥에만 놓을 수 있어요. 맨 아래에 넣었어요.'
          : `반복 안의 반복은 ${MAX_NEST_DEPTH}겹까지만 넣을 수 있어요. 바깥에 넣었어요.`,
      );
      listId = null;
      index = p.length;
    }
    commit(insertBlock(p, listId, index, block));
    play('add');
    setSelected(block.id);
    // 그릇 블록을 넣으면 다음 블록은 그 안으로 들어가요
    if (isContainer(block)) setCursor({ listId: block.id, index: null });
    // 커서가 "맨 끝"을 따라가는 중이면 계속 맨 끝, 아니면 넣은 블록 바로 뒤
    else setCursor({ listId, index: !at && validCursor.index === null ? null : index + 1 });
  };

  const addKind = (kind: BlockKind | 'call', color?: ColorKey, defId?: string) =>
    addBlock(kind === 'call' ? createCall(defId!) : createBlock(kind, color));

  const nudge = (id: string, dir: -1 | 1) => {
    const p = programRef.current;
    const next = nudgeBlock(p, id, dir);
    if (next === p) return;
    play('click');
    commit(next);
    placeCursorAfter(next, id);
  };

  const remove = (id: string) => {
    const p = programRef.current;
    const loc = locate(p, id);
    // 나만의 블록 만들기를 지우면 그 블록을 쓰는 곳도 함께 지워요
    const isDef = findBlock(p, id)?.type === 'define';
    const next = isDef ? removeDefine(p, id) : removeBlock(p, id);
    if (isDef && countBlocks(next) < countBlocks(p) - countBlocks([findBlock(p, id)!]))
      showToast('이 나만의 블록을 쓰던 곳도 함께 지웠어요.');
    commit(next);
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
    if (!canInsert(p, loc.listId, copy)) {
      showToast(`반복 안의 반복은 ${MAX_NEST_DEPTH}겹까지만 넣을 수 있어요.`);
      return;
    }
    commit(insertBlock(p, loc.listId, loc.index + 1, copy));
    play('add');
    setSelected(copy.id);
    setCursor({ listId: loc.listId, index: loc.index + 2 });
  };

  const onDrop = (d: DragState) => {
    const drop = d.drop;
    if (!drop) return;
    if (isTrash(drop)) {
      if (d.src.type === 'block') remove(d.src.id);
      return;
    }
    if (d.src.type === 'palette') {
      addBlock(d.src.kind === 'call' ? createCall(d.src.defId!) : createBlock(d.src.kind, d.src.color), drop);
      return;
    }
    const p = programRef.current;
    const next = moveBlock(p, d.src.id, drop.listId, drop.index);
    if (next === p) {
      showToast('그 자리에는 놓을 수 없어요.');
      return;
    }
    commit(next);
    play('click');
    setSelected(d.src.id);
    placeCursorAfter(next, d.src.id);
  };

  const { drag, beginPointer, suppressClick } = useBlockDrag({
    workspaceRef: wsRef,
    getProgramLength: () => programRef.current.length,
    onDrop,
  });

  const selectBlock = (id: string) => {
    if (suppressClick.current) return;
    setSelected(id);
    placeCursorAfter(programRef.current, id);
  };

  // 키보드: 고른 블록 지우기 / 옮기기
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!selectedValid) return;
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      remove(selectedValid);
    } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      nudge(selectedValid, e.key === 'ArrowUp' ? -1 : 1);
    } else if (e.key === 'Escape') {
      setSelected(null);
    }
  };

  // 색 고르기 창 밖을 누르면 닫기
  useEffect(() => {
    if (!colorFor) return;
    const close = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('.color-pick')) setColorFor(null);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [colorFor]);

  // 나만의 블록: 이름표와 팔레트에 보여 줄 목록
  const myBlocks = useMemo(() => defines(program), [program]);
  const defNames = useMemo(() => new Map(myBlocks.map((d) => [d.id, d.name.trim()])), [myBlocks]);

  const loops = useMemo(() => new Map((props.loops ?? []).map((l) => [l.blockId, l])), [props.loops]);
  const dragging = !!drag?.active;
  const dropTarget = dragging && drag.drop && !isTrash(drag.drop) ? drag.drop : null;

  const markerAt = (listId: string | null, i: number): 'drop' | 'cursor' | null => {
    if (dragging) return dropTarget && dropTarget.listId === listId && dropTarget.index === i ? 'drop' : null;
    return validCursor.listId === listId && curIndex === i ? 'cursor' : null;
  };

  const ctx: EditorCtx = {
    selectedId: selectedValid,
    activeId: props.activeId ?? null,
    errorId: props.errorId ?? null,
    errorMessage: props.errorMessage ?? null,
    draggingId: dragging && drag.src.type === 'block' ? drag.src.id : null,
    colorFor,
    loops,
    markerAt,
    cursorListId: validCursor.listId,
    select: selectBlock,
    setCursorEnd: (listId) => {
      setCursor({ listId, index: null });
      setSelected(null);
    },
    nudge,
    duplicate,
    remove,
    setTimes: (id, times) => commit(updateBlock(programRef.current, id, { times })),
    setCond: (id, cond) => commit(updateBlock(programRef.current, id, { cond })),
    setName: (id, name) => commit(updateBlock(programRef.current, id, { name })),
    nameOf: (defId) => defNames.get(defId) || '나만의 블록',
    setColor: (id, color) => {
      commit(updateBlock(programRef.current, id, { color }));
      setColorFor(null);
      play('click');
    },
    toggleColorPop: (id) => setColorFor((cur) => (cur === id ? null : id)),
    beginDrag: beginPointer,
  };

  const total = countBlocks(program);
  const trashMode = dragging && drag.src.type === 'block';

  return (
    // 키보드 단축키(Delete, Alt+↑/↓)를 편집기 안 어디서든 받기 위한 묶음
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions
    <div className="block-editor" onKeyDown={onKeyDown}>
      <BlockPalette
        kinds={kinds}
        defines={kinds.includes('define') ? myBlocks : []}
        trashMode={trashMode}
        suppressClick={suppressClick}
        onAdd={addKind}
        onBeginDrag={beginPointer}
      />

      <div className="ws-head">
        <span className="ws-title">
          <Icon name="code" size={20} />
          {props.title ?? '나의 마법 주문'}
        </span>
        <span className="ws-count" title="사용한 블록 수">
          블록 <b>{total}</b>개
        </span>
        {props.extraHeader}
        <button
          type="button"
          className="btn-mini"
          onClick={() => setConfirmClear(true)}
          disabled={program.length === 0}
          title="블록 모두 지우기"
        >
          <Icon name="trash" size={16} /> 비우기
        </button>
      </div>
      {/* 빈 곳을 누르면 커서를 맨 끝으로 (마우스 편의 기능, 키보드는 각 자리의 버튼으로 같은 일을 해요) */}
      {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <div
        className={'workspace' + (dragging ? ' dragging' : '')}
        ref={wsRef}
        data-ws
        role="region"
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
        <EditorProvider value={ctx}>
          {program.length === 0 ? (
            <div className={'ws-empty' + (markerAt(null, 0) ? ' on' : '')} data-slot data-list="" data-index={0}>
              <Icon name="sparkle" size={26} />
              <p>{props.emptyHint ?? '위의 마법 블록을 눌러서 주문을 시작해요!'}</p>
            </div>
          ) : (
            <BlockList blocks={program} listId={null} />
          )}
        </EditorProvider>
        <div className="ws-pad" />
      </div>
      {toast && (
        <div className="editor-toast" role="status">
          {toast}
        </div>
      )}
      {dragging && (
        <div className={'drag-ghost blk blk-' + drag.cls} style={{ left: drag.x + 8, top: drag.y + 8 }}>
          {drag.src.type === 'palette' && drag.src.color ? (
            <span className="sw" style={{ background: colorInfo(drag.src.color)?.hex }} />
          ) : null}
          {drag.label}
        </div>
      )}
      <ConfirmDialog
        state={
          confirmClear
            ? {
                title: '블록을 모두 지울까요?',
                message: '작업 공간의 블록이 모두 사라져요.',
                confirmText: '모두 지우기',
                danger: true,
                onConfirm: () => {
                  commit([]);
                  setCursor({ listId: null, index: null });
                  setSelected(null);
                },
              }
            : null
        }
        onClose={() => setConfirmClear(false)}
      />
    </div>
  );
}
