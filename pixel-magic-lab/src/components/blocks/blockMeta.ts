import type { Block, BlockKind, IfCond } from '../../engine/types';
import { colorName } from '../../engine/palette';
import { MAX_REPEAT } from '../../engine/interpreter';
import type { IconName } from '../Icon';

// 블록 종류별 이름 · 아이콘 · 색 분류 (편집기, 정답 보기, 끌기 미리보기에서 함께 씀)
// 색 분류(cls): move 이동 · paint 칠하기(펜 포함) · color 색 · repeat 반복 · erase 지우기 · logic 만약 · func 나만의 블록

export const KIND_INFO: Record<BlockKind, { label: string; icon: IconName; cls: string }> = {
  up: { label: '위로 1칸', icon: 'up', cls: 'move' },
  down: { label: '아래로 1칸', icon: 'down', cls: 'move' },
  left: { label: '왼쪽으로 1칸', icon: 'left', cls: 'move' },
  right: { label: '오른쪽으로 1칸', icon: 'right', cls: 'move' },
  paint: { label: '색칠하기', icon: 'brush', cls: 'paint' },
  erase: { label: '지우기', icon: 'eraser', cls: 'erase' },
  color: { label: '색 바꾸기', icon: 'drop', cls: 'color' },
  repeat: { label: '반복하기', icon: 'loop', cls: 'repeat' },
  next: { label: '다음 색으로', icon: 'rainbow', cls: 'color' },
  penDown: { label: '펜 내리기', icon: 'penDown', cls: 'paint' },
  penUp: { label: '펜 올리기', icon: 'penUp', cls: 'paint' },
  if: { label: '만약 ~라면', icon: 'branch', cls: 'logic' },
  ifElse: { label: '만약 ~ 아니면', icon: 'branch', cls: 'logic' },
  define: { label: '나만의 블록 만들기', icon: 'magic', cls: 'func' },
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
  next: '다음 색으로',
  penDown: '펜 내리기',
  penUp: '펜 올리기',
  if: '만약 ~라면',
  ifElse: '만약 ~ 아니면',
  define: '나만의 블록 만들기',
};

/** 팔레트에서 두 칸을 차지하는 블록 (그릇 블록) */
export const WIDE_KINDS: BlockKind[] = ['repeat', 'if', 'ifElse', 'define'];

export const COND_LABEL: Record<IfCond, string> = {
  empty: '비어 있으면',
  filled: '칠해져 있으면',
};

/** [+] [−] 버튼으로 고를 수 있는 반복 횟수. 실행 엔진의 한도와 같아요. */
export const REPEAT_MIN = 1;
export const REPEAT_MAX = MAX_REPEAT;
/** 직접 입력은 조금 더 크게 허용해서, 너무 큰 수를 넣으면 실행할 때 친절한 오류로 알려줘요. */
export const REPEAT_TYPED_MAX = 99;
export const DEFINE_NAME_MAX = 12;

/** 나만의 블록 이름 찾기 (없으면 기본 이름) */
export type NameOf = (defId: string) => string;

export function blockLabel(b: Block, nameOf?: NameOf): string {
  switch (b.type) {
    case 'move':
      return KIND_INFO[b.dir].label;
    case 'color':
      return `색 바꾸기: ${colorName(b.color)}`;
    case 'repeat':
      return `${b.times}번 반복하기`;
    case 'pen':
      return b.down ? '펜 내리기' : '펜 올리기';
    case 'if':
      return `만약 이 칸이 ${COND_LABEL[b.cond]}`;
    case 'define':
      return `나만의 블록 만들기: ${b.name}`;
    case 'call':
      return nameOf ? nameOf(b.defId) : '나만의 블록';
    default:
      return KIND_INFO[b.type].label;
  }
}

export function blockCls(b: Block): string {
  switch (b.type) {
    case 'move':
      return 'move';
    case 'pen':
      return 'paint';
    case 'call':
      return 'func';
    default:
      return KIND_INFO[b.type].cls;
  }
}

export function blockIcon(b: Block): IconName {
  switch (b.type) {
    case 'move':
      return KIND_INFO[b.dir].icon;
    case 'pen':
      return b.down ? 'penDown' : 'penUp';
    case 'call':
      return 'magic';
    default:
      return KIND_INFO[b.type].icon;
  }
}
