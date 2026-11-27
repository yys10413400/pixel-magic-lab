import { describe, expect, it } from 'vitest';
import { CHAPTERS, MISSION_DATA, getMission, starsFor, type MissionData } from '../src/data/missions';
import { runProgram, gridsEqual, gridToRows } from '../src/engine/interpreter';
import { parseProgram, countBlocks, blockKind, childLists } from '../src/engine/program';
import { isColorKey } from '../src/engine/palette';
import type { Program } from '../src/engine/types';

function kindsUsed(p: Program, out = new Set<string>()): Set<string> {
  for (const b of p) {
    out.add(blockKind(b));
    for (const [, list] of childLists(b)) kindsUsed(list, out);
  }
  return out;
}

const run = (m: MissionData, src: string) => runProgram(parseProgram(src), { width: m.width, height: m.height, base: m.base });

describe('미션 데이터', () => {
  it('미션 24개, 번호가 1부터 차례대로, 학년마다 8개', () => {
    expect(MISSION_DATA).toHaveLength(24);
    MISSION_DATA.forEach((m, i) => expect(m.id).toBe(i + 1));
    for (const d of ['easy', 'normal', 'challenge'] as const) expect(MISSION_DATA.filter((m) => m.difficulty === d)).toHaveLength(8);
  });

  it('장 번호와 난이도가 장 목록과 맞고, 장마다 미션이 이어져 있어요', () => {
    for (const m of MISSION_DATA) {
      const c = CHAPTERS.find((x) => x.id === m.chapter);
      expect(c, `미션 ${m.id}`).toBeDefined();
      expect(m.difficulty).toBe(c!.difficulty);
    }
    const chapters = MISSION_DATA.map((m) => m.chapter);
    expect(chapters).toEqual([...chapters].sort((a, b) => a - b));
  });

  for (const m of MISSION_DATA) {
    describe(`미션 ${m.id}. ${m.title}`, () => {
      const solution = parseProgram(m.solution);

      it('목표 그림의 모든 행 길이가 같고 색이 팔레트에 있다', () => {
        expect(m.rows.every((r) => r.length === m.width)).toBe(true);
        expect(m.target.every((c) => c === null || isColorKey(c))).toBe(true);
        expect(m.target.some((c) => c !== null)).toBe(true);
        expect((m.baseRows ?? m.rows).map((r) => r.length)).toEqual(m.rows.map((r) => r.length));
      });

      it('정답 코드를 실제로 실행하면 오류 없이 목표 그림과 같다 → 성공 판정', () => {
        const r = run(m, m.solution);
        expect(r.error).toBeUndefined();
        expect(gridToRows(r.finalGrid, m.width)).toEqual(m.rows);
        expect(gridsEqual(r.finalGrid, m.target)).toBe(true);
      });

      it('정답 코드는 이 미션에서 쓸 수 있는 블록만 사용한다', () => {
        // 나만의 블록 쓰기(call)는 [나만의 블록 만들기]가 있는 미션에서 쓸 수 있어요
        const needed = [...kindsUsed(solution)].map((k) => (k === 'call' ? 'define' : k));
        for (const k of needed) expect(m.blocks).toContain(k);
      });

      it('정답 예시 블록 수로 별 3개를 받을 수 있다', () => {
        expect(starsFor(countBlocks(solution), countBlocks(solution))).toBe(3);
      });

      it('새 개념이 나오면 소개 카드가 있다', () => {
        expect(m.concept === undefined || m.concept.text.length > 10).toBe(true);
        expect(m.hints.length).toBeGreaterThanOrEqual(3);
      });
    });
  }

  for (const m of MISSION_DATA.filter((x) => x.starter)) {
    it(`고치기 미션 ${m.id}: 처음 코드는 목표와 다르다 (고칠 거리가 있다)`, () => {
      const r = run(m, m.starter!);
      expect(r.error !== undefined || !gridsEqual(r.finalGrid, m.target)).toBe(true);
    });
  }

  it('학년마다 고치기 미션이 있다', () => {
    for (const d of ['easy', 'normal', 'challenge'] as const) expect(MISSION_DATA.some((m) => m.difficulty === d && m.starter)).toBe(true);
  });

  it('처음 그림이 있는 미션은 아무것도 안 하면 실패한다 (처음 그림 ≠ 목표)', () => {
    for (const m of MISSION_DATA.filter((x) => x.base)) expect(gridsEqual(m.base!, m.target), `미션 ${m.id}`).toBe(false);
  });

  it('순서가 다른 코드라도 결과가 같으면 성공으로 인정된다 (미션 2)', () => {
    const m = getMission(2);
    // 정답 예시는 왼쪽→오른쪽, 이 코드는 오른쪽 끝까지 가서 왼쪽으로 칠한다
    const r = run(m, 'D R R R R paint L paint L paint L paint L paint');
    expect(gridsEqual(r.finalGrid, m.target)).toBe(true);
  });

  it('반복을 쓰면 블록 수가 줄어든다 (미션 9)', () => {
    const m = getMission(9);
    const long = 'color:Y ' + Array(7).fill('paint R').join(' ') + ' paint';
    expect(gridsEqual(run(m, long).finalGrid, m.target)).toBe(true);
    expect(starsFor(countBlocks(parseProgram(long)), countBlocks(parseProgram(m.solution)))).toBe(1);
  });

  it('만약 없이 손으로 골라 칠해도 성공은 하지만 별이 적다 (미션 18)', () => {
    const m = getMission(18);
    const manual = 'color:Y paint R R paint R R R paint R paint';
    expect(gridsEqual(run(m, manual).finalGrid, m.target)).toBe(true);
    expect(starsFor(countBlocks(parseProgram(manual)), countBlocks(parseProgram(m.solution)))).toBeLessThan(3);
  });

  it('나만의 블록을 쓰면 블록 수가 크게 줄어든다 (미션 21 꽃밭)', () => {
    const m = getMission(21);
    const flower = 'color:K paint D L paint R color:Y paint R color:K paint L D paint U U';
    const long = `R ${flower} R R R ${flower} R R R ${flower}`;
    expect(gridsEqual(run(m, long).finalGrid, m.target)).toBe(true);
    expect(countBlocks(parseProgram(m.solution))).toBeLessThan(countBlocks(parseProgram(long)) / 2);
  });

  it('펜을 올리지 않으면 쌍둥이 창문 사이가 칠해진다 (미션 15)', () => {
    const m = getMission(15);
    const noLift = m.solution.replace('penup ', '');
    expect(gridsEqual(run(m, noLift).finalGrid, m.target)).toBe(false);
  });
});
