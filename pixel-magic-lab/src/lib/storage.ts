import type { Grid, Program } from '../engine/types';
import { sanitizeProgram, uid } from '../engine/program';
import { isColorKey } from '../engine/palette';

// ─────────────────────────────────────────────
// 브라우저 로컬 저장소 (서버 없이 작품 보관)
// 모든 읽기/쓰기는 실패해도 앱이 멈추지 않도록 감쌉니다.
// ─────────────────────────────────────────────

const KEYS = {
  progress: 'pml.progress.v1',
  works: 'pml.works.v1',
  anims: 'pml.anims.v1',
  settings: 'pml.settings.v1',
  draftWorkshop: 'pml.draft.workshop.v1',
  draftTheater: 'pml.draft.theater.v1',
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function sanitizeGrid(raw: unknown, size: number): Grid {
  const out: Grid = new Array(size).fill(null);
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i < size; i++) {
    const c = raw[i];
    out[i] = typeof c === 'string' && isColorKey(c) ? c : null;
  }
  return out;
}

export const CANVAS_SIZES = [8, 10, 16] as const;
function sanitizeSize(n: unknown): number {
  return typeof n === 'number' && (CANVAS_SIZES as readonly number[]).includes(n) ? n : 8;
}

// ── 설정 ──
export interface Settings {
  muted: boolean;
  speed: SpeedKey;
}
export type SpeedKey = 'slow' | 'normal' | 'fast' | 'instant';
export function loadSettings(): Settings {
  const s = read<Partial<Settings>>(KEYS.settings, {});
  const speed: SpeedKey = s.speed === 'slow' || s.speed === 'fast' || s.speed === 'instant' ? s.speed : 'normal';
  return { muted: !!s.muted, speed };
}
export function saveSettings(s: Settings) {
  write(KEYS.settings, s);
}

// ── 미션 진행 ──
export interface MissionRecord {
  stars: number;
  bestBlocks: number;
  code: Program; // 성공한 코드
  completedAt: number;
}
export interface Progress {
  missions: Record<number, MissionRecord>;
  drafts: Record<number, Program>; // 작업 중인 코드
  seenConcepts: number[];
  unlockAll: boolean;
  lastMission: number;
}
export function loadProgress(): Progress {
  const p = read<Partial<Progress>>(KEYS.progress, {});
  const missions: Record<number, MissionRecord> = {};
  if (p.missions && typeof p.missions === 'object') {
    for (const [k, v] of Object.entries(p.missions)) {
      if (!v || typeof v !== 'object') continue;
      const r = v as Partial<MissionRecord>;
      missions[Number(k)] = {
        stars: Math.max(1, Math.min(3, Number(r.stars) || 1)),
        bestBlocks: Number(r.bestBlocks) || 0,
        code: sanitizeProgram(r.code),
        completedAt: Number(r.completedAt) || Date.now(),
      };
    }
  }
  const drafts: Record<number, Program> = {};
  if (p.drafts && typeof p.drafts === 'object') for (const [k, v] of Object.entries(p.drafts)) drafts[Number(k)] = sanitizeProgram(v);
  return {
    missions,
    drafts,
    seenConcepts: Array.isArray(p.seenConcepts) ? p.seenConcepts.filter((n) => typeof n === 'number') : [],
    unlockAll: !!p.unlockAll,
    lastMission: typeof p.lastMission === 'number' ? p.lastMission : 1,
  };
}
export function saveProgress(p: Progress) {
  write(KEYS.progress, p);
}
export function resetProgress() {
  try {
    globalThis.localStorage?.removeItem(KEYS.progress);
  } catch {
    /* 무시 */
  }
}

// ── 자유 공방 작품 ──
export interface Artwork {
  id: string;
  name: string;
  size: number;
  program: Program;
  base: Grid; // 손으로 칠한 밑그림
  pixels: Grid; // 완성 그림 (밑그림 + 코드 실행 결과)
  updatedAt: number;
}
function sanitizeArtwork(raw: unknown): Artwork | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const size = sanitizeSize(o.size);
  return {
    id: typeof o.id === 'string' ? o.id : uid(),
    name: typeof o.name === 'string' ? o.name.slice(0, 30) : '이름 없는 작품',
    size,
    program: sanitizeProgram(o.program),
    base: sanitizeGrid(o.base, size * size),
    pixels: sanitizeGrid(o.pixels, size * size),
    updatedAt: Number(o.updatedAt) || Date.now(),
  };
}
export function loadWorks(): Artwork[] {
  const arr = read<unknown[]>(KEYS.works, []);
  return (Array.isArray(arr) ? arr : []).map(sanitizeArtwork).filter((a): a is Artwork => !!a).sort((a, b) => b.updatedAt - a.updatedAt);
}
export function upsertWork(w: Artwork): boolean {
  const list = loadWorks().filter((x) => x.id !== w.id);
  list.unshift(w);
  return write(KEYS.works, list);
}
export function deleteWork(id: string): boolean {
  return write(KEYS.works, loadWorks().filter((x) => x.id !== id));
}

// ── 애니메이션 ──
export interface AnimFrame {
  id: string;
  program: Program;
  base: Grid;
}
export interface AnimProject {
  id: string;
  name: string;
  size: number;
  fps: number;
  loop: boolean;
  frames: AnimFrame[];
  updatedAt: number;
}
export function sanitizeAnim(raw: unknown): AnimProject | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const size = sanitizeSize(o.size);
  const frames = (Array.isArray(o.frames) ? o.frames : [])
    .slice(0, 40)
    .map((f) => {
      const fo = (f && typeof f === 'object' ? f : {}) as Record<string, unknown>;
      return { id: typeof fo.id === 'string' ? fo.id : uid(), program: sanitizeProgram(fo.program), base: sanitizeGrid(fo.base, size * size) };
    });
  if (frames.length === 0) frames.push({ id: uid(), program: [], base: sanitizeGrid(null, size * size) });
  const fps = Number(o.fps);
  return {
    id: typeof o.id === 'string' ? o.id : uid(),
    name: typeof o.name === 'string' ? o.name.slice(0, 30) : '이름 없는 애니메이션',
    size,
    fps: [2, 4, 8].includes(fps) ? fps : 4,
    loop: o.loop !== false,
    frames,
    updatedAt: Number(o.updatedAt) || Date.now(),
  };
}
export function loadAnims(): AnimProject[] {
  const arr = read<unknown[]>(KEYS.anims, []);
  return (Array.isArray(arr) ? arr : []).map(sanitizeAnim).filter((a): a is AnimProject => !!a).sort((a, b) => b.updatedAt - a.updatedAt);
}
export function upsertAnim(a: AnimProject): boolean {
  const list = loadAnims().filter((x) => x.id !== a.id);
  list.unshift(a);
  return write(KEYS.anims, list);
}
export function deleteAnim(id: string): boolean {
  return write(KEYS.anims, loadAnims().filter((x) => x.id !== id));
}

// ── 작업 중 임시 저장 (새로고침해도 이어서 하기) ──
export interface WorkshopDraft {
  savedId: string | null;
  name: string;
  size: number;
  program: Program;
  base: Grid;
  dirty: boolean;
}
export function loadWorkshopDraft(): WorkshopDraft | null {
  const o = read<Record<string, unknown> | null>(KEYS.draftWorkshop, null);
  if (!o || typeof o !== 'object') return null;
  const size = sanitizeSize(o.size);
  return {
    savedId: typeof o.savedId === 'string' ? o.savedId : null,
    name: typeof o.name === 'string' ? o.name.slice(0, 30) : '',
    size,
    program: sanitizeProgram(o.program),
    base: sanitizeGrid(o.base, size * size),
    dirty: !!o.dirty,
  };
}
export function saveWorkshopDraft(d: WorkshopDraft) {
  write(KEYS.draftWorkshop, d);
}
export interface TheaterDraft {
  project: AnimProject;
  savedId: string | null;
  dirty: boolean;
}
export function loadTheaterDraft(): TheaterDraft | null {
  const o = read<Record<string, unknown> | null>(KEYS.draftTheater, null);
  if (!o || typeof o !== 'object') return null;
  const project = sanitizeAnim(o.project);
  if (!project) return null;
  return { project, savedId: typeof o.savedId === 'string' ? o.savedId : null, dirty: !!o.dirty };
}
export function saveTheaterDraft(d: TheaterDraft) {
  write(KEYS.draftTheater, d);
}

export function formatDate(t: number): string {
  try {
    const d = new Date(t);
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return '';
  }
}
