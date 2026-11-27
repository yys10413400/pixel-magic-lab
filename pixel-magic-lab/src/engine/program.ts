import type { Block, BlockKind, ColorKey, ContainerBlock, DefineBlock, IfCond, Program } from './types';
import { DEFAULT_PEN_COLOR } from './palette';

// ─────────────────────────────────────────────
// 프로그램(블록 트리)을 다루는 순수 함수 모음
//
// 블록을 품는 블록(그릇): 반복 · 만약 · 나만의 블록 만들기
// listId: 블록이 들어 있는 목록의 이름
//   null            가장 바깥 목록
//   "블록id"        그릇 블록의 안쪽 목록 (만약 블록이면 "그렇다면" 칸)
//   "블록id#else"   만약 블록의 "아니면" 칸
// ─────────────────────────────────────────────

export const MAX_NEST_DEPTH = 3;
export const ELSE_SUFFIX = '#else';
export const DEFAULT_DEFINE_NAME = '나만의 마법';

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
    case 'next':
      return { id, type: 'next' };
    case 'penDown':
      return { id, type: 'pen', down: true };
    case 'penUp':
      return { id, type: 'pen', down: false };
    case 'if':
      return { id, type: 'if', cond: 'empty', body: [], elseBody: null };
    case 'ifElse':
      return { id, type: 'if', cond: 'empty', body: [], elseBody: [] };
    case 'define':
      return { id, type: 'define', name: DEFAULT_DEFINE_NAME, body: [] };
  }
}

export function createCall(defId: string): Block {
  return { id: uid(), type: 'call', defId };
}

export function blockKind(b: Block): BlockKind | 'call' {
  switch (b.type) {
    case 'move':
      return b.dir;
    case 'pen':
      return b.down ? 'penDown' : 'penUp';
    case 'if':
      return b.elseBody ? 'ifElse' : 'if';
    default:
      return b.type;
  }
}

export function isContainer(b: Block): b is ContainerBlock {
  return b.type === 'repeat' || b.type === 'if' || b.type === 'define';
}

/** 그릇 블록 안의 목록들: [목록 이름, 목록] */
export function childLists(b: Block): [string, Program][] {
  if (b.type === 'repeat' || b.type === 'define') return [[b.id, b.body]];
  if (b.type === 'if')
    return b.elseBody
      ? [
          [b.id, b.body],
          [b.id + ELSE_SUFFIX, b.elseBody],
        ]
      : [[b.id, b.body]];
  return [];
}

/** 목록 이름에서 그 목록을 가진 블록 id */
export function hostId(listId: string): string {
  return listId.endsWith(ELSE_SUFFIX) ? listId.slice(0, -ELSE_SUFFIX.length) : listId;
}

/** 그릇 블록의 한 목록을 바꾼 새 블록 */
function withList(b: ContainerBlock, listId: string, list: Program): Block {
  if (b.type === 'if' && listId.endsWith(ELSE_SUFFIX)) return { ...b, elseBody: list };
  return { ...b, body: list };
}

/** 블록 개수 (그릇 블록도 1개, 그 안의 블록도 각각 1개) */
export function countBlocks(p: Program): number {
  let n = 0;
  for (const b of p) {
    n += 1;
    for (const [, list] of childLists(b)) n += countBlocks(list);
  }
  return n;
}

export function usesRepeat(p: Program): boolean {
  return p.some((b) => b.type === 'repeat' || childLists(b).some(([, l]) => usesRepeat(l)));
}

/** 그릇이 몇 겹 겹쳐 있는지 */
export function maxDepth(p: Program, d = 0): number {
  let m = d;
  for (const b of p) for (const [, list] of childLists(b)) m = Math.max(m, maxDepth(list, d + 1));
  return m;
}

export function findBlock(p: Program, id: string): Block | undefined {
  for (const b of p) {
    if (b.id === id) return b;
    for (const [, list] of childLists(b)) {
      const f = findBlock(list, id);
      if (f) return f;
    }
  }
  return undefined;
}

/** 목록 이름으로 목록 찾기 (없으면 undefined) */
export function findList(p: Program, listId: string | null): Program | undefined {
  if (listId === null) return p;
  const host = findBlock(p, hostId(listId));
  if (!host) return undefined;
  return childLists(host).find(([k]) => k === listId)?.[1];
}

/** 블록이 들어 있는 목록과 위치 */
export function locate(p: Program, id: string, listId: string | null = null): { listId: string | null; index: number } | undefined {
  for (let i = 0; i < p.length; i++) {
    const b = p[i];
    if (b.id === id) return { listId, index: i };
    for (const [key, list] of childLists(b)) {
      const f = locate(list, id, key);
      if (f) return f;
    }
  }
  return undefined;
}

/** 해당 목록이 몇 겹의 그릇 안에 있는지 (바깥 목록 = 0) */
export function listDepth(p: Program, listId: string | null): number {
  if (listId === null) return 0;
  const walk = (list: Program, d: number): number => {
    for (const b of list) {
      for (const [key, child] of childLists(b)) {
        if (key === listId) return d + 1;
        const r = walk(child, d + 1);
        if (r > 0) return r;
      }
    }
    return 0;
  };
  return walk(p, 0);
}

/** 블록 하나 안에 들어 있는 그릇의 깊이 (그릇 블록 자신 포함) */
export function blockDepth(b: Block): number {
  const lists = childLists(b);
  if (lists.length === 0) return 0;
  return 1 + Math.max(0, ...lists.map(([, l]) => maxDepth(l)));
}

export function containsId(b: Block, id: string): boolean {
  if (b.id === id) return true;
  return childLists(b).some(([, l]) => l.some((c) => containsId(c, id)));
}

/** 목록 이름이 이 블록(또는 그 안)의 목록인지 */
function ownsList(b: Block, listId: string): boolean {
  return containsId(b, hostId(listId));
}

function mapList(p: Program, listId: string | null, fn: (list: Program) => Program): Program {
  if (listId === null) return fn(p);
  return p.map((b) => {
    if (!isContainer(b)) return b;
    let next: Block = b;
    for (const [key, list] of childLists(b)) {
      const changed = key === listId ? fn(list) : mapList(list, listId, fn);
      if (changed !== list) next = withList(next as ContainerBlock, key, changed);
    }
    return next;
  });
}

export function listLength(p: Program, listId: string | null): number {
  return findList(p, listId)?.length ?? 0;
}

/** 블록을 넣을 수 있는지 (그릇 깊이 제한, 나만의 블록 만들기는 가장 바깥에만) */
export function canInsert(p: Program, listId: string | null, block: Block): boolean {
  if (listId !== null && !findList(p, listId)) return false;
  if (block.type === 'define' && listId !== null) return false;
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
  return p
    .filter((b) => b.id !== id)
    .map((b) => {
      if (!isContainer(b)) return b;
      let next: Block = b;
      for (const [key, list] of childLists(b)) {
        const changed = removeBlock(list, id);
        if (changed.length !== list.length || changed.some((c, i) => c !== list[i])) next = withList(next as ContainerBlock, key, changed);
      }
      return next;
    });
}

/** 나만의 블록 만들기를 지우면, 그 블록을 쓰는 곳도 함께 지워요 */
export function removeDefine(p: Program, defId: string): Program {
  let next = removeBlock(p, defId);
  for (const id of collectCalls(next, defId)) next = removeBlock(next, id);
  return next;
}

function collectCalls(p: Program, defId: string, out: string[] = []): string[] {
  for (const b of p) {
    if (b.type === 'call' && b.defId === defId) out.push(b.id);
    for (const [, list] of childLists(b)) collectCalls(list, defId, out);
  }
  return out;
}

export function updateBlock(p: Program, id: string, patch: Partial<Block>): Program {
  return p.map((b) => {
    if (b.id === id) return { ...b, ...patch } as Block;
    if (!isContainer(b)) return b;
    let next: Block = b;
    for (const [key, list] of childLists(b)) next = withList(next as ContainerBlock, key, updateBlock(list, id, patch));
    return next;
  });
}

/** 블록을 다른 위치로 옮깁니다. index 는 '옮기기 전' 목록 기준 위치입니다. */
export function moveBlock(p: Program, id: string, listId: string | null, index: number): Program {
  const block = findBlock(p, id);
  const from = locate(p, id);
  if (!block || !from) return p;
  if (listId !== null && ownsList(block, listId)) return p; // 자기 자신 안으로는 못 들어감
  let target = index;
  if (from.listId === listId && from.index < index) target -= 1;
  const removed = removeBlock(p, id);
  if (!canInsert(removed, listId, block)) return p;
  return insertBlock(removed, listId, target, block);
}

/**
 * 블록을 한 칸 위(-1)/아래(+1)로 옮기기.
 * 옆에 그릇 블록이 있으면 그 안으로 들어가고(위로 갈 때는 마지막 칸 끝, 아래로 갈 때는 첫 칸 앞),
 * 그릇의 맨 끝/맨 앞에서는 밖으로 나와요. 옮길 수 없으면 같은 프로그램을 그대로 돌려줘요.
 */
export function nudgeBlock(p: Program, id: string, delta: -1 | 1): Program {
  const loc = locate(p, id);
  if (!loc) return p;
  const list = findList(p, loc.listId)!;
  const block = list[loc.index];
  const without = removeBlock(p, id);
  const neighbor = list[loc.index + delta];
  if (neighbor) {
    const lists = childLists(neighbor);
    if (lists.length > 0) {
      const [key, inner] = delta < 0 ? lists[lists.length - 1] : lists[0];
      if (canInsert(without, key, block)) return moveBlock(p, id, key, delta < 0 ? inner.length : 0);
    }
    return moveBlock(p, id, loc.listId, delta < 0 ? loc.index - 1 : loc.index + 2);
  }
  if (loc.listId === null) return p;
  const parent = locate(p, hostId(loc.listId))!;
  return moveBlock(p, id, parent.listId, delta < 0 ? parent.index : parent.index + 1);
}

/** 블록을 복제 (새 id). 나만의 블록 쓰기는 같은 묶음을 가리켜요. */
export function cloneBlock(b: Block): Block {
  if (b.type === 'repeat' || b.type === 'define') return { ...b, id: uid(), body: b.body.map(cloneBlock) };
  if (b.type === 'if') return { ...b, id: uid(), body: b.body.map(cloneBlock), elseBody: b.elseBody ? b.elseBody.map(cloneBlock) : null };
  return { ...b, id: uid() };
}

/** 프로그램 전체 복제: 나만의 블록 만들기의 id 가 바뀌므로 쓰는 곳도 새 id 로 이어 줘요 */
export function cloneProgram(p: Program): Program {
  const map = new Map<string, string>();
  const copy = p.map((b) => {
    const c = cloneBlock(b);
    if (b.type === 'define') map.set(b.id, c.id);
    return c;
  });
  const relink = (list: Program): Program =>
    list.map((b) => {
      if (b.type === 'call' && map.has(b.defId)) return { ...b, defId: map.get(b.defId)! };
      if (!isContainer(b)) return b;
      let next: Block = b;
      for (const [key, l] of childLists(b)) next = withList(next as ContainerBlock, key, relink(l));
      return next;
    });
  return relink(copy);
}

/** 목록이 들어 있는 가장 바깥 블록의 id (바깥 목록이면 null) */
export function topLevelOf(p: Program, listId: string | null): string | null {
  let cur = listId;
  let top: string | null = null;
  while (cur !== null) {
    top = hostId(cur);
    cur = locate(p, top)?.listId ?? null;
  }
  return top;
}

/** 프로그램 안의 나만의 블록 만들기 목록 */
export function defines(p: Program): DefineBlock[] {
  return p.filter((b): b is DefineBlock => b.type === 'define');
}

const IF_CONDS = new Set<string>(['empty', 'filled']);

/** 저장된 데이터를 안전하게 프로그램으로 복원 (잘못된 데이터는 걸러냄) */
export function sanitizeProgram(raw: unknown, depth = 0): Program {
  if (!Array.isArray(raw) || depth > MAX_NEST_DEPTH) return [];
  const out: Program = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id : uid();
    const inner = (v: unknown) => sanitizeProgram(v, depth + 1);
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
      case 'next':
        out.push({ id, type: 'next' });
        break;
      case 'pen':
        out.push({ id, type: 'pen', down: o.down === true });
        break;
      case 'repeat': {
        const times = typeof o.times === 'number' && Number.isFinite(o.times) ? Math.round(o.times) : 2;
        if (depth + 1 <= MAX_NEST_DEPTH) out.push({ id, type: 'repeat', times, body: inner(o.body) });
        break;
      }
      case 'if': {
        const cond = IF_CONDS.has(o.cond as IfCond) ? (o.cond as IfCond) : 'empty';
        if (depth + 1 <= MAX_NEST_DEPTH)
          out.push({ id, type: 'if', cond, body: inner(o.body), elseBody: Array.isArray(o.elseBody) ? inner(o.elseBody) : null });
        break;
      }
      case 'define':
        if (depth === 0)
          out.push({
            id,
            type: 'define',
            name: typeof o.name === 'string' && o.name.trim() ? o.name.slice(0, 12) : DEFAULT_DEFINE_NAME,
            body: inner(o.body),
          });
        break;
      case 'call':
        if (typeof o.defId === 'string') out.push({ id, type: 'call', defId: o.defId });
        break;
    }
  }
  return out;
}

// ── 짧은 코드로 프로그램을 적는 도우미 (미션 정답, 테스트용) ──
// 예: "R R D D paint", "color:Y repeat:3[ paint right ]"
//   next · pendown · penup
//   if:empty[ ... ]  if:filled[ ... ]  ifelse:empty[ ... ][ ... ]
//   def:꽃[ ... ]  call:꽃      (나만의 블록은 이름으로 이어요)
export function parseProgram(src: string): Program {
  const tokens = src.replace(/\[/g, ' [ ').replace(/\]/g, ' ] ').trim().split(/\s+/).filter(Boolean);
  let pos = 0;
  const defsByName = new Map<string, string>();
  const pendingCalls: { block: { defId: string }; name: string }[] = [];
  const open = () => {
    if (tokens[pos] !== '[') throw new Error(`${tokens[pos - 1]} 뒤에는 [ 가 필요해요`);
    pos++;
  };
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
      else if (lower === 'next') list.push({ id: uid(), type: 'next' });
      else if (lower === 'pendown') list.push({ id: uid(), type: 'pen', down: true });
      else if (lower === 'penup') list.push({ id: uid(), type: 'pen', down: false });
      else if (lower.startsWith('color:')) list.push({ id: uid(), type: 'color', color: t.slice(6) });
      else if (lower.startsWith('repeat:')) {
        const times = parseInt(t.slice(7), 10);
        open();
        list.push({ id: uid(), type: 'repeat', times, body: parseList() });
      } else if (lower.startsWith('if:') || lower.startsWith('ifelse:')) {
        const isElse = lower.startsWith('ifelse:');
        const cond = t.slice(isElse ? 7 : 3) as IfCond;
        if (!IF_CONDS.has(cond)) throw new Error('알 수 없는 조건: ' + t);
        open();
        const body = parseList();
        let elseBody: Program | null = null;
        if (isElse) {
          open();
          elseBody = parseList();
        }
        list.push({ id: uid(), type: 'if', cond, body, elseBody });
      } else if (lower.startsWith('def:')) {
        const name = t.slice(4);
        const id = uid();
        defsByName.set(name, id);
        open();
        list.push({ id, type: 'define', name, body: parseList() });
      } else if (lower.startsWith('call:')) {
        const block = { id: uid(), type: 'call' as const, defId: '' };
        pendingCalls.push({ block, name: t.slice(5) });
        list.push(block);
      } else throw new Error('알 수 없는 명령: ' + t);
    }
    return list;
  };
  const program = parseList();
  for (const { block, name } of pendingCalls) {
    const id = defsByName.get(name);
    if (!id) throw new Error('만들지 않은 나만의 블록: ' + name);
    block.defId = id;
  }
  return program;
}
