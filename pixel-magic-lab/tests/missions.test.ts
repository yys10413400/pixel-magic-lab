import { describe, expect, it } from 'vitest';
import { MISSION_DATA, starsFor } from '../src/data/missions';
import { runProgram, gridsEqual, gridToRows } from '../src/engine/interpreter';
import { parseProgram, countBlocks, blockKind } from '../src/engine/program';
import { isColorKey } from '../src/engine/palette';
import type { Program } from '../src/engine/types';

function kindsUsed(p: Program, out = new Set<string>()): Set<string> {
  for (const b of p) {
    out.add(blockKind(b));
    if (b.type === 'repeat') kindsUsed(b.body, out);
  }
  return out;
}

describe('미션 데이터', () => {
  it('미션은 10개 이상이고 번호가 1부터 차례대로다', () => {
    expect(MISSION_DATA.length).toBeGreaterThanOrEqual(10);
    MISSION_DATA.forEach((m, i) => expect(m.id).toBe(i + 1));
  });

  for (const m of MISSION_DATA) {
    describe(`미션 ${m.id}. ${m.title}`, () => {
      const solution = parseProgram(m.solution);

      it('목표 그림의 모든 행 길이가 같고 색이 팔레트에 있다', () => {
        expect(m.rows.every((r) => r.length === m.width)).toBe(true);
        expect(m.target.every((c) => c === null || isColorKey(c))).toBe(true);
        expect(m.target.some((c) => c !== null)).toBe(true);
      });

      it('정답 코드를 실제로 실행하면 오류 없이 목표 그림과 같다 → 성공 판정', () => {
        const r = runProgram(solution, { width: m.width, height: m.height });
        expect(r.error).toBeUndefined();
        expect(gridToRows(r.finalGrid, m.width)).toEqual(m.rows);
        expect(gridsEqual(r.finalGrid, m.target)).toBe(true);
      });

      it('정답 코드는 이 미션에서 쓸 수 있는 블록만 사용한다', () => {
        for (const k of kindsUsed(solution)) expect(m.blocks).toContain(k);
      });

      it('정답 예시 블록 수로 별 3개를 받을 수 있다', () => {
        expect(starsFor(countBlocks(solution), countBlocks(solution))).toBe(3);
      });
    });
  }

  for (const m of MISSION_DATA.filter((x) => x.starter)) {
    it(`디버깅 미션 ${m.id}: 처음 코드는 목표와 다르다 (고칠 거리가 있다)`, () => {
      const r = runProgram(parseProgram(m.starter!), { width: m.width, height: m.height });
      expect(r.error !== undefined || !gridsEqual(r.finalGrid, m.target)).toBe(true);
    });
  }

  it('순서가 다른 코드라도 결과가 같으면 성공으로 인정된다 (미션 2)', () => {
    const m = MISSION_DATA[1];
    // 정답 예시는 왼쪽→오른쪽, 이 코드는 오른쪽 끝까지 가서 왼쪽으로 칠한다
    const alt = parseProgram('D R R R R paint L paint L paint L paint L paint');
    const r = runProgram(alt, { width: m.width, height: m.height });
    expect(gridsEqual(r.finalGrid, m.target)).toBe(true);
  });

  it('반복을 쓰면 블록 수가 줄어든다 (미션 6)', () => {
    const m = MISSION_DATA[5];
    const loop = countBlocks(parseProgram(m.solution));
    const row = (c: string, dir: string) => `color:${c} ` + Array(6).fill(`paint ${dir}`).join(' ') + ' paint';
    const longSrc = [row('R', 'R'), 'D', row('O', 'L'), 'D', row('Y', 'R'), 'D', row('G', 'L'), 'D', row('S', 'R')].join(' ');
    const long = parseProgram(longSrc);
    const r = runProgram(long, { width: m.width, height: m.height });
    expect(gridsEqual(r.finalGrid, m.target)).toBe(true);
    expect(loop).toBeLessThan(countBlocks(long));
    expect(starsFor(countBlocks(long), loop)).toBe(1);
  });
});
