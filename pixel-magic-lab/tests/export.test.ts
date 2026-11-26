import { describe, expect, it } from 'vitest';
import { lzwEncode, encodeGif } from '../src/lib/gif';
import { buildGif } from '../src/lib/exporters';
import { TEMPLATES, projectFromTemplate } from '../src/data/templates';
import { runProgram, gridFromRows } from '../src/engine/interpreter';
import { sanitizeAnim } from '../src/lib/storage';

// GIF 디코더 (검증용): LZW 를 풀어서 원래 색 인덱스가 나오는지 확인
function lzwDecode(data: number[], minCodeSize: number, count: number): number[] {
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  let size = minCodeSize + 1;
  let dict: number[][] = [];
  const reset = () => {
    dict = [];
    for (let i = 0; i < clear; i++) dict[i] = [i];
    dict[clear] = [];
    dict[eoi] = [];
    size = minCodeSize + 1;
  };
  reset();
  const out: number[] = [];
  let bitPos = 0;
  const readCode = () => {
    let code = 0;
    for (let i = 0; i < size; i++) {
      const byte = data[(bitPos + i) >> 3] ?? 0;
      if ((byte >> ((bitPos + i) & 7)) & 1) code |= 1 << i;
    }
    bitPos += size;
    return code;
  };
  let prev: number[] | null = null;
  while (out.length < count + 1) {
    const code = readCode();
    if (code === clear) {
      reset();
      prev = null;
      continue;
    }
    if (code === eoi) break;
    let entry: number[];
    if (code < dict.length && dict[code]) entry = dict[code];
    else if (prev) entry = [...prev, prev[0]];
    else throw new Error('bad code');
    out.push(...entry);
    if (prev) {
      dict.push([...prev, entry[0]]);
      if (dict.length === 1 << size && size < 12) size++;
    }
    prev = entry;
  }
  return out;
}

function parseGif(bytes: Uint8Array) {
  const sig = String.fromCharCode(...bytes.slice(0, 6));
  const width = bytes[6] | (bytes[7] << 8);
  const height = bytes[8] | (bytes[9] << 8);
  const flags = bytes[10];
  const gctSize = 1 << ((flags & 7) + 1);
  let p = 13 + gctSize * 3;
  const frames: number[][] = [];
  let loopExt = false;
  const delays: number[] = [];
  while (p < bytes.length) {
    const b = bytes[p++];
    if (b === 0x3b) break;
    if (b === 0x21) {
      const label = bytes[p++];
      if (label === 0xff) loopExt = true;
      if (label === 0xf9) delays.push(bytes[p + 2] | (bytes[p + 3] << 8));
      while (bytes[p] !== 0) p += bytes[p] + 1;
      p++;
    } else if (b === 0x2c) {
      p += 9;
      const min = bytes[p++];
      const data: number[] = [];
      while (bytes[p] !== 0) {
        const n = bytes[p++];
        for (let i = 0; i < n; i++) data.push(bytes[p++]);
      }
      p++;
      frames.push(lzwDecode(data, min, width * height).slice(0, width * height));
    } else throw new Error('unknown block ' + b);
  }
  return { sig, width, height, frames, loopExt, delays };
}

describe('GIF 내보내기', () => {
  it('LZW 압축 결과를 풀면 원래 값과 같다 (긴 데이터, 사전 초기화 포함)', () => {
    const n = 40000;
    const data = new Uint8Array(n);
    let s = 7;
    for (let i = 0; i < n; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      data[i] = (s >> 16) % 13;
    }
    const enc = lzwEncode(data, 4);
    expect(lzwDecode(enc, 4, n).slice(0, n)).toEqual(Array.from(data));
  });

  it('여러 프레임 GIF 파일 구조가 올바르다', () => {
    const f1 = new Uint8Array([0, 1, 2, 3]);
    const f2 = new Uint8Array([3, 2, 1, 0]);
    const gif = encodeGif({
      width: 2,
      height: 2,
      palette: [
        [0, 0, 0],
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255],
      ],
      frames: [f1, f2],
      delayCs: 25,
      loop: true,
    });
    const parsed = parseGif(gif);
    expect(parsed.sig).toBe('GIF89a');
    expect(parsed.frames).toEqual([Array.from(f1), Array.from(f2)]);
    expect(parsed.loopExt).toBe(true);
    expect(parsed.delays).toEqual([25, 25]);
  });

  it('템플릿 애니메이션 전체를 GIF 로 만들 수 있다', () => {
    for (const t of TEMPLATES) {
      const proj = projectFromTemplate(t);
      const grids = proj.frames.map((f) => runProgram(f.program, { width: 8, height: 8, base: f.base }).finalGrid);
      const gif = buildGif(grids, 8, 8, proj.fps, true, 4);
      const parsed = parseGif(gif);
      expect(parsed.width).toBe(32);
      expect(parsed.frames).toHaveLength(proj.frames.length);
      // 첫 프레임 왼쪽 위 픽셀 색 확인
      const first = grids[0][0];
      expect(parsed.frames[0][0] === 0).toBe(first === null);
    }
  });
});

describe('애니메이션 템플릿', () => {
  it('모든 템플릿 프레임은 8×8 이고 코드가 오류 없이 실행된다', () => {
    for (const t of TEMPLATES) {
      for (const f of t.frames.filter((fr) => fr.rows)) {
        const g = gridFromRows(f.rows!);
        expect([g.width, g.height]).toEqual([8, 8]);
      }
      const p = projectFromTemplate(t);
      for (const f of p.frames)
        expect(runProgram(f.program, { width: 8, height: 8, base: f.base, startX: 4, startY: 4 }).error).toBeUndefined();
    }
  });

  it('코드로 굴리는 공: 프레임마다 공이 한 칸씩 이동', () => {
    const p = projectFromTemplate(TEMPLATES.find((t) => t.key === 'ball')!);
    const xs = p.frames.map(
      (f) => runProgram(f.program, { width: 8, height: 8, base: f.base, startX: 4, startY: 4 }).finalGrid.findIndex((c) => c === 'R') % 8,
    );
    expect(xs).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('저장된 애니메이션 복원 시 잘못된 데이터를 바로잡는다', () => {
    const a = sanitizeAnim({ name: 'x', size: 99, fps: 100, frames: [] });
    expect(a?.size).toBe(8);
    expect(a?.fps).toBe(4);
    expect(a?.frames).toHaveLength(1);
  });
});
