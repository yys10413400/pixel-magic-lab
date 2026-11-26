import { describe, expect, it, vi } from 'vitest';
import { Playback, type PlaybackOptions } from '../src/lib/playback';
import { parseProgram } from '../src/engine/program';
import type { RunResult } from '../src/engine/types';

// 실행 재생 컨트롤러: 화면 없이 타이머를 직접 돌려서 확인해요
function setup(src: string, extra: Partial<PlaybackOptions> = {}) {
  const timers: { fn: () => void; ms: number }[] = [];
  const sounds: string[] = [];
  const onFinish = vi.fn<(r: RunResult) => void>();
  const opts: PlaybackOptions = { width: 5, height: 5, program: parseProgram(src), speed: 'normal', onFinish, ...extra };
  const pb = new Playback(() => opts, {
    sound: (s) => sounds.push(s),
    setTimer: (fn, ms) => {
      timers.push({ fn, ms });
      return timers.length;
    },
    clearTimer: () => {},
  });
  /** 쌓인 타이머를 하나씩 실행 (실행 중에 새로 생긴 타이머까지) */
  const flush = (max = 1000) => {
    for (let i = 0; i < max && timers.length; i++) timers.shift()!.fn();
  };
  return { pb, opts, timers, sounds, onFinish, flush };
}

describe('실행 재생 (Playback)', () => {
  it('처음에는 펜이 출발 칸에 있고 기다리는 상태', () => {
    const { pb } = setup('R paint', { startX: 2, startY: 3 });
    expect(pb.getView()).toMatchObject({ status: 'idle', x: 2, y: 3, applied: 0 });
  });

  it('실행하면 한 단계씩 진행하고 끝나면 결과를 알려줘요', () => {
    const { pb, flush, onFinish, sounds } = setup('R R paint');
    pb.run();
    expect(pb.getView().status).toBe('running');
    flush();
    const v = pb.getView();
    expect(v.status).toBe('done');
    expect(v.applied).toBe(v.total);
    expect(v.grid[2]).toBe('P');
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(sounds).toContain('paint');
  });

  it('바로 속도는 타이머 없이 한 번에 끝나요', () => {
    const { pb, timers } = setup('R paint', { speed: 'instant' });
    pb.run();
    expect(pb.getView().status).toBe('done');
    // 남은 타이머는 결과 알림(0ms) 하나뿐
    expect(timers.map((t) => t.ms)).toEqual([0]);
  });

  it('일시정지 → 한 단계 → 이어서', () => {
    const { pb, timers, flush } = setup('R R R paint');
    pb.run();
    timers.shift()!.fn(); // 1단계
    pb.pause();
    expect(pb.getView()).toMatchObject({ status: 'paused', applied: 1 });
    pb.step();
    expect(pb.getView().applied).toBe(2);
    pb.resume();
    expect(pb.getView().status).toBe('running');
    flush();
    expect(pb.getView().status).toBe('done');
  });

  it('도화지 밖으로 나가면 오류 상태와 오류 소리', () => {
    const { pb, flush, sounds } = setup('L', { speed: 'instant' });
    pb.run();
    flush();
    expect(pb.getView().status).toBe('error');
    expect(pb.getView().error?.code).toBe('out-of-bounds');
    expect(sounds).toContain('error');
  });

  it('코드가 바뀌면: 실행 중이면 처음으로, 끝났으면 예전 결과 표시', () => {
    const { pb, timers, flush } = setup('R R paint');
    pb.run();
    timers.shift()!.fn();
    pb.invalidate();
    expect(pb.getView()).toMatchObject({ status: 'idle', applied: 0 });
    pb.run();
    flush();
    pb.invalidate();
    expect(pb.getView()).toMatchObject({ status: 'idle', stale: true });
    expect(pb.getView().grid[2]).toBe('P');
  });

  it('구독한 쪽에 바뀔 때마다 알려주고, 정리하면 멈춰요', () => {
    const { pb } = setup('R paint', { speed: 'instant' });
    const fn = vi.fn<() => void>();
    const off = pb.subscribe(fn);
    pb.run();
    expect(fn).toHaveBeenCalled();
    off();
    fn.mockClear();
    pb.reset();
    expect(fn).not.toHaveBeenCalled();
  });
});
