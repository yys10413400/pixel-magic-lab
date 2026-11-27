import type { Block, ColorKey, DefineBlock, Grid, LoopFrame, Program, RunError, RunOptions, RunResult, Step } from './types';
import { DEFAULT_PEN_COLOR, colorName } from './palette';
import { MAX_NEST_DEPTH } from './program';

// ─────────────────────────────────────────────
// 실행 엔진
// 프로그램을 해석해서 "한 단계씩의 실행 기록(steps)"을 만듭니다.
// 화면(UI)은 이 기록을 받아 천천히 재생하거나 한 단계씩 보여 줍니다.
// ─────────────────────────────────────────────

export const MAX_REPEAT = 30;
export const DEFAULT_MAX_STEPS = 5000;

export const ERROR_TEXT = {
  outOfBounds: '앗! 마법 펜이 도화지 밖으로 나가려고 해요!',
  repeatTooBig: `반복 횟수가 너무 커요. ${MAX_REPEAT}번 이하로 줄여볼까요?`,
  repeatTooSmall: '반복 횟수는 1번 이상이어야 해요.',
  tooManySteps: '명령이 너무 많이 실행돼서 마법이 잠깐 멈췄어요. 반복 횟수를 줄여볼까요?',
  tooDeep: `반복 안의 반복은 ${MAX_NEST_DEPTH}겹까지만 쓸 수 있어요.`,
  missingDefine: '이 나만의 블록은 만든 곳이 없어요. [나만의 블록 만들기]가 지워졌는지 살펴볼까요?',
  selfCall: '나만의 블록 안에서 자기 자신을 부를 수는 없어요. 끝없이 돌아서 마법이 멈추지 않거든요!',
};

/** [다음 색으로]가 따라가는 무지개 순서. 다른 색에서 시작하면 빨강부터. */
export const RAINBOW: ColorKey[] = ['R', 'O', 'Y', 'G', 'S', 'B', 'P'];

export function nextColor(c: ColorKey): ColorKey {
  const i = RAINBOW.indexOf(c);
  return RAINBOW[(i + 1) % RAINBOW.length];
}

const DIR_DELTA = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
} as const;

const DIR_WORD = { up: '위', down: '아래', left: '왼', right: '오른' } as const;

class Halt {
  error: RunError;
  constructor(error: RunError) {
    this.error = error;
  }
}

export function emptyGrid(width: number, height: number): Grid {
  return Array.from({ length: width * height }, (): ColorKey | null => null);
}

/** 도화지의 가운데 칸. 짝수 크기는 가운데 4칸 중 오른쪽 아래 칸 (8×8 → (4,4)) */
export function centerOf(width: number, height: number): { x: number; y: number } {
  return { x: Math.floor(width / 2), y: Math.floor(height / 2) };
}

export function runProgram(program: Program, opts: RunOptions): RunResult {
  const { width, height } = opts;
  const maxSteps = opts.maxSteps ?? DEFAULT_MAX_STEPS;
  const grid: Grid = opts.base && opts.base.length === width * height ? [...opts.base] : emptyGrid(width, height);
  let x = opts.startX ?? 0;
  let y = opts.startY ?? 0;
  let color: ColorKey = opts.startColor ?? DEFAULT_PEN_COLOR;
  let pen = false;
  const steps: Step[] = [];
  const loops: LoopFrame[] = [];
  /** 나만의 블록: 가장 바깥에 있는 [만들기] 블록들 */
  const defs = new Map<string, DefineBlock>();
  for (const b of program) if (b.type === 'define') defs.set(b.id, b);
  /** 지금 실행 중인 나만의 블록들 (자기 자신 부르기 막기) */
  const calling: string[] = [];

  const push = (s: Omit<Step, 'index' | 'x' | 'y' | 'color' | 'loops' | 'pen'>) => {
    steps.push({ ...s, index: steps.length, x, y, color, pen, loops: loops.map((l) => ({ ...l })) });
  };
  /** 지금 칸을 칠하고 바뀐 내용을 돌려줘요 */
  const paintHere = () => {
    const i = y * width + x;
    const before = grid[i];
    grid[i] = color;
    return { index: i, before, after: color };
  };

  const fail = (error: RunError): never => {
    push({ kind: 'error', blockId: error.blockId, error });
    throw new Halt(error);
  };

  const budget = (blockId: string) => {
    if (steps.length >= maxSteps) fail({ code: 'too-many-steps', blockId, message: ERROR_TEXT.tooManySteps });
  };

  const exec = (list: Block[], depth: number) => {
    for (const b of list) {
      budget(b.id);
      switch (b.type) {
        case 'move': {
          const [dx, dy] = DIR_DELTA[b.dir];
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
            fail({
              code: 'out-of-bounds',
              blockId: b.id,
              message: `${ERROR_TEXT.outOfBounds} 지금 (${x},${y}) 칸에서는 ${DIR_WORD[b.dir]}쪽으로 갈 수 없어요.`,
              target: { x: nx, y: ny },
            });
          }
          x = nx;
          y = ny;
          // 펜이 내려가 있으면 지나가는 칸을 칠해요
          push({ kind: 'move', blockId: b.id, change: pen ? paintHere() : undefined });
          break;
        }
        case 'next': {
          color = nextColor(color);
          push({ kind: 'color', blockId: b.id });
          break;
        }
        case 'pen': {
          pen = b.down;
          // 펜을 내리는 순간 지금 칸도 칠해져요
          push({ kind: 'pen', blockId: b.id, change: pen ? paintHere() : undefined });
          break;
        }
        case 'if': {
          if (depth + 1 > MAX_NEST_DEPTH) fail({ code: 'too-deep', blockId: b.id, message: ERROR_TEXT.tooDeep });
          const filled = grid[y * width + x] !== null;
          const yes = b.cond === 'empty' ? !filled : filled;
          push({ kind: 'check', blockId: b.id, check: yes });
          if (yes) exec(b.body, depth + 1);
          else if (b.elseBody) exec(b.elseBody, depth + 1);
          break;
        }
        case 'define':
          // 만들기 블록은 실행 중에 만나면 그냥 지나가요 (쓰기 블록이 부를 때만 실행)
          break;
        case 'call': {
          const def = defs.get(b.defId);
          if (!def) fail({ code: 'missing-define', blockId: b.id, message: ERROR_TEXT.missingDefine });
          if (calling.includes(b.defId)) fail({ code: 'self-call', blockId: b.id, message: ERROR_TEXT.selfCall });
          if (calling.length >= MAX_NEST_DEPTH) fail({ code: 'too-deep', blockId: b.id, message: ERROR_TEXT.tooDeep });
          push({ kind: 'call', blockId: b.id });
          calling.push(b.defId);
          try {
            exec(def!.body, 0);
          } finally {
            calling.pop();
          }
          break;
        }
        case 'paint': {
          push({ kind: 'paint', blockId: b.id, change: paintHere() });
          break;
        }
        case 'erase': {
          const i = y * width + x;
          const before = grid[i];
          grid[i] = null;
          push({ kind: 'erase', blockId: b.id, change: { index: i, before, after: null } });
          break;
        }
        case 'color': {
          color = b.color;
          push({ kind: 'color', blockId: b.id });
          break;
        }
        case 'repeat': {
          if (depth + 1 > MAX_NEST_DEPTH) fail({ code: 'too-deep', blockId: b.id, message: ERROR_TEXT.tooDeep });
          if (b.times > MAX_REPEAT) fail({ code: 'repeat-too-big', blockId: b.id, message: ERROR_TEXT.repeatTooBig });
          if (b.times < 1) fail({ code: 'repeat-too-small', blockId: b.id, message: ERROR_TEXT.repeatTooSmall });
          const frame: LoopFrame = { blockId: b.id, iter: 0, total: b.times };
          loops.push(frame);
          try {
            for (let k = 1; k <= b.times; k++) {
              budget(b.id);
              frame.iter = k;
              push({ kind: 'loop', blockId: b.id });
              exec(b.body, depth + 1);
            }
          } finally {
            loops.pop();
          }
          break;
        }
      }
    }
  };

  let error: RunError | undefined;
  try {
    exec(program, 0);
  } catch (e) {
    if (e instanceof Halt) error = e.error;
    else throw e;
  }
  return { steps, finalGrid: grid, finalX: x, finalY: y, finalColor: color, error };
}

/** 두 그림을 비교해서 다른 칸의 번호를 돌려줍니다. */
export function diffGrids(a: Grid, b: Grid): number[] {
  const out: number[] = [];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) if ((a[i] ?? null) !== (b[i] ?? null)) out.push(i);
  return out;
}

export function gridsEqual(a: Grid, b: Grid): boolean {
  return a.length === b.length && diffGrids(a, b).length === 0;
}

/** 실행 단계를 사람이 읽을 수 있는 말로 */
export function describeStep(s: Step): string {
  switch (s.kind) {
    case 'move':
      return `펜이 (${s.x},${s.y}) 칸으로 이동했어요`;
    case 'paint':
      return `(${s.x},${s.y}) 칸을 ${colorName(s.color)}색으로 칠했어요`;
    case 'erase':
      return `(${s.x},${s.y}) 칸을 지웠어요`;
    case 'color':
      return `펜 색을 ${colorName(s.color)}색으로 바꿨어요`;
    case 'loop': {
      const l = s.loops[s.loops.length - 1];
      return l ? `반복 ${l.iter}번째 (모두 ${l.total}번)` : '반복';
    }
    case 'pen':
      return s.pen ? `펜을 내렸어요. 지나가는 칸이 ${colorName(s.color)}색으로 칠해져요` : '펜을 올렸어요. 이제 움직여도 칠하지 않아요';
    case 'check':
      return s.check ? '조건이 맞아요! 안쪽 블록을 실행해요' : '조건이 맞지 않아요';
    case 'call':
      return '나만의 블록을 실행해요';
    case 'error':
      return s.error?.message ?? '오류';
  }
}

/** 문자열 그림 → 격자 ('.' = 빈칸) */
export function gridFromRows(rows: string[]): { width: number; height: number; grid: Grid } {
  const height = rows.length;
  const width = Math.max(...rows.map((r) => r.length));
  const grid: Grid = [];
  for (const r of rows)
    for (let i = 0; i < width; i++) {
      const ch = r[i] ?? '.';
      grid.push(ch === '.' ? null : ch);
    }
  return { width, height, grid };
}

export function gridToRows(grid: Grid, width: number): string[] {
  const rows: string[] = [];
  for (let i = 0; i < grid.length; i += width)
    rows.push(
      grid
        .slice(i, i + width)
        .map((c) => c ?? '.')
        .join(''),
    );
  return rows;
}
