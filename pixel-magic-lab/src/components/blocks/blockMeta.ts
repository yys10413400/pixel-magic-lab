import type { Block, BlockKind } from '../../engine/types';
import { colorName } from '../../engine/palette';
import { MAX_REPEAT } from '../../engine/interpreter';
import type { IconName } from '../Icon';

// 블록 종류별 이름 · 아이콘 · 색 분류 (편집기, 정답 보기, 끌기 미리보기에서 함께 씀)

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
export const PAL_LABEL: Record<BlockKind, string> = {
  up: '위로',
  down: '아래로',
  left: '왼쪽',
  right: '오른쪽',
  paint: '색칠하기',
  erase: '지우기',
  color: '색 바꾸기',
  repeat: 'N번 반복하기',
};

/** [+] [−] 버튼으로 고를 수 있는 반복 횟수. 실행 엔진의 한도와 같아요. */
export const REPEAT_MIN = 1;
export const REPEAT_MAX = MAX_REPEAT;
/** 직접 입력은 조금 더 크게 허용해서, 너무 큰 수를 넣으면 실행할 때 친절한 오류로 알려줘요. */
export const REPEAT_TYPED_MAX = 99;

export function blockLabel(b: Block): string {
  if (b.type === 'move') return KIND_INFO[b.dir].label;
  if (b.type === 'color') return `색 바꾸기: ${colorName(b.color)}`;
  if (b.type === 'repeat') return `${b.times}번 반복하기`;
  return KIND_INFO[b.type].label;
}

export function blockCls(b: Block): string {
  return b.type === 'move' ? 'move' : KIND_INFO[b.type].cls;
}

export function blockIcon(b: Block): IconName {
  return b.type === 'move' ? KIND_INFO[b.dir].icon : KIND_INFO[b.type].icon;
}
