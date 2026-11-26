import type { Block, Grid, Program } from '../engine/types';
import { centerOf, gridsEqual, runProgram } from '../engine/interpreter';
import { uid } from '../engine/program';

// ─────────────────────────────────────────────
// 저장 데이터 버전과 변환
//
// schema 1 (표시 없음): 예전 저장 데이터. 처음 버전은 공방·극장에서도 펜이 (0,0)에서 출발했고,
//   나중 버전은 도화지 가운데에서 출발했어요. 둘 다 같은 저장 칸에 들어 있어서 표시가 없어요.
// schema 2: 공방·극장 펜은 가운데에서 출발. 모든 기록에 schema: 2 를 붙여요.
//
// schema 1 → 2 변환: (0,0) 출발로 만든 코드라고 판단되면, 코드 맨 앞에
//   [가운데 → (0,0)] 으로 옮기는 반복 블록 두 개를 붙여서 그림이 그대로 나오게 해요.
//   - 공방 작품: 저장된 완성 그림(pixels)과 비교해서 확실하게 판단해요.
//   - 극장 장면·임시 저장: 완성 그림이 없어서, 가운데 출발로는 도화지 밖으로 나가는데
//     (0,0) 출발로는 문제없이 실행될 때만 (0,0) 코드로 판단해요.
// ─────────────────────────────────────────────

export const SCHEMA = 2;

export function schemaOf(raw: Record<string, unknown>): number {
  return typeof raw.schema === 'number' && raw.schema >= 1 ? raw.schema : 1;
}

function run(program: Program, base: Grid, size: number, fromCenter: boolean) {
  const c = fromCenter ? centerOf(size, size) : { x: 0, y: 0 };
  return runProgram(program, { width: size, height: size, base, startX: c.x, startY: c.y });
}

/** 가운데에서 출발해도 (0,0) 출발과 똑같이 그려지도록 맨 앞에 이동 블록을 붙여요 */
export function prependMoveToCorner(program: Program, size: number): Program {
  const c = centerOf(size, size);
  const lead: Block[] = [];
  if (c.y > 0) lead.push({ id: uid(), type: 'repeat', times: c.y, body: [{ id: uid(), type: 'move', dir: 'up' }] });
  if (c.x > 0) lead.push({ id: uid(), type: 'repeat', times: c.x, body: [{ id: uid(), type: 'move', dir: 'left' }] });
  return [...lead, ...program];
}

/** 완성 그림을 알고 있을 때: (0,0) 출발로만 그 그림이 나오면 (0,0) 코드 */
export function isCornerProgramByResult(program: Program, base: Grid, size: number, pixels: Grid): boolean {
  if (program.length === 0) return false;
  if (gridsEqual(run(program, base, size, true).finalGrid, pixels)) return false;
  return gridsEqual(run(program, base, size, false).finalGrid, pixels);
}

/** 완성 그림이 없을 때: 가운데 출발로는 오류인데 (0,0) 출발로는 문제없으면 (0,0) 코드 */
export function isCornerProgramByErrors(program: Program, base: Grid, size: number): boolean {
  if (program.length === 0) return false;
  return run(program, base, size, true).error !== undefined && run(program, base, size, false).error === undefined;
}

export function migrateProgram(program: Program, base: Grid, size: number, pixels?: Grid): { program: Program; changed: boolean } {
  const corner = pixels ? isCornerProgramByResult(program, base, size, pixels) : isCornerProgramByErrors(program, base, size);
  return corner ? { program: prependMoveToCorner(program, size), changed: true } : { program, changed: false };
}
