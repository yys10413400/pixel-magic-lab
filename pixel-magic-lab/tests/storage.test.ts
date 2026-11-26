import { beforeEach, describe, expect, it } from 'vitest';
import { centerOf, runProgram } from '../src/engine/interpreter';
import { parseProgram } from '../src/engine/program';
import { gridsEqual } from '../src/engine/interpreter';
import { loadAnims, loadTheaterDraft, loadWorks, loadWorkshopDraft, upsertWork, type Artwork } from '../src/lib/storage';
import { prependMoveToCorner, SCHEMA } from '../src/lib/migrations';
import type { Grid, Program } from '../src/engine/types';

// 브라우저 저장소 흉내
class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}
const store = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true });

const SIZE = 8;
const empty = (): Grid => Array.from({ length: SIZE * SIZE }, () => null);
const render = (p: Program, fromCenter: boolean) => {
  const c = fromCenter ? centerOf(SIZE, SIZE) : { x: 0, y: 0 };
  return runProgram(p, { width: SIZE, height: SIZE, base: empty(), startX: c.x, startY: c.y }).finalGrid;
};
const raw = (k: string) => JSON.parse(store.getItem(k) ?? 'null');

beforeEach(() => store.clear());

describe('저장 데이터 변환 (schema 1 → 2)', () => {
  it('맨 앞에 붙인 이동 블록으로 가운데 출발에서도 (0,0) 출발과 같은 그림', () => {
    const p = parseProgram('R R paint D paint');
    expect(gridsEqual(render(prependMoveToCorner(p, SIZE), true), render(p, false))).toBe(true);
  });

  it('(0,0) 출발로 만든 예전 공방 작품은 그림이 그대로 보이게 바뀌고, 다시 저장돼요', () => {
    const p = parseProgram('paint R paint');
    const pixels = render(p, false);
    store.setItem(
      'pml.works.v1',
      JSON.stringify([{ id: 'a', name: '옛 작품', size: SIZE, program: p, base: empty(), pixels, updatedAt: 1 }]),
    );
    const [w] = loadWorks();
    expect(w.program.length).toBe(p.length + 2);
    expect(gridsEqual(render(w.program, true), pixels)).toBe(true);
    expect(raw('pml.works.v1')[0].schema).toBe(SCHEMA);
    // 두 번 읽어도 또 바뀌지 않아요
    expect(loadWorks()[0].program.length).toBe(p.length + 2);
  });

  it('가운데 출발로 만든 예전 공방 작품은 그대로', () => {
    const p = parseProgram('paint R paint');
    const pixels = render(p, true);
    store.setItem(
      'pml.works.v1',
      JSON.stringify([{ id: 'b', name: '새 작품', size: SIZE, program: p, base: empty(), pixels, updatedAt: 1 }]),
    );
    expect(loadWorks()[0].program.map((b) => b.id)).toEqual(p.map((b) => b.id));
  });

  it('새로 저장하는 작품에는 schema 표시가 붙고 변환하지 않아요', () => {
    const p = parseProgram('L L L L paint');
    const w: Artwork = { id: 'c', name: '왼쪽 끝', size: SIZE, program: p, base: empty(), pixels: render(p, true), updatedAt: 2 };
    upsertWork(w);
    expect(raw('pml.works.v1')[0].schema).toBe(SCHEMA);
    expect(loadWorks()[0].program).toHaveLength(p.length);
  });

  it('극장 장면: 가운데 출발로는 밖으로 나가는 예전 코드만 바꿔요', () => {
    const oldCode = parseProgram('D D D color:R repeat:7[R] paint'); // 예전 "굴리는 공" 템플릿
    const fine = parseProgram('U paint');
    store.setItem(
      'pml.anims.v1',
      JSON.stringify([
        {
          id: 'x',
          name: '공',
          size: SIZE,
          fps: 4,
          loop: true,
          updatedAt: 1,
          frames: [
            { id: 'f1', program: oldCode, base: empty() },
            { id: 'f2', program: fine, base: empty() },
          ],
        },
      ]),
    );
    const [a] = loadAnims();
    expect(a.frames[0].program.length).toBe(oldCode.length + 2);
    expect(gridsEqual(render(a.frames[0].program, true), render(oldCode, false))).toBe(true);
    expect(a.frames[1].program).toHaveLength(fine.length);
    expect(raw('pml.anims.v1')[0].schema).toBe(SCHEMA);
  });

  it('임시 저장(공방·극장)도 같은 규칙으로 바꿔요', () => {
    const oldCode = parseProgram('repeat:7[R] paint');
    store.setItem(
      'pml.draft.workshop.v1',
      JSON.stringify({ savedId: null, name: '', size: SIZE, program: oldCode, base: empty(), dirty: true }),
    );
    expect(loadWorkshopDraft()!.program.length).toBe(oldCode.length + 2);
    store.setItem(
      'pml.draft.theater.v1',
      JSON.stringify({
        savedId: null,
        dirty: true,
        project: {
          id: 'p',
          name: '',
          size: SIZE,
          fps: 4,
          loop: true,
          updatedAt: 1,
          frames: [{ id: 'f', program: oldCode, base: empty() }],
        },
      }),
    );
    expect(loadTheaterDraft()!.project.frames[0].program.length).toBe(oldCode.length + 2);
  });

  it('망가진 저장 데이터가 있어도 멈추지 않아요', () => {
    store.setItem('pml.works.v1', '{망가짐');
    expect(loadWorks()).toEqual([]);
    store.setItem('pml.works.v1', JSON.stringify([null, 3, { size: 'big' }]));
    expect(loadWorks()).toHaveLength(1);
  });
});
