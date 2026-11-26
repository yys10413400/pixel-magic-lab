import type { ColorKey, Grid, Program, RunError, RunResult, Step } from '../engine/types';
import { emptyGrid, runProgram } from '../engine/interpreter';
import { DEFAULT_PEN_COLOR } from '../engine/palette';

// ─────────────────────────────────────────────
// 실행 결과(steps)를 화면에 한 단계씩 재생하는 컨트롤러 (React 와 무관한 순수 로직)
// 실행 / 일시정지 / 이어서 / 한 단계 / 처음부터 / 코드 바뀜 처리
// React 쪽에서는 useRunner 훅이 useSyncExternalStore 로 구독해요.
// ─────────────────────────────────────────────

export type RunStatus = 'idle' | 'running' | 'paused' | 'done' | 'error';
import type { SpeedKey } from './storage';

export type { SpeedKey };
export type PlaybackSound = 'paint' | 'erase' | 'move' | 'loop' | 'error';

export const SPEED_MS: Record<SpeedKey, number> = { slow: 650, normal: 320, fast: 110, instant: 0 };
export const SPEED_LABEL: Record<SpeedKey, string> = { slow: '느리게', normal: '보통', fast: '빠르게', instant: '바로' };
/** 반복·색 바꾸기 단계는 조금 더 빨리 지나가요 */
const QUICK_STEP_RATIO = 0.6;

export interface RunnerView {
  status: RunStatus;
  grid: Grid;
  x: number;
  y: number;
  color: ColorKey;
  /** 실행한 단계 수 */
  applied: number;
  /** 전체 단계 수 */
  total: number;
  current?: Step;
  error?: RunError;
  /** 코드가 바뀌어서 화면이 예전 결과인 상태 */
  stale: boolean;
  lastChange?: number;
}

export interface PlaybackOptions {
  width: number;
  height: number;
  base?: Grid;
  program: Program;
  speed: SpeedKey;
  /** 펜 출발 칸 (기본 (0,0)) */
  startX?: number;
  startY?: number;
  onFinish?: (result: RunResult) => void;
}

export interface PlaybackDeps {
  sound?: (name: PlaybackSound) => void;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
}

function startGrid(width: number, height: number, base?: Grid): Grid {
  return base && base.length === width * height ? [...base] : emptyGrid(width, height);
}

export function initialView(o: Pick<PlaybackOptions, 'width' | 'height' | 'base' | 'startX' | 'startY'>): RunnerView {
  return {
    status: 'idle',
    grid: startGrid(o.width, o.height, o.base),
    x: o.startX ?? 0,
    y: o.startY ?? 0,
    color: DEFAULT_PEN_COLOR,
    applied: 0,
    total: 0,
    stale: false,
  };
}

export class Playback {
  private view: RunnerView;
  private trace: RunResult | null = null;
  private timer: unknown = null;
  private listeners = new Set<() => void>();
  private readonly getOpts: () => PlaybackOptions;
  private readonly deps: Required<PlaybackDeps>;

  constructor(getOpts: () => PlaybackOptions, deps: PlaybackDeps = {}, initial: PlaybackOptions = getOpts()) {
    this.getOpts = getOpts;
    this.deps = {
      sound: deps.sound ?? (() => {}),
      setTimer: deps.setTimer ?? ((fn, ms) => globalThis.setTimeout(fn, ms)),
      clearTimer: deps.clearTimer ?? ((id) => globalThis.clearTimeout(id as ReturnType<typeof setTimeout>)),
    };
    this.view = initialView(initial);
  }

  // ── 구독 (useSyncExternalStore 용, 화살표 함수라 this 가 고정돼요) ──
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getView = () => this.view;

  private commit(v: RunnerView) {
    this.view = v;
    for (const fn of this.listeners) fn();
  }

  private stopTimer() {
    if (this.timer !== null) {
      this.deps.clearTimer(this.timer);
      this.timer = null;
    }
  }

  private freshTrace(): RunResult {
    const o = this.getOpts();
    this.trace = runProgram(o.program, { width: o.width, height: o.height, base: o.base, startX: o.startX, startY: o.startY });
    return this.trace;
  }

  /** 다음 단계 하나를 적용한 새 화면 상태 */
  private applyNext(v: RunnerView, withSound: boolean): RunnerView {
    const t = this.trace;
    if (!t || v.applied >= t.steps.length) return v;
    const s = t.steps[v.applied];
    const grid = s.change ? v.grid.slice() : v.grid;
    if (s.change) grid[s.change.index] = s.change.after;
    if (withSound && (s.kind === 'paint' || s.kind === 'erase' || s.kind === 'move' || s.kind === 'loop')) this.deps.sound(s.kind);
    return {
      ...v,
      grid,
      x: s.x,
      y: s.y,
      color: s.color,
      applied: v.applied + 1,
      current: s,
      error: s.error,
      lastChange: s.change ? s.change.index : v.lastChange,
    };
  }

  private finishIfDone(v: RunnerView): RunnerView {
    const t = this.trace;
    if (!t || v.applied < t.steps.length) return v;
    this.stopTimer();
    if (t.error) this.deps.sound('error');
    // 결과 알림은 화면이 갱신된 다음에
    const onFinish = this.getOpts().onFinish;
    this.deps.setTimer(() => onFinish?.(t), 0);
    return { ...v, status: t.error ? 'error' : 'done' };
  }

  private tick = () => {
    this.timer = null;
    if (this.view.status !== 'running') return;
    const v = this.finishIfDone(this.applyNext(this.view, this.getOpts().speed !== 'fast'));
    this.commit(v);
    if (v.status === 'running') this.schedule();
  };

  private schedule() {
    this.stopTimer();
    const next = this.trace?.steps[this.view.applied];
    let ms = SPEED_MS[this.getOpts().speed];
    if (next?.kind === 'loop' || next?.kind === 'color') ms = Math.round(ms * QUICK_STEP_RATIO);
    this.timer = this.deps.setTimer(this.tick, ms);
  }

  // ── 조작 ──
  run = () => {
    this.stopTimer();
    const t = this.freshTrace();
    let v: RunnerView = { ...initialView(this.getOpts()), status: 'running', total: t.steps.length };
    if (this.getOpts().speed === 'instant' || t.steps.length === 0) {
      while (v.applied < t.steps.length) v = this.applyNext(v, false);
      if (!t.error && t.steps.length > 0) this.deps.sound('paint');
      this.commit(this.finishIfDone(v));
      return;
    }
    this.commit(v);
    this.schedule();
  };

  pause = () => {
    if (this.view.status !== 'running') return;
    this.stopTimer();
    this.commit({ ...this.view, status: 'paused' });
  };

  resume = () => {
    if (this.view.status !== 'paused') return;
    this.commit({ ...this.view, status: 'running' });
    this.schedule();
  };

  step = () => {
    this.stopTimer();
    let v = this.view;
    if (v.status === 'idle' || v.status === 'done' || v.status === 'error' || !this.trace) {
      const t = this.freshTrace();
      v = { ...initialView(this.getOpts()), status: 'paused', total: t.steps.length };
      if (t.steps.length === 0) {
        this.commit({ ...v, status: 'done' });
        const onFinish = this.getOpts().onFinish;
        this.deps.setTimer(() => onFinish?.(t), 0);
        return;
      }
    }
    this.commit(this.finishIfDone(this.applyNext({ ...v, status: 'paused' }, true)));
  };

  /** 처음 상태로 (도화지 초기화) */
  reset = () => {
    this.stopTimer();
    this.trace = null;
    this.commit(initialView(this.getOpts()));
  };

  /** 코드가 바뀌었을 때: 실행 중이면 멈추고 처음 상태로, 끝난 결과는 '예전 결과' 표시 */
  invalidate = () => {
    const v = this.view;
    if (v.status === 'running' || v.status === 'paused') {
      this.reset();
    } else if (v.status === 'done' || v.status === 'error') {
      this.commit({ ...v, status: 'idle', stale: true, current: undefined, error: undefined });
    }
  };

  /** 손으로 칠하기 등으로 화면 그림을 직접 바꿀 때 */
  setGrid = (grid: Grid) => {
    this.stopTimer();
    const v = this.view;
    this.commit({ ...v, grid, status: v.status === 'running' || v.status === 'paused' ? 'idle' : v.status });
  };

  /** 그림을 바로 보여주기 (불러오기 등) */
  showResult = (grid: Grid) => {
    this.stopTimer();
    this.trace = null;
    this.commit({ ...initialView(this.getOpts()), grid });
  };

  dispose = () => {
    this.stopTimer();
    this.listeners.clear();
  };
}
