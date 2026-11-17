import type { ColorKey } from './types';

export interface PaletteColor {
  key: ColorKey;
  name: string;
  hex: string;
  /** 글자/아이콘을 올릴 때 쓸 대비 색 */
  ink: string;
}

/** 아이들이 구분하기 쉬운 12가지 마법 물감 (파스텔 톤이지만 서로 잘 구분되게) */
export const PALETTE: PaletteColor[] = [
  { key: 'R', name: '빨강', hex: '#ef6f6c', ink: '#fff' },
  { key: 'O', name: '주황', hex: '#f6a35b', ink: '#4a3226' },
  { key: 'Y', name: '노랑', hex: '#ffd85e', ink: '#4a3226' },
  { key: 'G', name: '초록', hex: '#76c47b', ink: '#20381f' },
  { key: 'M', name: '민트', hex: '#7fd8c8', ink: '#1f4a43' },
  { key: 'S', name: '하늘', hex: '#7cc3f0', ink: '#1d3c52' },
  { key: 'B', name: '파랑', hex: '#5a7fd6', ink: '#fff' },
  { key: 'P', name: '보라', hex: '#a68be0', ink: '#fff' },
  { key: 'K', name: '분홍', hex: '#f59cc1', ink: '#4a2236' },
  { key: 'N', name: '갈색', hex: '#a9744f', ink: '#fff' },
  { key: 'D', name: '검정', hex: '#4a3a33', ink: '#fff' },
  { key: 'W', name: '흰색', hex: '#ffffff', ink: '#4a3226' },
];

export const DEFAULT_PEN_COLOR: ColorKey = 'P';

const byKey = new Map(PALETTE.map((c) => [c.key, c]));

export function colorInfo(key: ColorKey | null | undefined): PaletteColor | undefined {
  return key ? byKey.get(key) : undefined;
}

export function colorHex(key: ColorKey | null | undefined): string {
  return colorInfo(key)?.hex ?? 'transparent';
}

export function colorName(key: ColorKey | null | undefined): string {
  return colorInfo(key)?.name ?? '빈칸';
}

export function isColorKey(key: string): boolean {
  return byKey.has(key);
}
