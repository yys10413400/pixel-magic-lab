// ─────────────────────────────────────────────
// 아주 작은 GIF89a 인코더 (외부 라이브러리 없이 동작)
// 색 인덱스 배열(프레임) → 움직이는 GIF 파일 바이트
// ─────────────────────────────────────────────

export type RGB = [number, number, number];

export interface GifOptions {
  width: number;
  height: number;
  palette: RGB[]; // 최대 256색
  frames: Uint8Array[]; // 각 프레임: width*height 개의 팔레트 인덱스
  delayCs: number; // 프레임 간격 (1/100초)
  loop: boolean; // true = 무한 반복
}

class ByteWriter {
  private buf: number[] = [];
  byte(b: number) {
    this.buf.push(b & 0xff);
  }
  word(w: number) {
    this.byte(w & 0xff);
    this.byte((w >> 8) & 0xff);
  }
  bytes(arr: ArrayLike<number>) {
    for (let i = 0; i < arr.length; i++) this.byte(arr[i]);
  }
  str(s: string) {
    for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i));
  }
  out(): Uint8Array {
    return Uint8Array.from(this.buf);
  }
}

/** LZW 압축 (GIF 방식) — 결과는 아직 255바이트 묶음으로 나누지 않은 바이트 */
export function lzwEncode(indices: Uint8Array, minCodeSize: number): number[] {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = eoiCode + 1;
  let dict = new Map<number, number>();
  const out: number[] = [];
  let cur = 0;
  let curBits = 0;
  const emit = (code: number) => {
    cur |= code << curBits;
    curBits += codeSize;
    while (curBits >= 8) {
      out.push(cur & 0xff);
      cur >>>= 8;
      curBits -= 8;
    }
  };

  emit(clearCode);
  if (indices.length === 0) {
    emit(eoiCode);
    if (curBits > 0) out.push(cur & 0xff);
    return out;
  }
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = (prefix << 8) | k;
    const found = dict.get(key);
    if (found !== undefined) {
      prefix = found;
      continue;
    }
    emit(prefix);
    if (nextCode === 4096) {
      emit(clearCode);
      dict = new Map();
      codeSize = minCodeSize + 1;
      nextCode = eoiCode + 1;
    } else {
      if (nextCode >= 1 << codeSize) codeSize++;
      dict.set(key, nextCode++);
    }
    prefix = k;
  }
  emit(prefix);
  emit(eoiCode);
  if (curBits > 0) out.push(cur & 0xff);
  return out;
}

export function encodeGif(opts: GifOptions): Uint8Array {
  const { width, height, frames, delayCs, loop } = opts;
  // 팔레트 크기를 2의 거듭제곱으로 맞춤
  let bits = 1;
  while (1 << bits < opts.palette.length) bits++;
  const size = 1 << bits;
  const palette = [...opts.palette];
  while (palette.length < size) palette.push([0, 0, 0]);
  const minCodeSize = Math.max(2, bits);

  const w = new ByteWriter();
  w.str('GIF89a');
  w.word(width);
  w.word(height);
  w.byte(0x80 | ((bits - 1) << 4) | (bits - 1)); // 전역 색상표 있음
  w.byte(0); // 배경색 인덱스
  w.byte(0); // 픽셀 비율
  for (const [r, g, b] of palette) {
    w.byte(r);
    w.byte(g);
    w.byte(b);
  }
  if (loop) {
    // NETSCAPE2.0 반복 확장
    w.byte(0x21);
    w.byte(0xff);
    w.byte(11);
    w.str('NETSCAPE2.0');
    w.byte(3);
    w.byte(1);
    w.word(0); // 0 = 무한 반복
    w.byte(0);
  }
  for (const frame of frames) {
    // 그래픽 제어 확장 (프레임 시간)
    w.byte(0x21);
    w.byte(0xf9);
    w.byte(4);
    w.byte(0x04); // disposal: 그대로 두기
    w.word(delayCs);
    w.byte(0);
    w.byte(0);
    // 이미지 설명자
    w.byte(0x2c);
    w.word(0);
    w.word(0);
    w.word(width);
    w.word(height);
    w.byte(0);
    // 이미지 데이터
    w.byte(minCodeSize);
    const data = lzwEncode(frame, minCodeSize);
    for (let i = 0; i < data.length; i += 255) {
      const chunk = data.slice(i, i + 255);
      w.byte(chunk.length);
      w.bytes(chunk);
    }
    w.byte(0);
  }
  w.byte(0x3b);
  return w.out();
}
