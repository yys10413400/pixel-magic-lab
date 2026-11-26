import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BlockEditor } from './blocks/BlockEditor';
import { PixelCanvas } from './PixelCanvas';
import { RunControls, StatusBar } from './ui';
import { Icon } from './Icon';
import { useRunner } from './useRunner';
import { runProgram, centerOf } from '../engine/interpreter';
import { PALETTE } from '../engine/palette';
import type { BlockKind, ColorKey, Grid, Program } from '../engine/types';
import type { SpeedKey } from '../lib/storage';
import { play } from '../lib/sound';

// ─────────────────────────────────────────────
// 창작 스튜디오 (자유 공방 · 픽셀 극장 공용)
// 왼쪽: 명령 블록 / 가운데: 도화지 + 실행 도구
// 그림 = 손 그림 층(밑그림) 위에 코드를 실행한 결과
// ─────────────────────────────────────────────

const ALL_KINDS: BlockKind[] = ['up', 'down', 'left', 'right', 'paint', 'erase', 'color', 'repeat'];

export type Tool = 'code' | 'brush' | 'eraser';

interface Props {
  active: boolean;
  size: number;
  program: Program;
  base: Grid;
  onProgram: (p: Program) => void;
  onBase: (g: Grid) => void;
  onStrokeStart: () => void;
  speed: SpeedKey;
  setSpeed: (s: SpeedKey) => void;
  ghost?: Grid | null;
  resetKey: string;
  stageHead: ReactNode;
  workspaceTitle?: string;
  canvasLabel?: string;
  compactControls?: boolean;
}

export function Studio(p: Props) {
  const [tool, setTool] = useState<Tool>('code');
  const [handColor, setHandColor] = useState<ColorKey>('K');
  const strokeBase = useRef<Grid | null>(null);

  const start = centerOf(p.size, p.size);
  const live = useMemo(() => runStudio(p.program, p.base, p.size), [p.program, p.base, p.size]);
  const runner = useRunner({
    width: p.size,
    height: p.size,
    base: p.base,
    program: p.program,
    speed: p.speed,
    startX: start.x,
    startY: start.y,
    resetKey: `${p.resetKey}:${p.size}`,
  });
  const { view } = runner;

  const { pause } = runner;
  useEffect(() => {
    if (!p.active && (view.status === 'running' || view.status === 'paused')) pause();
  }, [p.active, view.status, pause]);

  const running = view.status === 'running' || view.status === 'paused';
  // 실행하지 않을 때는 지금 코드의 결과를 바로 보여줘요 (실행하면 그리는 과정을 볼 수 있어요)
  const shown = view.status === 'idle' ? live.finalGrid : view.grid;

  const changeProgram = (np: Program) => {
    p.onProgram(np);
    runner.invalidate();
  };

  const paintCell = (i: number, first: boolean) => {
    if (first) {
      if (running || view.status !== 'idle') runner.reset();
      p.onStrokeStart();
      strokeBase.current = p.base;
    }
    const cur = strokeBase.current ?? p.base;
    const val = tool === 'eraser' ? null : handColor;
    if (cur[i] === val) return;
    const next = cur.slice();
    next[i] = val;
    strokeBase.current = next;
    p.onBase(next);
    play(tool === 'eraser' ? 'erase' : 'paint');
  };

  const handMode = tool !== 'code';
  const errorId = view.status === 'error' ? view.error?.blockId : null;

  return (
    <>
      <section className="card col-blocks">
        <BlockEditor
          program={p.program}
          onChange={changeProgram}
          kinds={ALL_KINDS}
          activeId={running ? view.current?.blockId : null}
          errorId={errorId}
          errorMessage={view.status === 'error' ? view.error?.message : null}
          loops={running ? view.current?.loops : undefined}
          title={p.workspaceTitle}
          startLabel={`시작: 펜은 가운데 (${start.x},${start.y})에서 출발해요`}
          emptyHint="블록으로 그림을 그려 보세요! 반복하기를 쓰면 큰 그림도 금방이에요."
        />
      </section>
      <section className="card col-stage">
        <div className="stage-head">{p.stageHead}</div>
        <div className="tool-row">
          <div className="seg" role="radiogroup" aria-label="그리기 방법">
            <button
              type="button"
              role="radio"
              aria-checked={tool === 'code'}
              className={tool === 'code' ? 'on' : ''}
              onClick={() => setTool('code')}
            >
              <Icon name="code" size={18} /> 코드로 그리기
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={tool === 'brush'}
              className={tool === 'brush' ? 'on' : ''}
              onClick={() => setTool('brush')}
              title="손으로 칠한 칸은 '밑그림'이 되고, 코드는 그 위에 그려져요"
            >
              <Icon name="hand" size={18} /> 손으로 칠하기
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={tool === 'eraser'}
              className={tool === 'eraser' ? 'on' : ''}
              onClick={() => setTool('eraser')}
            >
              <Icon name="eraser" size={18} /> 손 지우개
            </button>
          </div>
          {tool === 'brush' ? (
            <div className="hand-palette" role="listbox" aria-label="손 그림 물감">
              {PALETTE.map((c) => (
                <button
                  type="button"
                  key={c.key}
                  className={'hp-sw' + (handColor === c.key ? ' on' : '')}
                  style={{ background: c.hex }}
                  title={c.name}
                  aria-label={c.name}
                  onClick={() => setHandColor(c.key)}
                />
              ))}
            </div>
          ) : (
            <span className="tool-tip">
              {tool === 'code'
                ? live.error
                  ? '실행하면 멈추는 블록이 있어요. ▶ 실행해서 찾아봐요!'
                  : '도화지에는 지금 코드의 결과가 보여요'
                : '칸을 눌러 손 그림을 지워요'}
            </span>
          )}
        </div>
        <div className={'canvas-wrap' + (handMode ? ' hand' : '')}>
          <PixelCanvas
            width={p.size}
            height={p.size}
            grid={shown}
            axes
            pen={
              handMode
                ? null
                : { x: view.x, y: view.y, color: view.color, mode: view.status === 'error' ? 'error' : running ? 'active' : 'idle' }
            }
            errorTarget={view.status === 'error' ? view.error?.target : null}
            ghost={p.ghost}
            ghostOpacity={0.3}
            lastChange={running ? view.lastChange : undefined}
            label={p.canvasLabel}
            cursor={handMode ? (tool === 'eraser' ? 'eraser' : 'brush') : null}
            onPaintStart={handMode ? (i) => paintCell(i, true) : undefined}
            onPaintMove={handMode ? (i) => paintCell(i, false) : undefined}
            onPaintEnd={() => (strokeBase.current = null)}
          />
        </div>
        <StatusBar view={view} />
        <RunControls
          view={view}
          speed={p.speed}
          onSpeed={p.setSpeed}
          onRun={() => {
            setTool('code');
            runner.run();
          }}
          onPause={runner.pause}
          onResume={runner.resume}
          onStep={() => {
            setTool('code');
            runner.step();
          }}
          onReset={runner.reset}
          compact={p.compactControls}
        />
      </section>
    </>
  );
}

/** 프로그램 + 밑그림 → 완성 그림 (공방·극장은 펜이 도화지 가운데에서 출발) */
export function renderArt(program: Program, base: Grid, size: number): Grid {
  return runStudio(program, base, size).finalGrid;
}

export function runStudio(program: Program, base: Grid, size: number) {
  const s = centerOf(size, size);
  return runProgram(program, { width: size, height: size, base, startX: s.x, startY: s.y });
}

/** 캔버스 크기 변경: 왼쪽 위 기준으로 자르거나 늘림 */
export function resizeGrid(g: Grid, from: number, to: number): Grid {
  const out: Grid = Array.from({ length: to * to }, (): ColorKey | null => null);
  for (let y = 0; y < Math.min(from, to); y++) for (let x = 0; x < Math.min(from, to); x++) out[y * to + x] = g[y * from + x] ?? null;
  return out;
}
