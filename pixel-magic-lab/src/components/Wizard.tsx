import type { ReactNode } from 'react';

// ─────────────────────────────────────────────
// 픽셀 마법사 (연구소의 안내 캐릭터)
// 16×16 픽셀 그림을 SVG 사각형으로 그려요. 표정은 눈·입 줄만 바꿔요.
//   idle 기본 · happy 성공(눈웃음, 활짝) · oops 실수(동그란 입, 땀방울)
// 움직임은 표정이 바뀔 때 한 번만 (기쁨: 깡충, 앗: 갸우뚱). 움직임 줄이기 설정을 따라요.
// ─────────────────────────────────────────────

export type WizardMood = 'idle' | 'happy' | 'oops';

const COLORS: Record<string, string> = {
  K: '#26225a', // 테두리
  H: '#6447e8', // 모자
  h: '#4c31cc', // 모자 그늘
  Y: '#ffc23d', // 별
  S: '#ffdcc0', // 얼굴
  C: '#f78fb3', // 볼
  R: '#3d8de0', // 옷
  r: '#2a6cba', // 옷 그늘
  W: '#9a6440', // 지팡이
  D: '#7cc3f0', // 땀방울
};

const BASE = [
  '.......K........',
  '......KYK.......',
  '......KHK.......',
  '.....KHHHK......',
  '.....KHYHK......',
  '....KHHHHHK.....',
  '....KHhHHHHK....',
  '..KKKKKKKKKKKK..',
  '...KSSSSSSSSK...',
  '...KSKSSSSKSK.Y.',
  '...KCSSSSSSCKYYY',
  '...KSSSKKSSSK.Y.',
  '....KKSSSSKK.W..',
  '...KRRRRRRRSW...',
  '...KRrRRRRrRK...',
  '...KKKKKKKKKK...',
];

/** 표정별로 바꿀 줄 */
const FACES: Record<WizardMood, Partial<Record<number, string>>> = {
  idle: {},
  happy: {
    8: '...KSKSSSSKSK...', // 눈이 위로 휘어요 (눈웃음)
    9: '...KKSKSSKSKK.Y.',
    11: '...KSSKKKKSSK.Y.', // 활짝 웃는 입
  },
  oops: {
    8: '...KSSSSSSSSKD..', // 땀방울
    9: '...KSKSSSSKSKDY.',
    12: '....KKSKKSKK.W..', // 입이 동그랗게 벌어져요 (2×2)
  },
};

function spriteRows(mood: WizardMood): string[] {
  const face = FACES[mood];
  return BASE.map((row, y) => face[y] ?? row);
}

export function WizardSprite({ mood = 'idle', size = 64 }: { mood?: WizardMood; size?: number }) {
  const rows = spriteRows(mood);
  const rects: ReactNode[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = COLORS[row[x]];
      // key 는 칸의 좌표 (그림 안에서 절대 겹치지 않아요)
      // oxlint-disable-next-line react/no-array-index-key
      if (c) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={c} />);
    }
  });
  return (
    <svg className={'wizard-sprite mood-' + mood} width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden>
      {rects}
    </svg>
  );
}

interface GuideProps {
  mood?: WizardMood;
  children: ReactNode;
  /** 화면 읽기 프로그램에 바뀐 말을 읽어 줄지 */
  live?: boolean;
  size?: number;
  className?: string;
}

/** 마법사가 말풍선으로 말해요 */
export function WizardGuide({ mood = 'idle', children, live = false, size = 64, className = '' }: GuideProps) {
  return (
    <div className={'wizard-guide ' + className}>
      {/* key 로 표정이 바뀔 때마다 움직임을 한 번 다시 재생 */}
      <span className="wizard-avatar" key={mood}>
        <WizardSprite mood={mood} size={size} />
      </span>
      <div className={'wizard-bubble bubble-' + mood} aria-live={live ? 'polite' : undefined}>
        {children}
      </div>
    </div>
  );
}
