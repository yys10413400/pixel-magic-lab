import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import type { BlockKind, ColorKey, DefineBlock } from '../../engine/types';
import { PALETTE } from '../../engine/palette';
import { Icon } from '../Icon';
import { KIND_INFO, PAL_LABEL, WIDE_KINDS } from './blockMeta';
import type { DragSrc } from './useBlockDrag';

// 왼쪽 위 [마법 블록] 상자: 누르면 추가, 끌면 원하는 자리에 놓기.
// 블록을 끌어 오는 동안에는 휴지통이 돼요.

interface Props {
  kinds: BlockKind[];
  /** 작업 공간에 만든 나만의 블록들 (쓰기 블록으로 보여 줘요) */
  defines: DefineBlock[];
  trashMode: boolean;
  suppressClick: RefObject<boolean>;
  onAdd: (kind: BlockKind | 'call', color?: ColorKey, defId?: string) => void;
  onBeginDrag: (e: ReactPointerEvent, src: DragSrc, label: string, cls: string) => void;
}

export function BlockPalette({ kinds, defines, trashMode, suppressClick, onAdd, onBeginDrag }: Props) {
  const showKinds = kinds.filter((k) => k !== 'color');
  const hasColor = kinds.includes('color');

  return (
    <div className={'palette' + (trashMode ? ' trash-on' : '')} data-trash>
      <div className="panel-title">
        <Icon name="wand" size={20} />
        <span>마법 블록</span>
        <small>누르거나 끌어다 놓아요</small>
      </div>
      {trashMode ? (
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
                className={'pal-blk blk-' + KIND_INFO[k].cls + ' k-' + k + (WIDE_KINDS.includes(k) ? ' wide' : '')}
                onPointerDown={(e) => onBeginDrag(e, { type: 'palette', kind: k }, KIND_INFO[k].label, KIND_INFO[k].cls)}
                onClick={() => !suppressClick.current && onAdd(k)}
              >
                <Icon name={KIND_INFO[k].icon} size={22} />
                <span>{PAL_LABEL[k]}</span>
              </button>
            ))}
          </div>
          {defines.length > 0 && (
            <div className="pal-calls" aria-label="내가 만든 블록">
              {defines.map((d) => (
                <button
                  type="button"
                  key={d.id}
                  className="pal-blk blk-func"
                  onPointerDown={(e) => onBeginDrag(e, { type: 'palette', kind: 'call', defId: d.id }, d.name, 'func')}
                  onClick={() => !suppressClick.current && onAdd('call', undefined, d.id)}
                >
                  <Icon name="magic" size={20} />
                  <span>{d.name.trim() || '나만의 블록'}</span>
                </button>
              ))}
            </div>
          )}
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
                    onPointerDown={(e) => onBeginDrag(e, { type: 'palette', kind: 'color', color: c.key }, `색 바꾸기: ${c.name}`, 'color')}
                    onClick={() => !suppressClick.current && onAdd('color', c.key)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
