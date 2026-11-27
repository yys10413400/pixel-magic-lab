import { describe, expect, it } from 'vitest';
import { runProgram, gridToRows, diffGrids, MAX_REPEAT, emptyGrid, centerOf } from '../src/engine/interpreter';
import {
  parseProgram,
  countBlocks,
  insertBlock,
  createBlock,
  moveBlock,
  removeBlock,
  nudgeBlock,
  locate,
  sanitizeProgram,
  canInsert,
  updateBlock,
  findBlock,
  findList,
  removeDefine,
  cloneProgram,
  ELSE_SUFFIX,
} from '../src/engine/program';
import type { Program, RepeatBlock } from '../src/engine/types';

const run = (src: string, w = 5, h = 5) => runProgram(parseProgram(src), { width: w, height: h });

describe('실행 엔진 — 기본 블록', () => {
  it('펜은 (0,0)에서 시작하고 처음 위치는 칠하지 않는다', () => {
    const r = run('');
    expect(r.finalX).toBe(0);
    expect(r.finalY).toBe(0);
    expect(r.finalGrid.every((c) => c === null)).toBe(true);
    expect(r.steps).toHaveLength(0);
  });

  it('이동 블록은 위치만 바꾸고 칠하지 않는다', () => {
    const r = run('R D R D L U');
    expect([r.finalX, r.finalY]).toEqual([1, 1]);
    expect(r.finalGrid.every((c) => c === null)).toBe(true);
    expect(r.steps.map((s) => [s.x, s.y])).toEqual([
      [1, 0],
      [1, 1],
      [2, 1],
      [2, 2],
      [1, 2],
      [1, 1],
    ]);
  });

  it('색칠하기는 현재 칸을 현재 색으로 칠한다 (기본 보라)', () => {
    const r = run('R paint');
    expect(gridToRows(r.finalGrid, 5)[0]).toBe('.P...');
    const paint = r.steps[1];
    expect(paint.kind).toBe('paint');
    expect(paint.change).toEqual({ index: 1, before: null, after: 'P' });
  });

  it('색 바꾸기 후 칠하면 그 색이 된다', () => {
    const r = run('color:Y paint R color:G paint');
    expect(gridToRows(r.finalGrid, 5)[0]).toBe('YG...');
    expect(r.finalColor).toBe('G');
  });

  it('지우기는 현재 칸을 빈칸으로 만든다', () => {
    const r = run('paint R paint L erase');
    expect(gridToRows(r.finalGrid, 5)[0]).toBe('.P...');
    expect(r.steps[r.steps.length - 1].change).toEqual({ index: 0, before: 'P', after: null });
  });

  it('밑그림(base) 위에서 실행되고 원본은 바뀌지 않는다', () => {
    const base = emptyGrid(3, 3);
    base[4] = 'R';
    const r = runProgram(parseProgram('R D erase R paint'), { width: 3, height: 3, base });
    expect(base[4]).toBe('R');
    expect(r.finalGrid[4]).toBe(null);
    expect(r.finalGrid[5]).toBe('P');
  });
});

describe('실행 엔진 — 반복', () => {
  it('반복은 안쪽 블록을 정해진 횟수만큼 실행한다', () => {
    const r = run('repeat:4[paint R] paint');
    expect(gridToRows(r.finalGrid, 5)[0]).toBe('PPPPP');
    const loops = r.steps.filter((s) => s.kind === 'loop');
    expect(loops.map((s) => s.loops[0].iter)).toEqual([1, 2, 3, 4]);
    expect(loops.every((s) => s.loops[0].total === 4)).toBe(true);
  });

  it('중첩 반복: 5×5 전체 칠하기', () => {
    const r = run('repeat:5[repeat:4[paint R] paint repeat:4[L] D]', 5, 6);
    const rows = gridToRows(r.finalGrid, 5);
    expect(rows.slice(0, 5).every((row) => row === 'PPPPP')).toBe(true);
    expect(rows[5]).toBe('.....');
    expect(r.error).toBeUndefined();
  });

  it('중첩 반복의 loops 정보에 바깥/안쪽 반복이 모두 담긴다', () => {
    const r = run('repeat:2[repeat:3[paint]]');
    const inner = r.steps.filter((s) => s.kind === 'paint');
    expect(inner).toHaveLength(6);
    expect(inner[4].loops.map((l) => l.iter)).toEqual([2, 2]);
  });

  it('3겹 중첩까지 동작한다', () => {
    const r = run('repeat:2[repeat:2[repeat:2[paint]]]');
    expect(r.steps.filter((s) => s.kind === 'paint')).toHaveLength(8);
    expect(r.error).toBeUndefined();
  });

  it('빈 반복도 멈추지 않는다', () => {
    const r = run('repeat:3[] R paint');
    expect(r.error).toBeUndefined();
    expect(r.finalGrid[1]).toBe('P');
  });
});

describe('실행 엔진 — 오류와 안전 장치', () => {
  it('도화지 밖으로 나가면 오류 블록과 위치를 알려준다', () => {
    const prog = parseProgram('paint U paint');
    const r = runProgram(prog, { width: 5, height: 5 });
    expect(r.error?.code).toBe('out-of-bounds');
    expect(r.error?.blockId).toBe(prog[1].id);
    expect(r.error?.target).toEqual({ x: 0, y: -1 });
    expect(r.error?.message).toContain('도화지 밖');
    // 오류 전까지의 결과는 남아 있고, 그 뒤 명령은 실행되지 않는다
    expect(r.finalGrid[0]).toBe('P');
    expect(r.steps[r.steps.length - 1].kind).toBe('error');
    expect([r.finalX, r.finalY]).toEqual([0, 0]);
  });

  it('네 방향 모두 가장자리 검사', () => {
    expect(run('L').error?.code).toBe('out-of-bounds');
    expect(run('U').error?.code).toBe('out-of-bounds');
    expect(run('repeat:5[R]').error?.code).toBe('out-of-bounds');
    expect(run('repeat:5[D]').error?.code).toBe('out-of-bounds');
    expect(run('repeat:4[R] repeat:4[D]').error).toBeUndefined();
  });

  it('반복 안에서 밖으로 나가면 그 이동 블록이 오류 블록이다', () => {
    const prog = parseProgram('repeat:9[R]');
    const r = runProgram(prog, { width: 5, height: 5 });
    expect(r.error?.blockId).toBe((prog[0] as RepeatBlock).body[0].id);
    const last = r.steps[r.steps.length - 1];
    expect(last.loops[0].iter).toBe(5);
  });

  it('반복 횟수가 너무 크면 친절한 오류', () => {
    const r = run(`repeat:${MAX_REPEAT + 1}[paint]`);
    expect(r.error?.code).toBe('repeat-too-big');
    expect(r.error?.message).toContain('반복 횟수가 너무 커요');
    expect(r.steps.filter((s) => s.kind === 'paint')).toHaveLength(0);
  });

  it('반복 횟수 0 이하도 오류', () => {
    expect(run('repeat:0[paint]').error?.code).toBe('repeat-too-small');
  });

  it('아주 긴 실행은 단계 제한으로 멈춘다 (무한 실행 방지)', () => {
    const r = run('repeat:30[repeat:30[repeat:30[paint]]]');
    expect(r.error?.code).toBe('too-many-steps');
    expect(r.steps.length).toBeLessThanOrEqual(5001);
  });

  it('너무 깊은 중첩은 실행되지 않는다', () => {
    const r = run('repeat:2[repeat:2[repeat:2[repeat:2[paint]]]]');
    expect(r.error?.code).toBe('too-deep');
  });

  it('실행할 때마다 새 도화지에서 시작한다 (결과가 섞이지 않음)', () => {
    const p = parseProgram('R paint');
    const a = runProgram(p, { width: 3, height: 1 });
    const b = runProgram(p, { width: 3, height: 1 });
    expect(a.finalGrid).toEqual(b.finalGrid);
    expect(a.finalGrid).not.toBe(b.finalGrid);
  });

  it('diffGrids 는 다른 칸 번호를 돌려준다', () => {
    expect(diffGrids(['R', null, 'G'], ['R', 'Y', null])).toEqual([1, 2]);
  });
});

describe('블록 편집 함수', () => {
  it('블록 추가 / 반복 안에 추가 / 삭제', () => {
    let p: Program = [];
    const rep = createBlock('repeat');
    p = insertBlock(p, null, 0, rep);
    p = insertBlock(p, rep.id, 0, createBlock('paint'));
    p = insertBlock(p, rep.id, 1, createBlock('right'));
    expect(countBlocks(p)).toBe(3);
    const paintId = (p[0] as RepeatBlock).body[0].id;
    p = removeBlock(p, paintId);
    expect(countBlocks(p)).toBe(2);
    p = removeBlock(p, rep.id);
    expect(p).toHaveLength(0);
  });

  it('블록 순서 바꾸기 (같은 목록, 다른 목록)', () => {
    let p = parseProgram('R D paint');
    const [r, d, paint] = p;
    p = moveBlock(p, r.id, null, 3);
    expect(p.map((b) => b.id)).toEqual([d.id, paint.id, r.id]);
    p = nudgeBlock(p, r.id, -1);
    expect(p.map((b) => b.id)).toEqual([d.id, r.id, paint.id]);
    p = nudgeBlock(p, d.id, -1); // 맨 위에서는 그대로
    expect(p[0].id).toBe(d.id);
    const rep = createBlock('repeat');
    p = insertBlock(p, null, 0, rep);
    p = moveBlock(p, paint.id, rep.id, 0);
    expect(locate(p, paint.id)).toEqual({ listId: rep.id, index: 0 });
    p = moveBlock(p, paint.id, null, 0);
    expect(locate(p, paint.id)).toEqual({ listId: null, index: 0 });
  });

  it('반복 블록을 자기 자신 안으로 옮길 수 없다', () => {
    const p = parseProgram('repeat:2[repeat:2[paint]]');
    const outer = p[0] as RepeatBlock;
    const inner = outer.body[0] as RepeatBlock;
    expect(moveBlock(p, outer.id, inner.id, 0)).toBe(p);
  });

  it('3겹보다 깊게 넣을 수 없다', () => {
    const p = parseProgram('repeat:2[repeat:2[repeat:2[paint]]]');
    const innermost = ((p[0] as RepeatBlock).body[0] as RepeatBlock).body[0] as RepeatBlock;
    expect(canInsert(p, innermost.id, createBlock('repeat'))).toBe(false);
    expect(canInsert(p, innermost.id, createBlock('paint'))).toBe(true);
  });

  it('반복 횟수와 색 수정', () => {
    let p = parseProgram('repeat:2[color:R]');
    const rep = p[0] as RepeatBlock;
    p = updateBlock(p, rep.id, { times: 7 });
    p = updateBlock(p, rep.body[0].id, { color: 'G' });
    expect((findBlock(p, rep.id) as RepeatBlock).times).toBe(7);
    expect(findBlock(p, rep.body[0].id)).toMatchObject({ color: 'G' });
  });

  it('저장된 데이터 복원 시 잘못된 값은 걸러낸다', () => {
    const p = sanitizeProgram([
      { type: 'move', dir: 'up' },
      { type: 'move', dir: 'sideways' },
      { type: 'repeat', times: 3, body: [{ type: 'paint' }, 42, null] },
      'junk',
    ]);
    expect(p).toHaveLength(2);
    expect(countBlocks(p)).toBe(3);
    expect(sanitizeProgram('nope')).toEqual([]);
  });
});

describe('펜 출발 위치', () => {
  it('가운데 칸: 짝수 크기는 가운데 4칸 중 오른쪽 아래', () => {
    expect(centerOf(8, 8)).toEqual({ x: 4, y: 4 });
    expect(centerOf(10, 10)).toEqual({ x: 5, y: 5 });
    expect(centerOf(16, 16)).toEqual({ x: 8, y: 8 });
  });

  it('가운데에서 출발하면 위·아래·왼쪽·오른쪽 모두 바로 그릴 수 있다', () => {
    const p = parseProgram('paint U paint D D paint U L paint R R paint');
    const r = runProgram(p, { width: 8, height: 8, startX: 4, startY: 4 });
    expect(r.error).toBeUndefined();
    expect(gridToRows(r.finalGrid, 8).slice(3, 6)).toEqual(['....P...', '...PPP..', '....P...']);
  });

  it('출발 위치를 주지 않으면 (0,0) — 미션 모드 그대로', () => {
    const r = runProgram(parseProgram('paint'), { width: 8, height: 8 });
    expect(r.finalGrid[0]).toBe('P');
  });
});

describe('블록 옮기기 (nudgeBlock)', () => {
  it('옆에 반복 블록이 있으면 그 안으로 들어가고, 끝에서는 밖으로 나와요', () => {
    let p = parseProgram('repeat:2[R] paint');
    const [rep, paint] = p;
    p = nudgeBlock(p, paint.id, -1); // 위로 → 반복 안 맨 끝
    expect(locate(p, paint.id)).toEqual({ listId: rep.id, index: 1 });
    p = nudgeBlock(p, paint.id, 1); // 아래로 → 반복 밖, 반복 바로 뒤
    expect(locate(p, paint.id)).toEqual({ listId: null, index: 1 });
    p = nudgeBlock(p, paint.id, -1);
    p = nudgeBlock(p, paint.id, -1); // 반복 안 맨 앞으로
    expect(locate(p, paint.id)).toEqual({ listId: rep.id, index: 0 });
    p = nudgeBlock(p, paint.id, -1); // 반복 맨 앞에서 위로 → 반복 앞으로 나와요
    expect(locate(p, paint.id)).toEqual({ listId: null, index: 0 });
  });

  it('반복을 너무 깊게 겹치게 되면 들어가지 않고 건너뛰어요', () => {
    let p = parseProgram('repeat:2[R] repeat:2[repeat:2[repeat:2[paint]]]'); // 3겹 반복을 다른 반복 안에 넣으면 4겹
    const outer2 = p[1];
    p = nudgeBlock(p, outer2.id, -1);
    // 4겹이 되므로 안으로 들어가지 않고 앞으로 자리만 바꿔요
    expect(locate(p, outer2.id)).toEqual({ listId: null, index: 0 });
  });
});

describe('새 블록: 다음 색으로 · 펜 · 만약 · 나만의 블록', () => {
  const W = 5;
  const go = (src: string, base?: string[]) =>
    runProgram(parseProgram(src), {
      width: W,
      height: 1,
      base: base
        ? base
            .join('')
            .split('')
            .map((c) => (c === '.' ? null : c))
        : undefined,
    });
  const row = (src: string, base?: string[]) => gridToRows(go(src, base).finalGrid, W)[0];

  it('다음 색으로: 무지개 순서로 바뀌고, 보라 다음은 빨강', () => {
    expect(row('next paint R next paint R next paint R next paint R next paint')).toBe('ROYGS');
    expect(row('color:B next paint R next paint R next paint')).toBe('PRO..');
    expect(row('color:K next paint')).toBe('R....'); // 무지개에 없는 색에서는 빨강부터
  });

  it('펜 내리기: 지금 칸과 지나가는 칸을 칠하고, 펜 올리기 뒤에는 칠하지 않아요', () => {
    expect(row('pendown R R penup R R')).toBe('PPP..');
    expect(row('R penup R pendown R')).toBe('..PP.');
  });

  it('만약 비어 있으면 / 칠해져 있으면', () => {
    expect(row('color:Y if:empty[paint] R if:empty[paint]', ['.K...'])).toBe('YK...');
    expect(row('R if:filled[erase] R if:filled[erase]', ['.KK..'])).toBe('.....');
  });

  it('만약 ~ 아니면: 맞으면 위 칸, 아니면 아니면 칸', () => {
    expect(row('repeat:4[ifelse:empty[paint][erase] R] ifelse:empty[paint][erase]', ['P.P.P'])).toBe('.P.P.');
  });

  it('만약 블록은 살펴본 결과를 기록에 남겨요 (화면에 보여 주려고)', () => {
    const r = go('if:empty[paint]', ['.....']);
    expect(r.steps[0]).toMatchObject({ kind: 'check', check: true });
  });

  it('나만의 블록: 만들기는 지나가고, 쓰기에서 안쪽 블록을 실행해요', () => {
    expect(row('def:점[paint R R] call:점 call:점 paint')).toBe('P.P.P');
    // 쓰기 블록이 없으면 아무 일도 없어요
    expect(row('def:점[paint R R]')).toBe('.....');
  });

  it('나만의 블록 안에서 자기 자신을 부르면 친절한 오류로 멈춰요', () => {
    const r = go('def:끝없이[paint call:끝없이] call:끝없이');
    expect(r.error?.code).toBe('self-call');
  });

  it('만들기가 없는 나만의 블록을 쓰면 오류', () => {
    const p: Program = [{ id: 'c1', type: 'call', defId: '없음' }];
    expect(runProgram(p, { width: 3, height: 1 }).error?.code).toBe('missing-define');
  });
});

describe('그릇 블록 편집: 만약 ~ 아니면, 나만의 블록', () => {
  it('아니면 칸에 넣고, 찾고, 옮길 수 있어요', () => {
    let p = parseProgram('ifelse:empty[paint][erase] R');
    const iff = p[0];
    const r = p[1];
    p = moveBlock(p, r.id, iff.id + ELSE_SUFFIX, 0);
    expect(locate(p, r.id)).toEqual({ listId: iff.id + ELSE_SUFFIX, index: 0 });
    expect(findList(p, iff.id + ELSE_SUFFIX)).toHaveLength(2);
    expect(countBlocks(p)).toBe(4);
  });

  it('위로 옮기면 만약 블록의 마지막 칸(아니면)으로 들어가요', () => {
    let p = parseProgram('ifelse:empty[paint][erase] R');
    const [iff, r] = p;
    p = nudgeBlock(p, r.id, -1);
    expect(locate(p, r.id)?.listId).toBe(iff.id + ELSE_SUFFIX);
  });

  it('나만의 블록 만들기는 가장 바깥에만 넣을 수 있어요', () => {
    const p = parseProgram('repeat:2[R]');
    const def = createBlock('define');
    expect(canInsert(p, p[0].id, def)).toBe(false);
    expect(canInsert(p, null, def)).toBe(true);
  });

  it('만들기를 지우면 쓰는 곳도 함께 지워지고, 프로그램을 복제하면 쓰기가 새 만들기를 가리켜요', () => {
    const p = parseProgram('def:점[paint] call:점 repeat:2[call:점]');
    expect(countBlocks(removeDefine(p, p[0].id))).toBe(1); // 빈 반복만 남아요
    const copy = cloneProgram(p);
    expect(copy[1].type === 'call' && copy[1].defId).toBe(copy[0].id);
  });

  it('저장된 데이터 복원: 새 블록도 그대로, 이상한 값은 걸러요', () => {
    const p = parseProgram('next pendown ifelse:filled[R][L] def:별[paint] call:별');
    expect(sanitizeProgram(JSON.parse(JSON.stringify(p)))).toEqual(p);
    const bad = sanitizeProgram([
      { type: 'if', cond: '이상함', body: [] },
      { type: 'define', name: '', body: [] },
    ]);
    expect(bad[0]).toMatchObject({ type: 'if', cond: 'empty', elseBody: null });
    expect(bad[1]).toMatchObject({ type: 'define', name: '나만의 마법' });
  });
});
