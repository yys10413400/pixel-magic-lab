import { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { Studio, renderArt, resizeGrid } from '../components/Studio';
import { Icon } from '../components/Icon';
import { Modal, type ConfirmState } from '../components/ui';
import { PixelThumb } from '../components/PixelCanvas';
import { emptyGrid } from '../engine/interpreter';
import { countBlocks, uid, cloneProgram } from '../engine/program';
import type { Grid, Program } from '../engine/types';
import {
  CANVAS_SIZES,
  deleteWork,
  formatDate,
  loadWorkshopDraft,
  loadWorks,
  saveWorkshopDraft,
  upsertWork,
  type Artwork,
  type SpeedKey,
} from '../lib/storage';
import { exportPng } from '../lib/exporters';
import { play } from '../lib/sound';
import type { ModeHandle } from '../App';

interface Props {
  active: boolean;
  handleRef: React.MutableRefObject<ModeHandle | null>;
  speed: SpeedKey;
  setSpeed: (s: SpeedKey) => void;
  ask: (c: ConfirmState) => void;
}

interface Snap {
  size: number;
  program: Program;
  base: Grid;
}

export function WorkshopMode({ active, handleRef, speed, setSpeed, ask }: Props) {
  const draft = useMemo(() => loadWorkshopDraft(), []);
  const [savedId, setSavedId] = useState<string | null>(draft?.savedId ?? null);
  const [name, setName] = useState(draft?.name ?? '');
  const [size, setSize] = useState(draft?.size ?? 8);
  const [program, setProgram] = useState<Program>(draft?.program ?? []);
  const [base, setBase] = useState<Grid>(draft?.base ?? emptyGrid(8, 8));
  const [dirty, setDirty] = useState(draft?.dirty ?? false);
  const [past, setPast] = useState<Snap[]>([]);
  const [future, setFuture] = useState<Snap[]>([]);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [works, setWorks] = useState<Artwork[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState('w0');
  const snapRef = useRef<Snap>({ size, program, base });
  useLayoutEffect(() => {
    snapRef.current = { size, program, base };
  });

  // 새로고침해도 이어서 만들 수 있게 임시 저장
  useEffect(() => {
    const t = window.setTimeout(() => saveWorkshopDraft({ savedId, name, size, program, base, dirty }), 250);
    return () => window.clearTimeout(t);
  }, [savedId, name, size, program, base, dirty]);

  const showToast = (t: string) => {
    setToast(t);
    window.setTimeout(() => setToast((x) => (x === t ? null : x)), 2400);
  };

  const pushHistory = () => {
    setPast((p) => [...p.slice(-59), snapRef.current]);
    setFuture([]);
  };

  const apply = (s: Snap) => {
    setSize(s.size);
    setProgram(s.program);
    setBase(s.base);
  };

  const undo = () => {
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    setPast(past.slice(0, -1));
    setFuture((f) => [snapRef.current, ...f]);
    apply(prev);
    setDirty(true);
    setResetKey(uid());
    play('click');
  };
  const redo = () => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture(future.slice(1));
    setPast((p) => [...p, snapRef.current]);
    apply(next);
    setDirty(true);
    setResetKey(uid());
    play('click');
  };

  const onProgram = (p: Program) => {
    pushHistory();
    setProgram(p);
    setDirty(true);
  };

  const onBase = (g: Grid) => {
    setBase(g);
    setDirty(true);
  };

  const changeSize = (n: number) => {
    if (n === size) return;
    pushHistory();
    setBase(resizeGrid(base, size, n));
    setSize(n);
    setDirty(true);
    showToast(`도화지를 ${n}×${n}로 바꿨어요`);
  };

  const save = (): boolean => {
    const id = savedId ?? uid();
    const finalName = name.trim() || `나의 작품 ${loadWorks().length + 1}`;
    const art: Artwork = {
      id,
      name: finalName,
      size,
      program: cloneProgram(program),
      base: [...base],
      pixels: renderArt(program, base, size),
      updatedAt: Date.now(),
    };
    if (!upsertWork(art)) {
      ask({
        title: '저장하지 못했어요',
        message: '브라우저 저장 공간이 가득 찼거나 저장이 막혀 있어요. 오래된 작품을 지우거나 PNG로 내려받아 보관해 주세요.',
        confirmText: '확인',
        onConfirm: () => {},
      });
      return false;
    }
    setSavedId(id);
    setName(finalName);
    setDirty(false);
    play('save');
    showToast(`"${finalName}" 저장 완료!`);
    return true;
  };

  // App 이 모드를 바꾸기 전에 '저장 안 한 변경'을 물어볼 수 있게 알려줘요
  useLayoutEffect(() => {
    handleRef.current = { isDirty: () => dirty, save };
  });

  const startNew = () => {
    const go = () => {
      setSavedId(null);
      setName('');
      setProgram([]);
      setBase(emptyGrid(size, size));
      setPast([]);
      setFuture([]);
      setDirty(false);
      setResetKey(uid());
    };
    if (dirty)
      ask({
        title: '새 작품을 만들까요?',
        message: '저장하지 않은 지금 작품은 사라져요.',
        confirmText: '새로 만들기',
        danger: true,
        onConfirm: go,
        extra: { text: '저장하고 새로 만들기', onClick: () => save() && go() },
      });
    else go();
  };

  const openWork = (w: Artwork) => {
    const go = () => {
      setSavedId(w.id);
      setName(w.name);
      setSize(w.size);
      setProgram(cloneProgram(w.program));
      setBase([...w.base]);
      setPast([]);
      setFuture([]);
      setDirty(false);
      setResetKey(uid());
      setGalleryOpen(false);
      play('click');
    };
    if (dirty)
      ask({
        title: '작품을 불러올까요?',
        message: '저장하지 않은 지금 작품은 사라져요.',
        confirmText: '불러오기',
        danger: true,
        onConfirm: go,
      });
    else go();
  };

  const removeWork = (w: Artwork) =>
    ask({
      title: '작품을 지울까요?',
      message: (
        <>
          <b>"{w.name}"</b> 작품을 작품 보관함에서 지워요. 지운 작품은 되돌릴 수 없어요.
        </>
      ),
      confirmText: '지우기',
      danger: true,
      onConfirm: () => {
        deleteWork(w.id);
        setWorks(loadWorks());
        if (w.id === savedId) {
          setSavedId(null);
          setDirty(true);
        }
      },
    });

  const download = async (g: Grid, s: number, n: string) => {
    try {
      await exportPng(g, s, s, n || '나의 픽셀 작품');
      showToast('PNG 그림 파일을 내려받았어요');
    } catch {
      showToast('내려받기에 실패했어요');
    }
  };

  const openGallery = () => {
    setWorks(loadWorks());
    setGalleryOpen(true);
  };

  const art = useMemo(() => renderArt(program, base, size), [program, base, size]);
  const filled = art.filter(Boolean).length;
  const handCount = base.filter(Boolean).length;

  // 단축키: Ctrl+Z / Ctrl+Y
  useEffect(() => {
    if (!active) return;
    const key = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  return (
    <div className="mode workshop-mode">
      <Studio
        active={active}
        size={size}
        program={program}
        base={base}
        onProgram={onProgram}
        onBase={onBase}
        onStrokeStart={pushHistory}
        speed={speed}
        setSpeed={setSpeed}
        resetKey={resetKey}
        workspaceTitle="작품 주문"
        canvasLabel="자유 공방 도화지"
        stageHead={
          <>
            <span className="stage-badge">
              <Icon name="brush" size={20} /> 자유 공방
            </span>
            <label className="name-field">
              <span>작품 이름</span>
              <input
                aria-label="작품 이름"
                value={name}
                maxLength={30}
                placeholder="예: 웃는 고양이"
                onChange={(e) => (setName(e.target.value), setDirty(true))}
              />
            </label>
            <div className="seg size-seg" role="radiogroup" aria-label="도화지 크기">
              {CANVAS_SIZES.map((n) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={size === n}
                  key={n}
                  className={size === n ? 'on' : ''}
                  onClick={() => changeSize(n)}
                >
                  {n}×{n}
                </button>
              ))}
            </div>
          </>
        }
      />
      <aside className="card col-side workshop-side">
        <div className="side-sec">
          <h3>
            <Icon name="save" size={18} /> 작품 관리
          </h3>
          <div className="btn-stack">
            <button type="button" className="btn btn-save" onClick={save}>
              <Icon name="save" size={20} /> 저장하기
            </button>
            <button type="button" className="btn" onClick={openGallery}>
              <Icon name="folder" size={20} /> 작품 보관함
            </button>
            <button type="button" className="btn" onClick={() => download(art, size, name)}>
              <Icon name="download" size={20} /> PNG 내려받기
            </button>
            <button type="button" className="btn" onClick={startNew}>
              <Icon name="new" size={20} /> 새 작품
            </button>
          </div>
          <div className="undo-row">
            <button type="button" className="btn" disabled={past.length === 0} onClick={undo} title="실행 취소 (Ctrl+Z)">
              <Icon name="undo" size={18} /> 되돌리기
            </button>
            <button type="button" className="btn" disabled={future.length === 0} onClick={redo} title="다시 실행 (Ctrl+Y)">
              <Icon name="redo" size={18} /> 다시하기
            </button>
          </div>
          <p className={'save-state' + (dirty ? ' dirty' : '')}>
            {dirty ? '저장하지 않은 변경이 있어요' : savedId ? '작품 보관함에 저장됨' : '아직 비어 있는 새 작품'}
          </p>
        </div>
        <div className="side-sec art-info">
          <h3>
            <Icon name="eye" size={18} /> 완성 그림
          </h3>
          <div className="art-preview">
            <PixelThumb grid={art} width={size} height={size} />
          </div>
          <ul className="facts">
            <li>
              코드 블록 <b>{countBlocks(program)}</b>개
            </li>
            <li>
              칠해진 칸 <b>{filled}</b> / {size * size}
            </li>
            <li>
              손 그림 칸 <b>{handCount}</b>개
            </li>
          </ul>
        </div>
        <div className="side-sec tip">
          <Icon name="bulb" size={18} />
          <p>
            <b>코드 마법사 도전!</b> 손으로 칠한 칸 없이 블록만으로 그림을 완성해 보세요. [반복하기]를 쓰면 16×16 큰 그림도 금방이에요.
          </p>
        </div>
        {toast && <div className="side-toast">{toast}</div>}
      </aside>

      <Modal
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        title="작품 보관함"
        className="gallery"
        icon={<Icon name="folder" size={24} />}
      >
        {works.length === 0 ? (
          <div className="empty-gallery">
            <Icon name="sparkle" size={36} />
            <p>아직 저장한 작품이 없어요. [저장하기]를 누르면 여기에 모여요!</p>
          </div>
        ) : (
          <div className="gallery-grid">
            {works.map((w) => (
              <div className={'g-card' + (w.id === savedId ? ' current' : '')} key={w.id}>
                <button type="button" className="g-thumb" onClick={() => openWork(w)} title="열어서 고치기">
                  <PixelThumb grid={w.pixels} width={w.size} height={w.size} />
                </button>
                <div className="g-name">{w.name}</div>
                <div className="g-meta">
                  {w.size}×{w.size} · 블록 {countBlocks(w.program)}개 · {formatDate(w.updatedAt)}
                </div>
                <div className="g-actions">
                  <button type="button" className="btn-mini" onClick={() => openWork(w)}>
                    <Icon name="folder" size={15} /> 열기
                  </button>
                  <button type="button" className="btn-mini" onClick={() => download(w.pixels, w.size, w.name)}>
                    <Icon name="download" size={15} /> PNG
                  </button>
                  <button type="button" className="btn-mini danger" onClick={() => removeWork(w)} aria-label={`${w.name} 지우기`}>
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
