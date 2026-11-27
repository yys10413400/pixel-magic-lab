import type { Grid, Program } from '../engine/types';
import { sanitizeProgram, uid } from '../engine/program';
import { isColorKey } from '../engine/palette';
import { migrateProgram, schemaOf, SCHEMA } from './migrations';

// ─────────────────────────────────────────────
// 브라우저 로컬 저장소 (서버 없이 작품 보관)
// 모든 읽기/쓰기는 실패해도 앱이 멈추지 않도록 감쌉니다.
// 공방 작품·애니메이션·임시 저장에는 schema 번호를 붙이고, 예전 데이터는 읽을 때 바꿔서 다시 저장해요 (migrations.ts).
// ─────────────────────────────────────────────

const KEYS = {
  // 미션이 24개로 새로 바뀌면서 v2 (예전 v1 기록은 새 미션과 맞지 않아요)
  progress: 'pml.progress.v2',
  oldProgress: 'pml.progress.v1',
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
  const out: Grid = Array.from({ length: size }, (): string | null => null);
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
  /** 공방·극장에서 고급 블록(만약, 나만의 블록) 보이기 — 선생님 도구에서 켜요 */
  advanced: boolean;
}
export type SpeedKey = 'slow' | 'normal' | 'fast' | 'instant';
export function loadSettings(): Settings {
  const s = read<Partial<Settings>>(KEYS.settings, {});
  const speed: SpeedKey = s.speed === 'slow' || s.speed === 'fast' || s.speed === 'instant' ? s.speed : 'normal';
  return { muted: !!s.muted, speed, advanced: !!s.advanced };
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
/**
 * 예전 미션(12개) 기록이 남아 있으면 지우고 true 를 돌려줘요. (한 번만 안내하려고)
 * 공방 작품과 애니메이션은 건드리지 않아요.
 */
export function takeOldProgressNotice(): boolean {
  try {
    const ls = globalThis.localStorage;
    if (!ls?.getItem(KEYS.oldProgress)) return false;
    ls.removeItem(KEYS.oldProgress);
    return true;
  } catch {
    return false;
  }
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
/** 저장 칸에 쓸 모양 (schema 번호 붙이기) */
function stamp<T extends object>(x: T): T & { schema: number } {
  return { ...x, schema: SCHEMA };
}

export function sanitizeArtwork(raw: unknown): { work: Artwork; migrated: boolean } | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const size = sanitizeSize(o.size);
  const base = sanitizeGrid(o.base, size * size);
  const pixels = sanitizeGrid(o.pixels, size * size);
  let program = sanitizeProgram(o.program);
  let migrated = false;
  if (schemaOf(o) < 2) {
    const m = migrateProgram(program, base, size, pixels);
    program = m.program;
    migrated = true;
  }
  return {
    work: {
      id: typeof o.id === 'string' ? o.id : uid(),
      name: typeof o.name === 'string' ? o.name.slice(0, 30) : '이름 없는 작품',
      size,
      program,
      base,
      pixels,
      updatedAt: Number(o.updatedAt) || Date.now(),
    },
    migrated,
  };
}
export function loadWorks(): Artwork[] {
  const arr = read<unknown[]>(KEYS.works, []);
  const items = (Array.isArray(arr) ? arr : []).map(sanitizeArtwork).filter((a) => a !== null);
  const works = items.map((a) => a.work).sort((a, b) => b.updatedAt - a.updatedAt);
  if (items.some((a) => a.migrated)) write(KEYS.works, works.map(stamp));
  return works;
}
export function upsertWork(w: Artwork): boolean {
  const list = loadWorks().filter((x) => x.id !== w.id);
  list.unshift(w);
  return write(KEYS.works, list.map(stamp));
}
export function deleteWork(id: string): boolean {
  return write(
    KEYS.works,
    loadWorks()
      .filter((x) => x.id !== id)
      .map(stamp),
  );
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
export const MAX_FRAMES = 40;

export function sanitizeAnim(raw: unknown): AnimProject | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const size = sanitizeSize(o.size);
  const old = schemaOf(o) < 2;
  const frames = (Array.isArray(o.frames) ? o.frames : []).slice(0, MAX_FRAMES).map((f) => {
    const fo = (f && typeof f === 'object' ? f : {}) as Record<string, unknown>;
    const base = sanitizeGrid(fo.base, size * size);
    const program = sanitizeProgram(fo.program);
    return {
      id: typeof fo.id === 'string' ? fo.id : uid(),
      program: old ? migrateProgram(program, base, size).program : program,
      base,
    };
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
  const raw = Array.isArray(arr) ? arr : [];
  const anims = raw
    .map(sanitizeAnim)
    .filter((a): a is AnimProject => !!a)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  if (raw.some((r) => r && typeof r === 'object' && schemaOf(r as Record<string, unknown>) < 2)) write(KEYS.anims, anims.map(stamp));
  return anims;
}
export function upsertAnim(a: AnimProject): boolean {
  const list = loadAnims().filter((x) => x.id !== a.id);
  list.unshift(a);
  return write(KEYS.anims, list.map(stamp));
}
export function deleteAnim(id: string): boolean {
  return write(
    KEYS.anims,
    loadAnims()
      .filter((x) => x.id !== id)
      .map(stamp),
  );
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
  const base = sanitizeGrid(o.base, size * size);
  const program = sanitizeProgram(o.program);
  return {
    savedId: typeof o.savedId === 'string' ? o.savedId : null,
    name: typeof o.name === 'string' ? o.name.slice(0, 30) : '',
    size,
    program: schemaOf(o) < 2 ? migrateProgram(program, base, size).program : program,
    base,
    dirty: !!o.dirty,
  };
}
export function saveWorkshopDraft(d: WorkshopDraft) {
  write(KEYS.draftWorkshop, stamp(d));
}
export interface TheaterDraft {
  project: AnimProject;
  savedId: string | null;
  dirty: boolean;
}
export function loadTheaterDraft(): TheaterDraft | null {
  const o = read<Record<string, unknown> | null>(KEYS.draftTheater, null);
  if (!o || typeof o !== 'object') return null;
  // 예전 임시 저장은 안쪽 project 에 schema 가 없어요. 바깥 표시를 안쪽에도 알려줘요.
  const inner = o.project && typeof o.project === 'object' ? { ...(o.project as Record<string, unknown>), schema: schemaOf(o) } : o.project;
  const project = sanitizeAnim(inner);
  if (!project) return null;
  return { project, savedId: typeof o.savedId === 'string' ? o.savedId : null, dirty: !!o.dirty };
}
export function saveTheaterDraft(d: TheaterDraft) {
  write(KEYS.draftTheater, stamp(d));
}

export function formatDate(t: number): string {
  try {
    const d = new Date(t);
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return '';
  }
}
