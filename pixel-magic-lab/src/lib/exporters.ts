import type { Grid } from '../engine/types';
import { PALETTE, colorHex } from '../engine/palette';
import { encodeGif, type RGB } from './gif';

// ─────────────────────────────────────────────
// 작품 내보내기: PNG, 스프라이트 시트 PNG, 움직이는 GIF
// ─────────────────────────────────────────────

export const BG_HEX = '#fff8ec';

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** 파일 이름에 쓸 수 없는 글자를 정리 */
export function safeFileName(name: string, fallback = '픽셀작품'): string {
  const n = name.trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_').slice(0, 40);
  return n || fallback;
}

/** 출력 이미지에서 픽셀 한 칸의 크기 (긴 변이 약 320px 이 되도록) */
export function exportScale(width: number, height: number): number {
  return Math.max(8, Math.floor(320 / Math.max(width, height)));
}

export function drawGrid(ctx: CanvasRenderingContext2D, grid: Grid, width: number, height: number, scale: number, ox = 0, oy = 0, transparent = false) {
  if (!transparent) {
    ctx.fillStyle = BG_HEX;
    ctx.fillRect(ox, oy, width * scale, height * scale);
  }
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const c = grid[y * width + x];
      if (!c) continue;
      ctx.fillStyle = colorHex(c);
      ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
    }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('이미지를 만들지 못했어요'))), 'image/png');
  });
}

export async function exportPng(grid: Grid, width: number, height: number, name: string, transparent = false) {
  const scale = exportScale(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  drawGrid(ctx, grid, width, height, scale, 0, 0, transparent);
  const blob = await canvasToBlob(canvas);
  downloadBlob(blob, `${safeFileName(name)}.png`);
}

/** 모든 프레임을 가로로 이어 붙인 스프라이트 시트 PNG */
export async function exportSpriteSheet(frames: Grid[], width: number, height: number, name: string) {
  const scale = Math.max(4, Math.floor(160 / Math.max(width, height)));
  const gap = scale;
  const canvas = document.createElement('canvas');
  canvas.width = frames.length * width * scale + (frames.length + 1) * gap;
  canvas.height = height * scale + gap * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.fillStyle = '#e9e1f5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  frames.forEach((g, i) => drawGrid(ctx, g, width, height, scale, gap + i * (width * scale + gap), gap));
  const blob = await canvasToBlob(canvas);
  downloadBlob(blob, `${safeFileName(name, '픽셀애니메이션')}_스프라이트.png`);
}

/** 프레임 격자 → GIF 바이트 (테스트에서도 사용) */
export function buildGif(frames: Grid[], width: number, height: number, fps: number, loop: boolean, scale = exportScale(width, height)): Uint8Array {
  const palette: RGB[] = [hexToRgb(BG_HEX), ...PALETTE.map((c) => hexToRgb(c.hex))];
  const indexOf = new Map(PALETTE.map((c, i) => [c.key, i + 1]));
  const W = width * scale;
  const H = height * scale;
  const out = frames.map((g) => {
    const px = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      const gy = Math.floor(y / scale);
      for (let x = 0; x < W; x++) {
        const c = g[gy * width + Math.floor(x / scale)];
        px[y * W + x] = c ? (indexOf.get(c) ?? 0) : 0;
      }
    }
    return px;
  });
  return encodeGif({ width: W, height: H, palette, frames: out, delayCs: Math.max(2, Math.round(100 / fps)), loop });
}

export function exportGif(frames: Grid[], width: number, height: number, fps: number, loop: boolean, name: string) {
  const bytes = buildGif(frames, width, height, fps, loop);
  downloadBlob(new Blob([bytes as BlobPart], { type: 'image/gif' }), `${safeFileName(name, '픽셀애니메이션')}.gif`);
}
