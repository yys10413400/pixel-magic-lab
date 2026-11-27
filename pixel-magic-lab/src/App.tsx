import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './components/Icon';
import { WizardSprite } from './components/Wizard';
import { ConfirmDialog, Modal, Stars, type ConfirmState } from './components/ui';
import { MissionMode } from './modes/MissionMode';
import { WorkshopMode } from './modes/WorkshopMode';
import { TheaterMode } from './modes/TheaterMode';
import {
  loadProgress,
  loadSettings,
  resetProgress,
  saveProgress,
  saveSettings,
  takeOldProgressNotice,
  type Progress,
  type Settings,
  type SpeedKey,
} from './lib/storage';
import { setMuted, play } from './lib/sound';
import { MISSION_DATA, titleFor, DIFFICULTY_LABEL } from './data/missions';
import { countBlocks, parseProgram } from './engine/program';

export type ModeKey = 'mission' | 'workshop' | 'theater';
export interface ModeHandle {
  isDirty: () => boolean;
  save: () => boolean;
}

const MODES: { key: ModeKey; label: string; short: string; sub: string; icon: 'map' | 'brush' | 'film' }[] = [
  { key: 'mission', label: '마법 따라 그리기', short: '미션', sub: '미션', icon: 'map' },
  { key: 'workshop', label: '자유 픽셀 공방', short: '공방', sub: '창작', icon: 'brush' },
  { key: 'theater', label: '움직이는 픽셀 극장', short: '극장', sub: '애니메이션', icon: 'film' },
];

export default function App() {
  const [mode, setMode] = useState<ModeKey>('mission');
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [progress, setProgressState] = useState<Progress>(() => loadProgress());
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [teacherOpen, setTeacherOpen] = useState(false);
  // 예전 미션 기록이 있었으면 한 번 안내해요
  const [newMissionsNotice, setNewMissionsNotice] = useState(() => takeOldProgressNotice());
  const [isFull, setIsFull] = useState(false);
  const workshopRef = useRef<ModeHandle | null>(null);
  const theaterRef = useRef<ModeHandle | null>(null);

  useEffect(() => {
    setMuted(settings.muted);
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    const f = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', f);
    return () => document.removeEventListener('fullscreenchange', f);
  }, []);

  const setProgress = useCallback((fn: (p: Progress) => Progress) => {
    setProgressState((prev) => {
      const next = fn(prev);
      saveProgress(next);
      return next;
    });
  }, []);

  const setSpeed = useCallback((speed: SpeedKey) => setSettings((s) => ({ ...s, speed })), []);
  const ask = useCallback((c: ConfirmState) => setConfirm(c), []);

  const totalStars = Object.values(progress.missions).reduce((a, r) => a + r.stars, 0);
  const doneCount = Object.keys(progress.missions).length;

  const switchMode = (next: ModeKey) => {
    if (next === mode) return;
    const handle = mode === 'workshop' ? workshopRef.current : mode === 'theater' ? theaterRef.current : null;
    if (handle && handle.isDirty()) {
      setConfirm({
        title: '저장하지 않은 작품이 있어요',
        message: (
          <>
            지금 만든 작품을 <b>작품 보관함</b>에 저장할까요?
            <br />
            <small>저장하지 않아도 이 화면으로 돌아오면 이어서 만들 수 있어요.</small>
          </>
        ),
        confirmText: '저장하고 이동',
        cancelText: '머무르기',
        extra: { text: '저장 없이 이동', onClick: () => setMode(next) },
        onConfirm: () => {
          if (handle.save()) setMode(next);
        },
      });
      return;
    }
    play('click');
    setMode(next);
  };

  const toggleFull = () => {
    try {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen();
    } catch {
      /* 전체 화면을 지원하지 않는 브라우저 */
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Logo />
          <div className="brand-text">
            <h1>픽셀 마법사 연구소</h1>
            <p>작은 픽셀에 마법을 걸어봐!</p>
          </div>
        </div>
        <nav className="mode-tabs" aria-label="모드 선택">
          {MODES.map((m) => (
            <button
              type="button"
              key={m.key}
              className={'mode-tab t-' + m.key + (mode === m.key ? ' on' : '')}
              aria-current={mode === m.key ? 'page' : undefined}
              onClick={() => switchMode(m.key)}
            >
              <Icon name={m.icon} size={22} />
              <span className="mt-label">{m.label}</span>
              <span className="mt-short" aria-hidden>
                {m.short}
              </span>
            </button>
          ))}
        </nav>
        <div className="top-tools">
          <div className="wizard-badge" title={`모은 별 ${totalStars}개 · 완료한 미션 ${doneCount}개`}>
            <Icon name="star" size={18} className="gold" />
            <b>{totalStars}</b>
            <span className="wb-title">{titleFor(totalStars)}</span>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={() => setSettings((s) => ({ ...s, muted: !s.muted }))}
            aria-label={settings.muted ? '소리 켜기' : '소리 끄기'}
            title={settings.muted ? '소리 켜기' : '소리 끄기'}
          >
            <Icon name={settings.muted ? 'mute' : 'sound'} size={22} />
          </button>
          <button type="button" className="btn-icon" onClick={toggleFull} aria-label="전체 화면" title="전체 화면">
            <Icon name={isFull ? 'shrink' : 'expand'} size={22} />
          </button>
          <button type="button" className="btn-icon" onClick={() => setHelpOpen(true)} aria-label="사용 방법" title="사용 방법">
            <Icon name="help" size={22} />
          </button>
          <button type="button" className="btn-icon" onClick={() => setTeacherOpen(true)} aria-label="선생님 도구" title="선생님 도구">
            <Icon name="teacher" size={22} />
          </button>
        </div>
      </header>

      <main className="stage-area">
        <div className="mode-pane" hidden={mode !== 'mission'}>
          <MissionMode
            active={mode === 'mission'}
            progress={progress}
            setProgress={setProgress}
            speed={settings.speed}
            setSpeed={setSpeed}
            ask={ask}
          />
        </div>
        <div className="mode-pane" hidden={mode !== 'workshop'}>
          <WorkshopMode
            active={mode === 'workshop'}
            handleRef={workshopRef}
            speed={settings.speed}
            setSpeed={setSpeed}
            ask={ask}
            advanced={settings.advanced}
          />
        </div>
        <div className="mode-pane" hidden={mode !== 'theater'}>
          <TheaterMode
            active={mode === 'theater'}
            handleRef={theaterRef}
            speed={settings.speed}
            setSpeed={setSpeed}
            ask={ask}
            advanced={settings.advanced}
          />
        </div>
      </main>

      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />

      <Modal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="이렇게 사용해요"
        className="help"
        icon={<Icon name="help" size={24} />}
      >
        <HelpContent />
      </Modal>

      <Modal
        open={newMissionsNotice && mode === 'mission'}
        onClose={() => setNewMissionsNotice(false)}
        title="미션이 새로 바뀌었어요"
        icon={<Icon name="map" size={24} />}
        footer={
          <button type="button" className="btn btn-primary" data-autofocus onClick={() => setNewMissionsNotice(false)}>
            새 미션 시작하기
          </button>
        }
      >
        <div className="concept-body">
          <WizardSprite size={84} />
          <p>
            미션이 24개로 새로 바뀌었어요! 새 블록(다음 색으로, 펜, 만약, 나만의 블록)과 되감기가 생겼어요. 예전 미션의 별 기록은 새 미션과
            맞지 않아서 지웠어요. 공방 작품과 애니메이션은 그대로 있어요.
          </p>
        </div>
      </Modal>

      <Modal
        open={teacherOpen}
        onClose={() => setTeacherOpen(false)}
        title="선생님 도구"
        className="teacher"
        icon={<Icon name="teacher" size={24} />}
      >
        <div className="teacher-grid">
          <section>
            <h3>수업 설정</h3>
            <label className="switch">
              <input
                type="checkbox"
                checked={progress.unlockAll}
                onChange={(e) => setProgress((p) => ({ ...p, unlockAll: e.target.checked }))}
              />
              <span className="sw-track" />
              모든 미션 바로 열기 (잠금 해제)
            </label>
            <p className="note">수업 진도에 맞춰 원하는 미션으로 바로 이동할 수 있어요. 미션 화면의 [미션 지도]에서 고르세요.</p>
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.advanced}
                onChange={(e) => setSettings((s) => ({ ...s, advanced: e.target.checked }))}
              />
              <span className="sw-track" />
              공방·극장에서 고급 블록 쓰기
            </label>
            <p className="note">[만약 ~라면] [만약 ~ 아니면] [나만의 블록 만들기]가 블록 상자에 나와요. 5~6학년 수업에 알맞아요.</p>
            <button type="button" className="btn" onClick={toggleFull}>
              <Icon name="expand" size={18} /> 전체 화면으로 보기
            </button>
            <h3>기록 관리</h3>
            <p className="note">
              모든 기록은 이 컴퓨터의 브라우저에만 저장돼요. 회원가입이나 서버가 필요 없어요. 학생 작품은 각 화면의 PNG / GIF 내려받기로
              모을 수 있어요.
            </p>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() =>
                setConfirm({
                  title: '미션 기록을 지울까요?',
                  message: '이 컴퓨터의 미션 별과 도장 기록이 모두 지워져요. 저장한 작품과 애니메이션은 그대로 남아요.',
                  confirmText: '기록 지우기',
                  danger: true,
                  onConfirm: () => {
                    resetProgress();
                    setProgressState(loadProgress());
                  },
                })
              }
            >
              <Icon name="trash" size={18} /> 미션 기록 초기화
            </button>
          </section>
          <section>
            <h3>미션 진행 현황</h3>
            <table className="progress-table">
              <thead>
                <tr>
                  <th>미션</th>
                  <th>난이도</th>
                  <th>핵심 학습</th>
                  <th>별</th>
                  <th>블록 수</th>
                </tr>
              </thead>
              <tbody>
                {MISSION_DATA.map((m) => {
                  const r = progress.missions[m.id];
                  return (
                    <tr key={m.id}>
                      <td>
                        {m.id}. {m.title}
                      </td>
                      <td>
                        <span className={'diff-chip d-' + m.difficulty}>{DIFFICULTY_LABEL[m.difficulty]}</span>
                      </td>
                      <td>{m.learn}</td>
                      <td>{r ? <Stars n={r.stars} size={14} /> : <span className="muted">-</span>}</td>
                      <td>
                        {r ? r.bestBlocks : '-'} / {countBlocks(parseProgram(m.solution))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="note">
              블록 수: 학생 최고 기록 / 정답 예시. 정답 예시 코드는 각 미션의 [힌트] → [정답 예시 보기]에서 확인할 수 있어요.
            </p>
          </section>
        </div>
      </Modal>
    </div>
  );
}

function Logo() {
  return (
    <span className="logo">
      <WizardSprite size={40} />
    </span>
  );
}

function HelpContent() {
  const steps: { icon: 'wand' | 'code' | 'play' | 'step'; title: string; text: string }[] = [
    {
      icon: 'wand',
      title: '1. 블록 고르기',
      text: '왼쪽 위 [마법 블록]을 누르면 아래 작업 공간의 ✦ 자리에 블록이 들어가요. 끌어다 놓아도 돼요.',
    },
    {
      icon: 'code',
      title: '2. 주문 고치기',
      text: '블록을 누르면 ▲▼(옮기기), 복사, 휴지통 버튼이 나와요. 반복 블록의 − / + 로 횟수를 바꿔요.',
    },
    { icon: 'play', title: '3. 실행하기', text: '[실행하기]를 누르면 마법 펜(점선 네모와 별)이 블록 순서대로 움직이며 칸을 칠해요.' },
    {
      icon: 'step',
      title: '4. 한 단계씩 살펴보기',
      text: '[한 단계]를 누르면 명령이 하나씩 실행돼요. 지금 실행 중인 블록은 반짝이는 테두리로 보여요.',
    },
  ];
  return (
    <div className="help-content">
      <div className="help-steps">
        {steps.map((s) => (
          <div className="help-step" key={s.title}>
            <span className="hs-ico">
              <Icon name={s.icon} size={28} />
            </span>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </div>
        ))}
      </div>
      <div className="help-rules">
        <h3>마법 규칙</h3>
        <ul>
          <li>좌표는 (가로, 세로)예요. 왼쪽 위 칸이 (0,0)이고, 오른쪽으로 갈수록 가로 숫자가, 아래로 갈수록 세로 숫자가 커져요.</li>
          <li>
            펜은 보라색으로 출발해요. 미션에서는 왼쪽 위 (0,0)에서, 자유 공방과 픽셀 극장에서는 도화지 가운데(8×8이면 (4,4))에서 출발해요.
            처음 칸은 저절로 칠해지지 않아요.
          </li>
          <li>[색칠하기]를 실행할 때만 칸이 칠해지고, 이동 블록은 펜만 옮겨요. 단, [펜 내리기]를 하면 지나가는 칸이 칠해져요.</li>
          <li>[다음 색으로]는 빨 주 노 초 하늘 파 보 순서로 색을 바꿔요.</li>
          <li>[만약] 블록은 펜이 있는 칸이 비었는지 살펴보고 맞을 때만 안쪽 블록을 실행해요.</li>
          <li>[나만의 블록 만들기]에 블록을 넣고 이름을 붙이면, 블록 상자에 그 이름의 새 블록이 생겨요.</li>
          <li>[◀ 뒤로]를 누르면 실행을 한 단계씩 되돌려서 틀린 곳을 찾을 수 있어요.</li>
          <li>실행할 때마다 도화지는 깨끗하게 다시 시작해요.</li>
          <li>도화지 밖으로 나가려 하면 마법이 멈추고, 문제가 된 블록에 빨간 표시가 생겨요.</li>
        </ul>
        <h3>세 가지 모드</h3>
        <ul>
          <li>
            <b>마법 따라 그리기</b> — 목표 그림과 똑같이 그리는 코딩 미션
          </li>
          <li>
            <b>자유 픽셀 공방</b> — 코드(와 손 그림)로 나만의 작품 만들기, 저장, PNG 내려받기
          </li>
          <li>
            <b>움직이는 픽셀 극장</b> — 여러 장면(프레임)을 이어서 애니메이션 만들기, GIF 내려받기
          </li>
        </ul>
      </div>
    </div>
  );
}
