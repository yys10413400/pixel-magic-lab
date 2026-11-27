import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Playback, type PlaybackOptions } from '../lib/playback';
import { play } from '../lib/sound';

// 실행 재생 컨트롤러(Playback)를 React 화면에 연결하는 훅
export { SPEED_LABEL, SPEED_MS } from '../lib/playback';
export type { RunStatus, RunnerView } from '../lib/playback';
import type { RunnerView } from '../lib/playback';

interface Options extends PlaybackOptions {
  /** 이 값이 바뀌면 (미션·도화지 크기 변경 등) 처음 상태로 돌아가요 */
  resetKey?: unknown;
}

export function useRunner(opts: Options) {
  // 컨트롤러는 항상 최신 옵션을 읽어요 (렌더가 끝난 뒤에 갱신)
  const optsRef = useRef(opts);
  useLayoutEffect(() => {
    optsRef.current = opts;
  });

  // 아래 함수는 렌더 중이 아니라 실행·타이머 때만 ref 를 읽어요 (처음 상태는 opts 로 바로 만들어요)
  // oxlint-disable-next-line react/refs
  const [core] = useState(() => new Playback(() => optsRef.current, { sound: play }, opts));
  const view = useSyncExternalStore(core.subscribe, core.getView, core.getView);

  // 위의 옵션 갱신보다 뒤에 선언해야 새 옵션(크기 등)으로 초기화돼요
  const firstKey = useRef(true);
  useLayoutEffect(() => {
    if (firstKey.current) {
      firstKey.current = false;
      return;
    }
    core.reset();
    // resetKey 는 '바뀌었다'는 신호로만 써요
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [core, opts.resetKey]);

  useEffect(() => () => core.dispose(), [core]);

  return {
    view,
    run: core.run,
    pause: core.pause,
    resume: core.resume,
    step: core.step,
    stepBack: core.stepBack,
    reset: core.reset,
    invalidate: core.invalidate,
    setGrid: core.setGrid,
    showResult: core.showResult,
  };
}

export type Runner = ReturnType<typeof useRunner>;

/** [뒤로]를 누를 수 있는지: 실행한 단계가 있고, 코드가 바뀌기 전의 기록일 때 */
export function canStepBack(view: RunnerView): boolean {
  return view.applied > 0 && view.status !== 'idle';
}
