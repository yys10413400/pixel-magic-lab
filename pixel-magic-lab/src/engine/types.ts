// ─────────────────────────────────────────────
// 블록(프로그램) 데이터 구조 — UI와 실행 엔진이 함께 사용합니다.
// ─────────────────────────────────────────────

export type Direction = 'up' | 'down' | 'left' | 'right';

/** 팔레트 색상 키 (한 글자). '.' 은 빈칸을 뜻합니다. */
export type ColorKey = string;

export type MoveBlock = { id: string; type: 'move'; dir: Direction };
export type PaintBlock = { id: string; type: 'paint' };
export type EraseBlock = { id: string; type: 'erase' };
export type ColorBlock = { id: string; type: 'color'; color: ColorKey };
export type RepeatBlock = { id: string; type: 'repeat'; times: number; body: Block[] };
/** 다음 색으로: 무지개 순서(빨 주 노 초 하늘 파 보)로 펜 색을 한 칸 바꿔요 */
export type NextColorBlock = { id: string; type: 'next' };
/** 펜 내리기(down=true): 지금 칸과 앞으로 지나가는 칸을 칠해요 / 펜 올리기(down=false) */
export type PenBlock = { id: string; type: 'pen'; down: boolean };
/** 만약 이 칸이 (비어 있으면 | 칠해져 있으면) → body, 아니면 → elseBody (null 이면 "아니면" 칸이 없는 블록) */
export type IfCond = 'empty' | 'filled';
export type IfBlock = { id: string; type: 'if'; cond: IfCond; body: Block[]; elseBody: Block[] | null };
/** 나만의 블록 만들기: 이름을 붙인 블록 묶음 (가장 바깥에만 둘 수 있어요). 실행 중에 만나면 그냥 지나가요. */
export type DefineBlock = { id: string; type: 'define'; name: string; body: Block[] };
/** 나만의 블록 쓰기: defId 가 가리키는 묶음을 실행해요 */
export type CallBlock = { id: string; type: 'call'; defId: string };

export type ContainerBlock = RepeatBlock | IfBlock | DefineBlock;
export type Block =
  MoveBlock | PaintBlock | EraseBlock | ColorBlock | RepeatBlock | NextColorBlock | PenBlock | IfBlock | DefineBlock | CallBlock;
export type Program = Block[];

/** 팔레트에서 고를 수 있는 블록 종류 */
export type BlockKind =
  'up' | 'down' | 'left' | 'right' | 'paint' | 'erase' | 'color' | 'repeat' | 'next' | 'penDown' | 'penUp' | 'if' | 'ifElse' | 'define';

/** 픽셀 격자: 길이 width*height, 각 칸은 색상 키 또는 null(빈칸) */
export type Grid = (ColorKey | null)[];

export type ErrorCode =
  'out-of-bounds' | 'repeat-too-big' | 'repeat-too-small' | 'too-many-steps' | 'too-deep' | 'missing-define' | 'self-call';

export interface RunError {
  code: ErrorCode;
  blockId: string;
  message: string;
  /** 오류가 났을 때 펜이 가려고 했던 칸 (도화지 밖 이동) */
  target?: { x: number; y: number };
}

export interface LoopFrame {
  blockId: string;
  iter: number; // 1부터 시작
  total: number;
}

/** 실행 엔진이 내보내는 한 단계의 결과 */
export interface Step {
  index: number;
  kind: 'move' | 'paint' | 'erase' | 'color' | 'loop' | 'pen' | 'check' | 'call' | 'error';
  blockId: string;
  /** 이 단계를 실행한 뒤 펜의 위치 */
  x: number;
  y: number;
  /** 이 단계를 실행한 뒤 선택된 색 */
  color: ColorKey;
  /** 픽셀이 바뀐 경우 */
  change?: { index: number; before: ColorKey | null; after: ColorKey | null };
  /** 현재 실행 중인 반복 블록들 (바깥 → 안쪽) */
  loops: LoopFrame[];
  error?: RunError;
  /** 만약 블록을 살펴본 결과 (kind = 'check') */
  check?: boolean;
  /** 펜이 내려가 있는지 */
  pen?: boolean;
}

export interface RunResult {
  steps: Step[];
  finalGrid: Grid;
  finalX: number;
  finalY: number;
  finalColor: ColorKey;
  error?: RunError;
}

export interface RunOptions {
  width: number;
  height: number;
  base?: Grid;
  startX?: number;
  startY?: number;
  startColor?: ColorKey;
  maxSteps?: number;
}
