import { useEffect, useMemo, useState, useLayoutEffect } from 'react';
import { Studio, renderArt, resizeGrid } from '../components/Studio';
import { Icon } from '../components/Icon';
import { Modal, type ConfirmState } from '../components/ui';
import { PixelThumb } from '../components/PixelCanvas';
import { emptyGrid } from '../engine/interpreter';
import { cloneProgram, countBlocks, uid } from '../engine/program';
import type { Grid, Program } from '../engine/types';
import {
  CANVAS_SIZES,
  deleteAnim,
  formatDate,
  loadAnims,
  loadTheaterDraft,
  saveTheaterDraft,
  upsertAnim,
  type AnimFrame,
  type AnimProject,
  type SpeedKey,
} from '../lib/storage';
import { exportGif, exportSpriteSheet } from '../lib/exporters';
import { TEMPLATES, blankProject, projectFromTemplate } from '../data/templates';
import { play } from '../lib/sound';
import type { ModeHandle } from '../App';
import { onRadioKeys, radioProps } from '../components/radio';

interface Props {
  active: boolean;
  handleRef: React.MutableRefObject<ModeHandle | null>;
  speed: SpeedKey;
  setSpeed: (s: SpeedKey) => void;
  ask: (c: ConfirmState) => void;
}

const MAX_FRAMES = 40;
const FPS_OPTIONS: { fps: number; label: string }[] = [
  { fps: 2, label: '느리게' },
  { fps: 4, label: '보통' },
  { fps: 8, label: '빠르게' },
];

export function TheaterMode({ active, handleRef, speed, setSpeed, ask }: Props) {
  const draft = useMemo(() => loadTheaterDraft(), []);
  const [project, setProject] = useState<AnimProject>(() => draft?.project ?? projectFromTemplate(TEMPLATES[0]));
  const [savedId, setSavedId] = useState<string | null>(draft?.savedId ?? null);
  const [dirty, setDirty] = useState(draft?.dirty ?? false);
  const [cur, setCur] = useState(0);
  const [onion, setOnion] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [playIdx, setPlayIdx] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [anims, setAnims] = useState<AnimProject[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const { size, frames } = project;
  const index = Math.min(cur, frames.length - 1);
  const frame = frames[index];
  const rendered = useMemo(() => frames.map((f) => renderArt(f.program, f.base, size)), [frames, size]);

  useEffect(() => {
    const t = window.setTimeout(() => saveTheaterDraft({ project, savedId, dirty }), 300);
    return () => window.clearTimeout(t);
  }, [project, savedId, dirty]);

  // 미리보기 재생
  useEffect(() => {
    if (!playing || !active) return;
    const t = window.setInterval(() => {
      setPlayIdx((i) => {
        const n = i + 1;
        if (n >= frames.length) {
          if (project.loop) return 0;
          setPlaying(false);
          return i;
        }
        return n;
      });
    }, 1000 / project.fps);
    return () => window.clearInterval(t);
  }, [playing, active, project.fps, project.loop, frames.length]);

  const showToast = (t: string) => {
    setToast(t);
    window.setTimeout(() => setToast((x) => (x === t ? null : x)), 2400);
  };

  const update = (fn: (p: AnimProject) => AnimProject) => {
    setProject((p) => fn(p));
    setDirty(true);
  };

  const setFrame = (patch: Partial<AnimFrame>) =>
    update((p) => ({ ...p, frames: p.frames.map((f, i) => (i === index ? { ...f, ...patch } : f)) }));

  const addFrame = (copy: boolean) => {
    if (frames.length >= MAX_FRAMES) return showToast(`장면은 ${MAX_FRAMES}장까지 만들 수 있어요`);
    const nf: AnimFrame = copy
      ? { id: uid(), program: cloneProgram(frame.program), base: [...frame.base] }
      : { id: uid(), program: [], base: emptyGrid(size, size) };
    update((p) => ({ ...p, frames: [...p.frames.slice(0, index + 1), nf, ...p.frames.slice(index + 1)] }));
    setCur(index + 1);
    play('add');
  };

  const deleteFrame = () => {
    if (frames.length <= 1) return showToast('장면이 하나뿐이라 지울 수 없어요');
    ask({
      title: `${index + 1}번 장면을 지울까요?`,
      message: '이 장면의 그림과 블록이 함께 지워져요.',
      confirmText: '지우기',
      danger: true,
      onConfirm: () => {
        update((p) => ({ ...p, frames: p.frames.filter((_, i) => i !== index) }));
        setCur(Math.max(0, index - 1));
      },
    });
  };

  const moveFrame = (d: -1 | 1) => {
    const j = index + d;
    if (j < 0 || j >= frames.length) return;
    update((p) => {
      const fs = [...p.frames];
      [fs[index], fs[j]] = [fs[j], fs[index]];
      return { ...p, frames: fs };
    });
    setCur(j);
    play('click');
  };

  const changeSize = (n: number) => {
    if (n === size) return;
    update((p) => ({ ...p, size: n, frames: p.frames.map((f) => ({ ...f, base: resizeGrid(f.base, p.size, n) })) }));
    showToast(`모든 장면을 ${n}×${n}로 바꿨어요`);
  };

  const save = (): boolean => {
    const id = savedId ?? project.id;
    const name = project.name.trim() || `나의 애니메이션 ${loadAnims().length + 1}`;
    const p: AnimProject = { ...project, id, name, updatedAt: Date.now() };
    if (!upsertAnim(p)) {
      ask({
        title: '저장하지 못했어요',
        message: '브라우저 저장 공간이 부족해요. 오래된 애니메이션을 지우거나 GIF로 내려받아 보관해 주세요.',
        confirmText: '확인',
        onConfirm: () => {},
      });
      return false;
    }
    setProject(p);
    setSavedId(id);
    setDirty(false);
    play('save');
    showToast(`"${name}" 저장 완료!`);
    return true;
  };

  // App 이 모드를 바꾸기 전에 '저장 안 한 변경'을 물어볼 수 있게 알려줘요
  useLayoutEffect(() => {
    handleRef.current = { isDirty: () => dirty, save };
  });

  const replaceProject = (p: AnimProject, saved: string | null) => {
    const go = () => {
      setProject(p);
      setSavedId(saved);
      setDirty(false);
      setCur(0);
      setPlayIdx(0);
      setPlaying(false);
      setGalleryOpen(false);
      setTplOpen(false);
      play('click');
    };
    if (dirty)
      ask({
        title: '지금 애니메이션을 바꿀까요?',
        message: '저장하지 않은 지금 애니메이션은 사라져요.',
        confirmText: '바꾸기',
        danger: true,
        onConfirm: go,
        extra: { text: '저장하고 바꾸기', onClick: () => save() && go() },
      });
    else go();
  };

  const removeAnim = (a: AnimProject) =>
    ask({
      title: '애니메이션을 지울까요?',
      message: (
        <>
          <b>"{a.name}"</b>을(를) 보관함에서 지워요. 지운 뒤에는 되돌릴 수 없어요.
        </>
      ),
      confirmText: '지우기',
      danger: true,
      onConfirm: () => {
        deleteAnim(a.id);
        setAnims(loadAnims());
        if (a.id === savedId) {
          setSavedId(null);
          setDirty(true);
        }
      },
    });

  const doGif = () => {
    try {
      exportGif(rendered, size, size, project.fps, project.loop, project.name || '나의 애니메이션');
      showToast('움직이는 GIF 파일을 내려받았어요');
    } catch {
      showToast('GIF 만들기에 실패했어요');
    }
  };
  const doSheet = async () => {
    try {
      await exportSpriteSheet(rendered, size, size, project.name || '나의 애니메이션');
      showToast('장면 모음 PNG를 내려받았어요');
    } catch {
      showToast('내려받기에 실패했어요');
    }
  };

  const shownPlay = Math.min(playIdx, frames.length - 1);

  return (
    <div className="mode theater-mode">
      <Studio
        active={active}
        size={size}
        program={frame.program}
        base={frame.base}
        onProgram={(p: Program) => setFrame({ program: p })}
        onBase={(g: Grid) => setFrame({ base: g })}
        onStrokeStart={() => {}}
        speed={speed}
        setSpeed={setSpeed}
        ghost={onion && index > 0 ? rendered[index - 1] : null}
        resetKey={frame.id}
        workspaceTitle={`${index + 1}번 장면의 주문`}
        canvasLabel={`${index + 1}번 장면 도화지`}
        compactControls
        stageHead={
          <>
            <span className="stage-badge">
              <Icon name="film" size={20} /> {index + 1}번 장면 <small>/ {frames.length}</small>
            </span>
            <label className="mini-toggle" title="바로 앞 장면을 흐리게 보여줘요">
              <input type="checkbox" checked={onion} onChange={(e) => setOnion(e.target.checked)} />
              <Icon name="onion" size={18} /> 앞 장면 비춰보기
            </label>
            <div className="seg size-seg" role="radiogroup" tabIndex={-1} onKeyDown={onRadioKeys} aria-label="도화지 크기">
              {CANVAS_SIZES.map((n) => (
                <button type="button" {...radioProps(size === n)} key={n} className={size === n ? 'on' : ''} onClick={() => changeSize(n)}>
                  {n}×{n}
                </button>
              ))}
            </div>
          </>
        }
      />

      <aside className="card col-side theater-side">
        <div className="side-sec player">
          <h3>
            <Icon name="play" size={16} /> 극장 미리보기
          </h3>
          <div className="player-screen">
            <div className="curtain l" />
            <div className="curtain r" />
            <PixelThumb grid={rendered[playing ? shownPlay : index]} width={size} height={size} />
            <span className="player-frame">
              {(playing ? shownPlay : index) + 1} / {frames.length}
            </span>
          </div>
          <div className="player-ctl">
            <button
              type="button"
              className={'btn ' + (playing ? '' : 'btn-accent')}
              onClick={() => {
                if (!playing) setPlayIdx(0);
                setPlaying(!playing);
              }}
            >
              <Icon name={playing ? 'stop' : 'play'} size={18} /> {playing ? '멈추기' : '재생하기'}
            </button>
            <label className="mini-toggle">
              <input type="checkbox" checked={project.loop} onChange={(e) => update((p) => ({ ...p, loop: e.target.checked }))} />
              <Icon name="loop" size={16} /> 반복 재생
            </label>
          </div>
          <div className="seg fps-seg" role="radiogroup" tabIndex={-1} onKeyDown={onRadioKeys} aria-label="재생 속도">
            {FPS_OPTIONS.map((o) => (
              <button
                type="button"
                {...radioProps(project.fps === o.fps)}
                key={o.fps}
                className={project.fps === o.fps ? 'on' : ''}
                onClick={() => update((p) => ({ ...p, fps: o.fps }))}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="side-sec">
          <label className="name-field full">
            <span>애니메이션 이름</span>
            <input
              aria-label="애니메이션 이름"
              value={project.name}
              maxLength={30}
              placeholder="예: 춤추는 고양이"
              onChange={(e) => update((p) => ({ ...p, name: e.target.value }))}
            />
          </label>
          <div className="btn-grid">
            <button type="button" className="btn btn-save" onClick={save}>
              <Icon name="save" size={18} /> 저장
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setAnims(loadAnims());
                setGalleryOpen(true);
              }}
            >
              <Icon name="folder" size={18} /> 보관함
            </button>
            <button type="button" className="btn" onClick={() => setTplOpen(true)}>
              <Icon name="new" size={18} /> 새로 만들기
            </button>
            <button type="button" className="btn" onClick={doGif} title="움직이는 GIF 그림 파일로 내려받기">
              <Icon name="download" size={18} /> GIF
            </button>
            <button type="button" className="btn span2" onClick={doSheet} title="모든 장면을 한 장에 이어 붙인 PNG">
              <Icon name="film" size={18} /> 장면 모음 PNG
            </button>
          </div>
          <p className={'save-state' + (dirty ? ' dirty' : '')}>
            {dirty ? '저장하지 않은 변경이 있어요' : savedId ? '보관함에 저장됨' : ''}
          </p>
        </div>
        {toast && <div className="side-toast">{toast}</div>}
      </aside>

      <section className="card frame-strip" aria-label="장면 목록">
        <div className="fs-tools">
          <span className="fs-title">
            <Icon name="film" size={18} /> {index + 1}번 장면
          </span>
          <div className="fs-btns">
            <button
              type="button"
              className="btn-mini"
              onClick={() => moveFrame(-1)}
              disabled={index === 0}
              title="이 장면을 앞으로 옮기기"
              aria-label="이 장면을 앞으로 옮기기"
            >
              <Icon name="chevLeft" size={18} />
            </button>
            <button
              type="button"
              className="btn-mini"
              onClick={() => moveFrame(1)}
              disabled={index === frames.length - 1}
              title="이 장면을 뒤로 옮기기"
              aria-label="이 장면을 뒤로 옮기기"
            >
              <Icon name="chevRight" size={18} />
            </button>
            <button
              type="button"
              className="btn-mini danger"
              onClick={deleteFrame}
              disabled={frames.length <= 1}
              title="이 장면 지우기"
              aria-label="이 장면 지우기"
            >
              <Icon name="trash" size={17} />
            </button>
          </div>
          <span className="fs-hint">순서 옮기기 · 지우기</span>
        </div>
        <div className="fs-list">
          {frames.map((f, i) => (
            <button
              type="button"
              key={f.id}
              className={'fs-item' + (i === index ? ' on' : '') + (playing && i === shownPlay ? ' playing' : '')}
              onClick={() => setCur(i)}
              aria-current={i === index ? 'true' : undefined}
            >
              <PixelThumb grid={rendered[i]} width={size} height={size} />
              {/* 보이는 숫자와 읽어 주는 이름이 같도록 "1번 장면" 을 글자로 넣어요 */}
              <span className="fs-num">
                {i + 1}
                <span className="sr-only">번 장면</span>
              </span>
              {countBlocks(f.program) > 0 && (
                <span className="fs-code" title="이 장면에는 코드 블록이 있어요">
                  <Icon name="code" size={11} />
                </span>
              )}
            </button>
          ))}
          <button type="button" className="fs-add" onClick={() => addFrame(true)} title="지금 장면을 복사해서 바로 뒤에 추가">
            <Icon name="copy" size={20} />
            복사해서 추가
          </button>
          <button type="button" className="fs-add" onClick={() => addFrame(false)} title="빈 장면 추가">
            <Icon name="plus" size={20} />빈 장면
          </button>
        </div>
      </section>

      <Modal
        open={tplOpen}
        onClose={() => setTplOpen(false)}
        title="새 애니메이션 만들기"
        className="templates"
        icon={<Icon name="new" size={24} />}
      >
        <p className="note">예시 템플릿으로 시작해서 고쳐 보거나, 빈 도화지로 시작하세요.</p>
        <div className="tpl-grid">
          <button type="button" className="tpl-card blank" onClick={() => replaceProject(blankProject(size), null)}>
            <span className="tpl-thumb">
              <Icon name="plus" size={36} />
            </span>
            <b>빈 애니메이션</b>
            <small>장면 1장부터 시작</small>
          </button>
          {TEMPLATES.map((t) => (
            <TemplateCard key={t.key} tkey={t.key} onPick={() => replaceProject(projectFromTemplate(t), null)} />
          ))}
        </div>
      </Modal>

      <Modal
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        title="애니메이션 보관함"
        className="gallery"
        icon={<Icon name="folder" size={24} />}
      >
        {anims.length === 0 ? (
          <div className="empty-gallery">
            <Icon name="sparkle" size={36} />
            <p>아직 저장한 애니메이션이 없어요. [저장]을 누르면 여기에 모여요!</p>
          </div>
        ) : (
          <div className="gallery-grid">
            {anims.map((a) => (
              <div className={'g-card' + (a.id === savedId ? ' current' : '')} key={a.id}>
                <button type="button" className="g-thumb" onClick={() => replaceProject(a, a.id)} title="열기">
                  <AnimThumb project={a} />
                </button>
                <div className="g-name">{a.name}</div>
                <div className="g-meta">
                  장면 {a.frames.length}장 · {a.size}×{a.size} · {formatDate(a.updatedAt)}
                </div>
                <div className="g-actions">
                  <button type="button" className="btn-mini" onClick={() => replaceProject(a, a.id)}>
                    <Icon name="folder" size={15} /> 열기
                  </button>
                  <button
                    type="button"
                    className="btn-mini"
                    onClick={() => {
                      const g = a.frames.map((f) => renderArt(f.program, f.base, a.size));
                      exportGif(g, a.size, a.size, a.fps, a.loop, a.name);
                    }}
                  >
                    <Icon name="download" size={15} /> GIF
                  </button>
                  <button type="button" className="btn-mini danger" onClick={() => removeAnim(a)} aria-label={`${a.name} 지우기`}>
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

/** 움직이는 썸네일 */
function AnimThumb({ project }: { project: AnimProject }) {
  const [i, setI] = useState(0);
  const grids = useMemo(() => project.frames.map((f) => renderArt(f.program, f.base, project.size)), [project]);
  useEffect(() => {
    const t = window.setInterval(() => setI((x) => (x + 1) % grids.length), 1000 / project.fps);
    return () => window.clearInterval(t);
  }, [grids.length, project.fps]);
  return <PixelThumb grid={grids[i % grids.length]} width={project.size} height={project.size} />;
}

function TemplateCard({ tkey, onPick }: { tkey: string; onPick: () => void }) {
  const t = TEMPLATES.find((x) => x.key === tkey)!;
  const proj = useMemo(() => projectFromTemplate(t), [t]);
  return (
    <button type="button" className="tpl-card" onClick={onPick}>
      <span className="tpl-thumb">
        <AnimThumb project={proj} />
      </span>
      <b>{t.name}</b>
      <small>
        {t.desc} · {t.frames.length}장
      </small>
    </button>
  );
}
