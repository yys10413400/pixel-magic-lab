import { useCallback, useEffect, useRef, useState } from 'react';
import type { ColorKey, Grid, Program, RunError, RunResult, Step } from '../engine/types';
import { runProgram, emptyGrid } from '../engine/interpreter';
import { DEFAULT_PEN_COLOR } from '../engine/palette';
import type { SpeedKey } from '../lib/storage';
import { play } from '../lib/sound';

// ─────────────────────────────────────────────
// 실행 엔진의 단계별 결과(steps)를 받아 화면에 천천히 재생하는 훅
// 실행 / 일시정지 / 한 단계 / 처음부터 / 초기화 / 속도 조절
// ─────────────────────────────────────────────

export type RunStatus = 'idle' | 'running' | 'paused' | 'done' | 'error';

export const SPEED_MS: Record<SpeedKey, number> = { slow: 650, normal: 320, fast: 110, instant: 0 };
export const SPEED_LABEL: Record<SpeedKey, string> = { slow: '느리게', normal: '보통', fast: '빠르게', instant: '바로' };

export interface RunnerView {
  status: RunStatus;
  grid: Grid;
  x: number;
  y: number;
  color: ColorKey;
  applied: number; // 실행한 단계 수
  total: number; // 전체 단계 수
  current?: Step;
  error?: RunError;
  stale: boolean; // 코드가 바뀌어서 화면이 예전 결과인 상태
  lastChange?: number;
}

interface Options {
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

function startGrid(width: number, height: number, base?: Grid): Grid {
  return base && base.length === width * height ? [...base] : emptyGrid(width, height);
}

export function useRunner(opts: Options) {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const [view, setView] = useState<RunnerView>(() => ({
    status: 'idle',
    grid: startGrid(opts.width, opts.height, opts.base),
    x: opts.startX ?? 0,
    y: opts.startY ?? 0,
    color: DEFAULT_PEN_COLOR,
    applied: 0,
    total: 0,
    stale: false,
  }));
  const viewRef = useRef(view);
  const traceRef = useRef<RunResult | null>(null);
  const timerRef = useRef<number | null>(null);

  const commit = (v: RunnerView) => {
    viewRef.current = v;
    setView(v);
  };

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const freshTrace = () => {
    const o = optsRef.current;
    const t = runProgram(o.program, { width: o.width, height: o.height, base: o.base, startX: o.startX, startY: o.startY });
    traceRef.current = t;
    return t;
  };

  /** 다음 단계 하나를 적용. 끝나면 false */
  const applyNext = (v: RunnerView, withSound: boolean): RunnerView => {
    const t = traceRef.current;
    if (!t || v.applied >= t.steps.length) return v;
    const s = t.steps[v.applied];
    const grid = s.change ? v.grid.slice() : v.grid;
    if (s.change) grid[s.change.index] = s.change.after;
    if (withSound) {
      if (s.kind === 'paint') play('paint');
      else if (s.kind === 'erase') play('erase');
      else if (s.kind === 'move') play('move');
      else if (s.kind === 'loop') play('loop');
    }
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
  };

  const finishIfDone = (v: RunnerView): RunnerView => {
    const t = traceRef.current;
    if (!t || v.applied < t.steps.length) return v;
    clearTimer();
    const done: RunnerView = { ...v, status: t.error ? 'error' : 'done' };
    if (t.error) play('error');
    // 결과 알림은 화면이 갱신된 뒤에
    window.setTimeout(() => optsRef.current.onFinish?.(t), 0);
    return done;
  };

  const tick = () => {
    timerRef.current = null;
    let v = viewRef.current;
    if (v.status !== 'running') return;
    v = applyNext(v, optsRef.current.speed !== 'fast');
    v = finishIfDone(v);
    commit(v);
    if (v.status === 'running') schedule();
  };

  const schedule = () => {
    clearTimer();
    const t = traceRef.current;
    const v = viewRef.current;
    const next = t?.steps[v.applied];
    let ms = SPEED_MS[optsRef.current.speed];
    if (next?.kind === 'loop' || next?.kind === 'color') ms = Math.round(ms * 0.6);
    timerRef.current = window.setTimeout(tick, ms);
  };

  const initialView = (): RunnerView => {
    const o = optsRef.current;
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
  };

  const run = useCallback(() => {
    clearTimer();
    const t = freshTrace();
    let v: RunnerView = { ...initialView(), status: 'running', total: t.steps.length };
    if (optsRef.current.speed === 'instant' || t.steps.length === 0) {
      while (v.applied < t.steps.length) v = applyNext(v, false);
      if (!t.error && t.steps.length > 0) play('paint');
      commit(finishIfDone(v));
      return;
    }
    commit(v);
    schedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pause = useCallback(() => {
    if (viewRef.current.status !== 'running') return;
    clearTimer();
    commit({ ...viewRef.current, status: 'paused' });
  }, []);

  const resume = useCallback(() => {
    if (viewRef.current.status !== 'paused') return;
    commit({ ...viewRef.current, status: 'running' });
    schedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = useCallback(() => {
    clearTimer();
    let v = viewRef.current;
    if (v.status === 'idle' || v.status === 'done' || v.status === 'error' || !traceRef.current) {
      const t = freshTrace();
      v = { ...initialView(), status: 'paused', total: t.steps.length };
      if (t.steps.length === 0) {
        commit({ ...v, status: 'done' });
        window.setTimeout(() => optsRef.current.onFinish?.(t), 0);
        return;
      }
    }
    v = applyNext({ ...v, status: 'paused' }, true);
    v = finishIfDone(v);
    commit(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 처음 상태로 (도화지 초기화) */
  const reset = useCallback(() => {
    clearTimer();
    traceRef.current = null;
    commit(initialView());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 코드가 바뀌었을 때: 실행 중이면 멈추고 처음 상태로, 끝난 결과는 '예전 결과' 표시 */
  const invalidate = useCallback(() => {
    const v = viewRef.current;
    if (v.status === 'running' || v.status === 'paused') {
      clearTimer();
      traceRef.current = null;
      commit(initialView());
    } else if (v.status === 'done' || v.status === 'error') {
      commit({ ...v, status: 'idle', stale: true, current: undefined, error: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 손으로 칠하기 등으로 화면 그림을 직접 바꿀 때 */
  const setGrid = useCallback((grid: Grid) => {
    clearTimer();
    const v = viewRef.current;
    commit({ ...v, grid, status: v.status === 'running' || v.status === 'paused' ? 'idle' : v.status });
  }, []);

  /** 실행 결과를 바로 보여주기 (불러오기 등) */
  const showResult = useCallback((grid: Grid) => {
    clearTimer();
    traceRef.current = null;
    commit({ ...initialView(), grid });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => clearTimer(), []);

  return { view, run, pause, resume, step, reset, invalidate, setGrid, showResult };
}

export type Runner = ReturnType<typeof useRunner>;
