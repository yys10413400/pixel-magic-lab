import type { Block, BlockKind, ColorKey, Program, RepeatBlock } from './types';
import { DEFAULT_PEN_COLOR } from './palette';

// ─────────────────────────────────────────────
// 프로그램(블록 트리)을 다루는 순수 함수 모음
// listId: null = 가장 바깥 목록, 문자열 = 해당 반복 블록의 안쪽 목록
// ─────────────────────────────────────────────

export const MAX_NEST_DEPTH = 3;

let counter = 0;
export function uid(): string {
  counter += 1;
  return `b${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function createBlock(kind: BlockKind, color: ColorKey = DEFAULT_PEN_COLOR): Block {
  const id = uid();
  switch (kind) {
    case 'up':
    case 'down':
    case 'left':
    case 'right':
      return { id, type: 'move', dir: kind };
    case 'paint':
      return { id, type: 'paint' };
    case 'erase':
      return { id, type: 'erase' };
    case 'color':
      return { id, type: 'color', color };
    case 'repeat':
      return { id, type: 'repeat', times: 3, body: [] };
  }
}

export function blockKind(b: Block): BlockKind {
  return b.type === 'move' ? b.dir : b.type;
}

/** 블록 개수 (반복 블록도 1개, 그 안의 블록도 각각 1개) */
export function countBlocks(p: Program): number {
  let n = 0;
  for (const b of p) {
    n += 1;
    if (b.type === 'repeat') n += countBlocks(b.body);
  }
  return n;
}

export function usesRepeat(p: Program): boolean {
  return p.some((b) => b.type === 'repeat');
}

export function maxDepth(p: Program, d = 0): number {
  let m = d;
  for (const b of p) if (b.type === 'repeat') m = Math.max(m, maxDepth(b.body, d + 1));
  return m;
}

export function findBlock(p: Program, id: string): Block | undefined {
  for (const b of p) {
    if (b.id === id) return b;
    if (b.type === 'repeat') {
      const f = findBlock(b.body, id);
      if (f) return f;
    }
  }
  return undefined;
}

/** 블록이 들어 있는 목록과 위치 */
export function locate(p: Program, id: string, listId: string | null = null): { listId: string | null; index: number } | undefined {
  for (let i = 0; i < p.length; i++) {
    const b = p[i];
    if (b.id === id) return { listId, index: i };
    if (b.type === 'repeat') {
      const f = locate(b.body, id, b.id);
      if (f) return f;
    }
  }
  return undefined;
}

/** 해당 목록이 몇 겹의 반복 안에 있는지 (바깥 목록 = 0) */
export function listDepth(p: Program, listId: string | null): number {
  if (listId === null) return 0;
  const walk = (list: Program, d: number): number => {
    for (const b of list) {
      if (b.type === 'repeat') {
        if (b.id === listId) return d + 1;
        const r = walk(b.body, d + 1);
        if (r > 0) return r;
      }
    }
    return 0;
  };
  return walk(p, 0);
}

/** 블록 하나 안에 들어 있는 반복의 깊이 (반복 블록 자신 포함) */
export function blockDepth(b: Block): number {
  return b.type === 'repeat' ? 1 + maxDepth(b.body) : 0;
}

export function containsId(b: Block, id: string): boolean {
  if (b.id === id) return true;
  return b.type === 'repeat' && b.body.some((c) => containsId(c, id));
}

function mapList(p: Program, listId: string | null, fn: (list: Program) => Program): Program {
  if (listId === null) return fn(p);
  return p.map((b) => {
    if (b.type !== 'repeat') return b;
    if (b.id === listId) return { ...b, body: fn(b.body) };
    return { ...b, body: mapList(b.body, listId, fn) };
  });
}

export function listLength(p: Program, listId: string | null): number {
  if (listId === null) return p.length;
  const b = findBlock(p, listId);
  return b && b.type === 'repeat' ? b.body.length : 0;
}

/** 블록을 넣을 수 있는지 (중첩 깊이 제한) */
export function canInsert(p: Program, listId: string | null, block: Block): boolean {
  if (listId !== null) {
    const host = findBlock(p, listId);
    if (!host || host.type !== 'repeat') return false;
  }
  return listDepth(p, listId) + blockDepth(block) <= MAX_NEST_DEPTH;
}

export function insertBlock(p: Program, listId: string | null, index: number, block: Block): Program {
  if (!canInsert(p, listId, block)) return p;
  return mapList(p, listId, (list) => {
    const i = Math.max(0, Math.min(index, list.length));
    return [...list.slice(0, i), block, ...list.slice(i)];
  });
}

export function removeBlock(p: Program, id: string): Program {
  return p.filter((b) => b.id !== id).map((b) => (b.type === 'repeat' ? { ...b, body: removeBlock(b.body, id) } : b));
}

export function updateBlock(p: Program, id: string, patch: Partial<Block>): Program {
  return p.map((b) => {
    if (b.id === id) return { ...b, ...patch } as Block;
    if (b.type === 'repeat') return { ...b, body: updateBlock(b.body, id, patch) };
    return b;
  });
}

/** 블록을 다른 위치로 옮깁니다. index 는 '옮기기 전' 목록 기준 위치입니다. */
export function moveBlock(p: Program, id: string, listId: string | null, index: number): Program {
  const block = findBlock(p, id);
  const from = locate(p, id);
  if (!block || !from) return p;
  if (listId !== null && containsId(block, listId)) return p; // 자기 자신 안으로는 못 들어감
  let target = index;
  if (from.listId === listId && from.index < index) target -= 1;
  const removed = removeBlock(p, id);
  if (!canInsert(removed, listId, block)) return p;
  return insertBlock(removed, listId, target, block);
}

/** 같은 목록 안에서 한 칸 위/아래로 */
/**
 * 블록을 한 칸 위(-1)/아래(+1)로 옮기기.
 * 옆에 반복 블록이 있으면 그 안으로 들어가고, 반복의 맨 끝/맨 앞에서는 밖으로 나와요.
 * 옮길 수 없으면 같은 프로그램을 그대로 돌려줘요.
 */
export function nudgeBlock(p: Program, id: string, delta: -1 | 1): Program {
  const loc = locate(p, id);
  if (!loc) return p;
  const list = loc.listId === null ? p : (findBlock(p, loc.listId) as RepeatBlock).body;
  const block = list[loc.index];
  const without = removeBlock(p, id);
  const neighbor = list[loc.index + delta];
  if (neighbor) {
    if (neighbor.type === 'repeat' && canInsert(without, neighbor.id, block)) {
      return moveBlock(p, id, neighbor.id, delta < 0 ? neighbor.body.length : 0);
    }
    return moveBlock(p, id, loc.listId, delta < 0 ? loc.index - 1 : loc.index + 2);
  }
  if (loc.listId === null) return p;
  const parent = locate(p, loc.listId)!;
  return moveBlock(p, id, parent.listId, delta < 0 ? parent.index : parent.index + 1);
}

/** 블록을 복제 (새 id) */
export function cloneBlock(b: Block): Block {
  if (b.type === 'repeat') return { ...b, id: uid(), body: b.body.map(cloneBlock) };
  return { ...b, id: uid() };
}

export function cloneProgram(p: Program): Program {
  return p.map(cloneBlock);
}

/** 저장된 데이터를 안전하게 프로그램으로 복원 (잘못된 데이터는 걸러냄) */
export function sanitizeProgram(raw: unknown, depth = 0): Program {
  if (!Array.isArray(raw) || depth > MAX_NEST_DEPTH) return [];
  const out: Program = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id : uid();
    switch (o.type) {
      case 'move':
        if (o.dir === 'up' || o.dir === 'down' || o.dir === 'left' || o.dir === 'right') out.push({ id, type: 'move', dir: o.dir });
        break;
      case 'paint':
        out.push({ id, type: 'paint' });
        break;
      case 'erase':
        out.push({ id, type: 'erase' });
        break;
      case 'color':
        if (typeof o.color === 'string') out.push({ id, type: 'color', color: o.color });
        break;
      case 'repeat': {
        const times = typeof o.times === 'number' && Number.isFinite(o.times) ? Math.round(o.times) : 2;
        if (depth + 1 <= MAX_NEST_DEPTH) out.push({ id, type: 'repeat', times, body: sanitizeProgram(o.body, depth + 1) } as RepeatBlock);
        break;
      }
    }
  }
  return out;
}

// ── 짧은 코드로 프로그램을 적는 도우미 (미션 정답, 테스트용) ──
// 예: "R R D D paint", "color:Y repeat:3[ paint right ]"
export function parseProgram(src: string): Program {
  const tokens = src.replace(/\[/g, ' [ ').replace(/\]/g, ' ] ').trim().split(/\s+/).filter(Boolean);
  let pos = 0;
  const parseList = (): Program => {
    const list: Program = [];
    while (pos < tokens.length) {
      const t = tokens[pos++];
      if (t === ']') return list;
      const lower = t.toLowerCase();
      if (lower === 'u' || lower === 'up') list.push({ id: uid(), type: 'move', dir: 'up' });
      else if (lower === 'd' || lower === 'down') list.push({ id: uid(), type: 'move', dir: 'down' });
      else if (lower === 'l' || lower === 'left') list.push({ id: uid(), type: 'move', dir: 'left' });
      else if (lower === 'r' || lower === 'right') list.push({ id: uid(), type: 'move', dir: 'right' });
      else if (lower === 'paint') list.push({ id: uid(), type: 'paint' });
      else if (lower === 'erase') list.push({ id: uid(), type: 'erase' });
      else if (lower.startsWith('color:')) list.push({ id: uid(), type: 'color', color: t.slice(6) });
      else if (lower.startsWith('repeat:')) {
        const times = parseInt(t.slice(7), 10);
        if (tokens[pos] !== '[') throw new Error('repeat 뒤에는 [ 가 필요해요');
        pos++;
        list.push({ id: uid(), type: 'repeat', times, body: parseList() });
      } else throw new Error('알 수 없는 명령: ' + t);
    }
    return list;
  };
  return parseList();
}
