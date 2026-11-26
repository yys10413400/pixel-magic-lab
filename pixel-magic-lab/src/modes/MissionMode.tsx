import { useCallback, useEffect, useMemo, useState } from 'react';
import { BlockEditor } from '../components/blocks/BlockEditor';
import { BlockListView } from '../components/blocks/BlockList';
import { PixelCanvas, PixelThumb, type DiffMark } from '../components/PixelCanvas';
import { RunControls, StatusBar, Modal, Stars, Stamp, type ConfirmState } from '../components/ui';
import { Icon } from '../components/Icon';
import { WizardGuide, WizardSprite } from '../components/Wizard';
import { useRunner } from '../components/useRunner';
import { MISSION_DATA, getMission, starsFor, DIFFICULTY_LABEL, DIFFICULTY_GRADE, titleFor } from '../data/missions';
import { countBlocks, parseProgram, cloneProgram, usesRepeat } from '../engine/program';
import { diffGrids } from '../engine/interpreter';
import type { Program, RunResult } from '../engine/types';
import type { Progress, SpeedKey } from '../lib/storage';
import { play } from '../lib/sound';

interface Props {
  active: boolean;
  progress: Progress;
  setProgress: (fn: (p: Progress) => Progress) => void;
  speed: SpeedKey;
  setSpeed: (s: SpeedKey) => void;
  ask: (c: ConfirmState) => void;
}

type Feedback = { kind: 'fail' | 'error' | 'success' | 'tip'; text: string } | null;
interface SuccessInfo {
  stars: number;
  blocks: number;
  par: number;
  best: boolean;
  usedLoop: boolean;
  newTitle: string | null;
}

export function MissionMode({ active, progress, setProgress, speed, setSpeed, ask }: Props) {
  const [missionId, setMissionId] = useState<number>(() =>
    MISSION_DATA.some((m) => m.id === progress.lastMission) ? progress.lastMission : 1,
  );
  const mission = getMission(missionId);
  const par = useMemo(() => countBlocks(parseProgram(mission.solution)), [mission]);
  const initialProgram = (id: number): Program => {
    const m = getMission(id);
    const d = progress.drafts[id];
    if (d) return d;
    return m.starter ? parseProgram(m.starter) : [];
  };
  const [program, setProgram] = useState<Program>(() => initialProgram(missionId));
  const [diff, setDiff] = useState<DiffMark[] | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [success, setSuccess] = useState<SuccessInfo | null>(null);
  const [burst, setBurst] = useState(0);
  const [mapOpen, setMapOpen] = useState(false);
  const [concept, setConcept] = useState(() => !!mission.concept && !progress.seenConcepts.includes(mission.id));
  const [hintLevel, setHintLevel] = useState(0);
  const [solutionOpen, setSolutionOpen] = useState(false);
  const [overlay, setOverlay] = useState(false);

  const isUnlocked = useCallback(
    (id: number) => progress.unlockAll || id === 1 || !!progress.missions[id - 1] || !!progress.missions[id],
    [progress],
  );

  const onFinish = (r: RunResult) => {
    if (r.error) {
      play('oops');
      setFeedback({ kind: 'error', text: r.error.message });
      return;
    }
    const d = diffGrids(r.finalGrid, mission.target);
    if (d.length === 0) {
      const blocks = countBlocks(program);
      const stars = starsFor(blocks, par);
      const prev = progress.missions[mission.id];
      const before = Object.values(progress.missions).reduce((a, x) => a + x.stars, 0);
      const gained = Math.max(0, stars - (prev?.stars ?? 0));
      const oldTitle = titleFor(before);
      const nt = titleFor(before + gained);
      setProgress((p) => ({
        ...p,
        missions: {
          ...p.missions,
          [mission.id]: {
            stars: Math.max(stars, prev?.stars ?? 0),
            bestBlocks: prev ? Math.min(prev.bestBlocks, blocks) : blocks,
            code: prev && prev.bestBlocks <= blocks ? prev.code : cloneProgram(program),
            completedAt: Date.now(),
          },
        },
      }));
      play('success');
      setBurst((b) => b + 1);
      setFeedback({ kind: 'success', text: '목표 그림과 똑같아요! 마법 성공!' });
      setDiff(null);
      window.setTimeout(
        () =>
          setSuccess({
            stars,
            blocks,
            par,
            best: !!prev && blocks < prev.bestBlocks,
            usedLoop: usesRepeat(program),
            newTitle: nt !== oldTitle ? nt : null,
          }),
        700,
      );
    } else {
      play('oops');
      setDiff(d.map((index) => ({ index, expected: mission.target[index] })));
      const wrong = d.filter((i) => r.finalGrid[i] !== null).length;
      const missing = d.length - wrong;
      const parts = [];
      if (missing) parts.push(`칠해야 하는 칸 ${missing}개(점선 동그라미)`);
      if (wrong) parts.push(`다르게 칠한 칸 ${wrong}개(X 표시)`);
      setFeedback({ kind: 'fail', text: `목표 그림과 다른 칸이 있어요. 다시 살펴볼까요? ${parts.join(', ')}` });
    }
  };

  const runner = useRunner({ width: mission.width, height: mission.height, program, speed, onFinish, resetKey: missionId });
  const { view } = runner;

  // 다른 모드로 가면 실행 멈춤
  const { pause } = runner;
  useEffect(() => {
    if (!active && (view.status === 'running' || view.status === 'paused')) pause();
  }, [active, view.status, pause]);

  const changeProgram = (p: Program) => {
    setProgram(p);
    runner.invalidate();
    setDiff(null);
    if (feedback?.kind !== 'tip') setFeedback(null);
    setProgress((pr) => ({ ...pr, drafts: { ...pr.drafts, [mission.id]: p } }));
  };

  const goMission = (id: number) => {
    if (!isUnlocked(id)) return;
    const next = getMission(id);
    // 미션이 바뀌면 처음 상태로
    setMissionId(id);
    setProgram(initialProgram(id));
    setDiff(null);
    setFeedback(null);
    setHintLevel(0);
    setOverlay(false);
    if (next.concept && !progress.seenConcepts.includes(id)) setConcept(true);
    setProgress((p) => ({ ...p, lastMission: id }));
    setMapOpen(false);
    setSuccess(null);
    play('click');
  };

  const closeConcept = () => {
    setConcept(false);
    setProgress((p) => (p.seenConcepts.includes(mission.id) ? p : { ...p, seenConcepts: [...p.seenConcepts, mission.id] }));
  };

  const loadSolution = () => {
    ask({
      title: '정답 예시를 불러올까요?',
      message: '작업 공간의 블록이 정답 예시로 바뀌어요. 먼저 스스로 도전해 보는 것도 좋아요!',
      confirmText: '불러오기',
      onConfirm: () => {
        changeProgram(parseProgram(mission.solution));
        setSolutionOpen(false);
      },
    });
  };

  const resetMissionCode = () => {
    ask({
      title: '처음 코드로 되돌릴까요?',
      message: mission.starter ? '고장 난 주문서의 처음 상태로 돌아가요.' : '작업 공간이 비워져요.',
      confirmText: '되돌리기',
      onConfirm: () => changeProgram(mission.starter ? parseProgram(mission.starter) : []),
    });
  };

  const running = view.status === 'running' || view.status === 'paused';
  const errorId = view.status === 'error' ? view.error?.blockId : null;
  const record = progress.missions[mission.id];
  const nextId = mission.id + 1;
  const hasNext = MISSION_DATA.some((m) => m.id === nextId);
  const blocks = countBlocks(program);

  return (
    <div className="mode mission-mode">
      <section className="card col-blocks">
        <BlockEditor
          program={program}
          onChange={changeProgram}
          kinds={mission.blocks}
          activeId={running ? view.current?.blockId : null}
          errorId={errorId}
          errorMessage={view.status === 'error' ? view.error?.message : null}
          loops={running ? view.current?.loops : undefined}
          extraHeader={
            mission.starter ? (
              <button type="button" className="btn-mini" onClick={resetMissionCode} title="처음 코드로">
                <Icon name="undo" size={16} /> 처음 코드
              </button>
            ) : null
          }
        />
      </section>

      <section className="card col-stage">
        <div className="stage-head">
          <button type="button" className="btn btn-map" onClick={() => setMapOpen(true)}>
            <Icon name="map" size={20} /> 미션 지도
          </button>
          <div className="mission-title">
            <span className="m-num">미션 {mission.id}</span>
            <h2>{mission.title}</h2>
            <span className={'diff-chip d-' + mission.difficulty}>{DIFFICULTY_LABEL[mission.difficulty]}</span>
            {record && <Stars n={record.stars} size={16} />}
          </div>
          <div className="m-nav">
            <button
              type="button"
              className="btn-icon"
              disabled={mission.id === 1}
              onClick={() => goMission(mission.id - 1)}
              aria-label="이전 미션"
              title="이전 미션"
            >
              <Icon name="chevLeft" size={22} />
            </button>
            <button
              type="button"
              className="btn-icon"
              disabled={!hasNext || !isUnlocked(nextId)}
              onClick={() => goMission(nextId)}
              aria-label="다음 미션"
              title={hasNext && !isUnlocked(nextId) ? '이 미션을 성공하면 열려요' : '다음 미션'}
            >
              <Icon name={hasNext && !isUnlocked(nextId) ? 'lock' : 'chevRight'} size={22} />
            </button>
          </div>
        </div>
        <div className="canvas-wrap">
          <PixelCanvas
            width={mission.width}
            height={mission.height}
            grid={view.grid}
            axes
            pen={{ x: view.x, y: view.y, color: view.color, mode: view.status === 'error' ? 'error' : running ? 'active' : 'idle' }}
            errorTarget={view.status === 'error' ? view.error?.target : null}
            diff={diff}
            ghost={overlay ? mission.target : null}
            ghostOpacity={0.28}
            lastChange={running ? view.lastChange : undefined}
            label={`미션 도화지 ${mission.width}×${mission.height}`}
          />
          {burst > 0 && <SparkleBurst key={burst} />}
        </div>
        <StatusBar view={view} />
        <RunControls
          view={view}
          speed={speed}
          onSpeed={setSpeed}
          onRun={() => {
            setDiff(null);
            setFeedback(null);
            runner.run();
          }}
          onPause={runner.pause}
          onResume={runner.resume}
          onStep={() => {
            if (view.status !== 'paused') {
              setDiff(null);
              setFeedback(null);
            }
            runner.step();
          }}
          onReset={() => {
            runner.reset();
            setDiff(null);
            setFeedback(null);
          }}
        />
      </section>

      <aside className="card col-side">
        <div className="target-card">
          <div className="tc-head">
            <h3>
              <Icon name="eye" size={18} /> 목표 그림
            </h3>
            <label className="mini-toggle" title="목표 그림을 도화지에 흐리게 겹쳐 보여줘요">
              <input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} />
              겹쳐 보기
            </label>
          </div>
          <div className="tc-canvas">
            <PixelCanvas width={mission.width} height={mission.height} grid={mission.target} axes label="목표 그림" />
          </div>
        </div>
        {/* 마법사가 미션 이야기를 들려주고, 실행 결과(성공 · 다른 칸 · 오류)를 알려줘요 */}
        <WizardGuide
          mood={feedback?.kind === 'success' ? 'happy' : feedback?.kind === 'fail' || feedback?.kind === 'error' ? 'oops' : 'idle'}
          live
          className={'mission-guide fb-' + (feedback?.kind ?? 'none')}
        >
          {feedback ? (
            <p>{feedback.text}</p>
          ) : (
            <>
              <span className="learn-chip">
                <Icon name="sparkle" size={14} /> {mission.learn}
              </span>
              <p>{mission.story}</p>
            </>
          )}
        </WizardGuide>
        <p className="block-meter">
          블록 <b>{blocks}</b>개 사용 중
          <span>
            정답 예시 {par}개{record ? ` · 내 최고 ${record.bestBlocks}개` : ''}
          </span>
        </p>
        <div className="hint-box">
          <div className="hint-head">
            <h3>
              <Icon name="bulb" size={18} /> 힌트
            </h3>
            {hintLevel < mission.hints.length ? (
              <button type="button" className="btn-mini hint-btn" onClick={() => (setHintLevel((h) => h + 1), play('click'))}>
                힌트 보기 {hintLevel + 1}/{mission.hints.length}
              </button>
            ) : (
              <button type="button" className="btn-mini" onClick={() => setSolutionOpen(true)}>
                <Icon name="code" size={15} /> 정답 예시 보기
              </button>
            )}
          </div>
          {hintLevel === 0 ? (
            <p className="hint-empty">막히면 힌트를 하나씩 열어 보세요.</p>
          ) : (
            <ol className="hints">
              {mission.hints.slice(0, hintLevel).map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ol>
          )}
        </div>
      </aside>

      {/* 미션 지도 */}
      <Modal
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        title="미션 지도"
        className="mission-map"
        icon={<Icon name="map" size={24} />}
      >
        <MissionTrail currentId={mission.id} records={progress.missions} isUnlocked={isUnlocked} onPick={goMission} />
        <p className="trail-legend">
          {(['easy', 'normal', 'challenge'] as const).map((d) => (
            <span key={d}>
              <span className={'diff-chip d-' + d}>{DIFFICULTY_LABEL[d]}</span> {DIFFICULTY_GRADE[d]}
            </span>
          ))}
        </p>
        <p className="note center">미션을 성공하면 다음 미션이 열려요. 선생님 도구에서 모든 미션을 열 수 있어요.</p>
      </Modal>

      {/* 새 개념 소개 */}
      <Modal
        open={concept && active && !!mission.concept}
        onClose={closeConcept}
        title={mission.concept?.title}
        className="concept"
        icon={<Icon name="sparkle" size={24} />}
        footer={
          <button type="button" className="btn btn-primary" onClick={closeConcept} data-autofocus>
            알겠어요!
          </button>
        }
      >
        <div className="concept-body">
          <ConceptArt id={mission.id} />
          <p>{mission.concept?.text}</p>
        </div>
      </Modal>

      {/* 정답 예시 */}
      <Modal
        open={solutionOpen}
        onClose={() => setSolutionOpen(false)}
        title={`정답 예시 — 미션 ${mission.id}`}
        className="solution"
        icon={<Icon name="code" size={24} />}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setSolutionOpen(false)}>
              닫기
            </button>
            <button type="button" className="btn btn-primary" onClick={loadSolution}>
              작업 공간에 불러오기
            </button>
          </>
        }
      >
        <p className="note">이 코드는 하나의 예시예요. 순서가 달라도 같은 그림이 나오면 모두 정답이에요! (블록 {par}개)</p>
        <div className="solution-list">
          <BlockListView program={parseProgram(mission.solution)} />
        </div>
      </Modal>

      {/* 성공 */}
      <Modal open={!!success} className="success" onClose={() => setSuccess(null)}>
        {success && (
          <div className="success-body">
            <div className="succ-top">
              <span className="succ-wizard">
                <WizardSprite mood="happy" size={112} />
              </span>
              <div className="succ-headline">
                <h2>미션 성공!</h2>
                <Stars n={success.stars} size={36} />
              </div>
              <span className="succ-stamp">
                <Stamp size={78} />
              </span>
            </div>
            <ul className="succ-facts">
              <li>
                사용한 블록 <b>{success.blocks}</b>개 <span className="muted">(정답 예시 {success.par}개)</span>
              </li>
              {success.stars === 3 ? (
                <li className="bonus">
                  <Icon name="sparkle" size={18} /> 효율 보너스! 아주 짧고 멋진 주문이에요.
                </li>
              ) : (
                <li>
                  <Icon name="bulb" size={18} /> 블록을 {success.par}개까지 줄이면 별 3개를 받을 수 있어요.
                  {!success.usedLoop && mission.blocks.includes('repeat') ? ' [반복하기]를 써 볼까요?' : ''}
                </li>
              )}
              {success.best && (
                <li>
                  <Icon name="star" size={18} /> 지난번보다 블록을 줄였어요! 새로운 최고 기록이에요.
                </li>
              )}
              {success.newTitle && (
                <li className="bonus">
                  <Icon name="wand" size={18} /> 새 칭호: <b>{success.newTitle}</b>
                </li>
              )}
            </ul>
            <div className="succ-actions">
              <button type="button" className="btn" onClick={() => setSuccess(null)}>
                코드 다시 보기
              </button>
              {hasNext ? (
                <button type="button" className="btn btn-primary" data-autofocus onClick={() => goMission(nextId)}>
                  다음 미션 <Icon name="chevRight" size={18} />
                </button>
              ) : (
                <button type="button" className="btn btn-primary" data-autofocus onClick={() => (setSuccess(null), setMapOpen(true))}>
                  모든 미션 완료! 미션 지도 보기
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function SparkleBurst() {
  const pts = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return { id: `star-${i}`, x: Math.cos(a), y: Math.sin(a), d: (i % 3) * 0.08, c: ['#ffd85e', '#f59cc1', '#a68be0', '#7fd8c8'][i % 4] };
  });
  return (
    <div className="burst" aria-hidden>
      {pts.map((p) => (
        <span
          key={p.id}
          style={{ '--dx': `${p.x * 150}px`, '--dy': `${p.y * 150}px`, animationDelay: `${p.d}s`, color: p.c } as React.CSSProperties}
        >
          <Icon name="star" size={26} />
        </span>
      ))}
    </div>
  );
}

/** 새 개념 소개 그림 (작은 픽셀 그림으로 개념을 보여줌) */
function ConceptArt({ id }: { id: number }) {
  const arts: Record<number, string[]> = {
    1: ['.....', '.....', '..P..', '.....', '.....'],
    2: ['.....', 'PPPPP', '.....'],
    3: ['R....', 'RO...', '.OY..', '..YG.'],
    5: ['.K.K.', '.KKK.', '..K..'],
    6: ['RRRRRRR', 'OOOOOOO', 'YYYYYYY'],
    8: ['Y.Y.Y.Y', '.Y.Y.Y.'],
    11: ['BBBBB', 'B...B', 'BBBBB'],
    12: ['K.K.K.', '.K.K.K', 'K.K.K.'],
  };
  const rows = arts[id];
  if (!rows) return null;
  const w = rows[0].length;
  const grid = rows
    .join('')
    .split('')
    .map((c) => (c === '.' ? null : c));
  return (
    <div className="concept-art">
      <PixelThumb grid={grid} width={w} height={rows.length} />
    </div>
  );
}

const TRAIL_COLS = 4;

/**
 * 미션 지도: 12개 미션을 지그재그 길로 이어요.
 * 한 줄에 4개씩, 둘째 줄은 오른쪽에서 왼쪽으로 가서 길이 끊기지 않아요.
 * 마법사는 지금 미션 위에 서 있어요.
 */
function MissionTrail(props: {
  currentId: number;
  records: Progress['missions'];
  isUnlocked: (id: number) => boolean;
  onPick: (id: number) => void;
}) {
  const rows = Math.ceil(MISSION_DATA.length / TRAIL_COLS);
  const place = (i: number) => {
    const row = Math.floor(i / TRAIL_COLS);
    const k = i % TRAIL_COLS;
    const col = row % 2 === 0 ? k : TRAIL_COLS - 1 - k;
    return { row, col };
  };
  // 길: 각 칸 가운데를 차례로 잇는 선 (SVG 좌표 = 칸 수 × 100)
  const points = MISSION_DATA.map((_, i) => {
    const p = place(i);
    return `${p.col * 100 + 50},${p.row * 100 + 50}`;
  }).join(' ');
  return (
    <div className="trail" style={{ gridTemplateRows: `repeat(${rows}, 1fr)` }}>
      <svg className="trail-path" viewBox={`0 0 ${TRAIL_COLS * 100} ${rows * 100}`} preserveAspectRatio="none" aria-hidden>
        <polyline points={points} />
      </svg>
      {MISSION_DATA.map((m, i) => {
        const { row, col } = place(i);
        const r = props.records[m.id];
        const open = props.isUnlocked(m.id);
        const here = m.id === props.currentId;
        return (
          <button
            type="button"
            key={m.id}
            className={'trail-stop d-' + m.difficulty + (open ? '' : ' locked') + (here ? ' current' : '') + (r ? ' done' : '')}
            style={{ gridRow: row + 1, gridColumn: col + 1 }}
            disabled={!open}
            onClick={() => props.onPick(m.id)}
            aria-label={`미션 ${m.id} ${m.title}, ${DIFFICULTY_LABEL[m.difficulty]}${r ? `, 별 ${r.stars}개` : open ? ', 도전할 수 있어요' : ', 잠겨 있어요'}`}
            aria-current={here ? 'step' : undefined}
          >
            {here && (
              <span className="trail-wizard" aria-hidden>
                <WizardSprite size={40} />
              </span>
            )}
            <span className="ts-thumb">
              <PixelThumb grid={m.target} width={m.width} height={m.height} />
              {!open && (
                <span className="ts-lock">
                  <Icon name="lock" size={22} />
                </span>
              )}
            </span>
            <span className="ts-num">{m.id}</span>
            <span className="ts-title">{m.title}</span>
            <span className="ts-meta">
              {r ? (
                <Stars n={r.stars} size={14} />
              ) : (
                <span className={'diff-chip d-' + m.difficulty}>{DIFFICULTY_LABEL[m.difficulty]}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
