import type { BlockKind, Grid } from '../engine/types';
import { gridFromRows } from '../engine/interpreter';

export type Difficulty = 'easy' | 'normal' | 'challenge';

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: '쉬움',
  normal: '보통',
  challenge: '도전',
};

export const DIFFICULTY_GRADE: Record<Difficulty, string> = {
  easy: '1~2학년',
  normal: '3~4학년',
  challenge: '5~6학년',
};

export interface Concept {
  title: string;
  text: string;
}

export interface MissionDef {
  id: number;
  title: string;
  difficulty: Difficulty;
  /** 핵심 학습 */
  learn: string;
  /** 미션 설명 (아이 눈높이) */
  story: string;
  rows: string[];
  blocks: BlockKind[];
  /** 정답 예시 코드 (테스트로 실제 실행해 검증합니다) */
  solution: string;
  /** 처음부터 들어 있는 코드 (디버깅 미션) */
  starter?: string;
  hints: string[];
  /** 처음 열 때 보여 주는 새 개념 소개 */
  concept?: Concept;
}

const MOVES: BlockKind[] = ['up', 'down', 'left', 'right'];
const BASIC: BlockKind[] = [...MOVES, 'paint', 'color'];
const LOOPS: BlockKind[] = [...BASIC, 'repeat'];
const ALL: BlockKind[] = [...LOOPS, 'erase'];

export const MISSIONS: MissionDef[] = [
  {
    id: 1,
    title: '첫 번째 마법 점',
    difficulty: 'easy',
    learn: '색칠 명령',
    story: '마법 펜을 도화지 한가운데로 옮겨서 보라색 점을 하나 콕 찍어 보세요.',
    rows: ['.....', '.....', '..P..', '.....', '.....'],
    blocks: ['right', 'down', 'paint'],
    solution: 'R R D D paint',
    hints: [
      '마법 펜은 왼쪽 위 칸 (0,0)에서 출발해요.',
      '오른쪽으로 2칸, 아래로 2칸 가면 한가운데예요.',
      '도착한 다음 [색칠하기] 블록을 넣어야 칸이 칠해져요!',
    ],
    concept: {
      title: '색칠하기 마법',
      text: '이동 블록은 펜만 움직여요. [색칠하기] 블록을 실행해야 펜이 있는 칸에 색이 칠해져요.',
    },
  },
  {
    id: 2,
    title: '반짝이는 가로줄',
    difficulty: 'easy',
    learn: '이동과 순서',
    story: '두 번째 줄을 왼쪽 끝부터 오른쪽 끝까지 보라색으로 칠해 보세요.',
    rows: ['.....', 'PPPPP', '.....', '.....', '.....'],
    blocks: [...MOVES, 'paint'],
    solution: 'D paint R paint R paint R paint R paint',
    hints: [
      '먼저 아래로 1칸 내려가요.',
      '[색칠하기] → [오른쪽] → [색칠하기] → … 순서로 번갈아 놓아요.',
      '마지막 칸에서는 오른쪽으로 더 가지 않아도 돼요.',
    ],
    concept: {
      title: '순서대로 실행',
      text: '블록은 위에서 아래로 하나씩 차례대로 실행돼요. 순서가 바뀌면 그림도 달라져요!',
    },
  },
  {
    id: 3,
    title: '알록달록 계단',
    difficulty: 'easy',
    learn: '방향 명령',
    story: '한 계단마다 색이 바뀌는 무지개 계단을 만들어요. 아래로, 오른쪽으로!',
    rows: ['R....', 'RO...', '.OY..', '..YG.', '...G.'],
    blocks: [...MOVES, 'paint', 'color'],
    solution: 'color:R paint D paint R color:O paint D paint R color:Y paint D paint R color:G paint D paint',
    hints: [
      '[색 바꾸기] 블록으로 펜의 물감을 먼저 고른 다음 칠해요.',
      '한 계단은 "칠하기 → 아래 → 칠하기 → 오른쪽"이에요.',
      '계단마다 빨강 → 주황 → 노랑 → 초록으로 색을 바꿔요.',
    ],
    concept: {
      title: '색 바꾸기 마법',
      text: '[색 바꾸기] 블록에서 동그라미를 눌러 물감을 고를 수 있어요. 그 뒤로 칠하는 칸은 모두 그 색이 돼요.',
    },
  },
  {
    id: 4,
    title: '네모난 마법 창문',
    difficulty: 'easy',
    learn: '이동과 패턴',
    story: '하늘색 테두리 창문을 만들어요. 가운데 칸은 비워 두어야 해요.',
    rows: ['.....', '.SSS.', '.S.S.', '.SSS.', '.....'],
    blocks: [...MOVES, 'paint', 'color'],
    solution: 'R D color:S paint R paint R paint D paint D paint L paint L paint U paint',
    hints: [
      '창문은 (1,1) 칸에서 시작해요.',
      '오른쪽 → 아래 → 왼쪽 → 위 순서로 한 바퀴 돌아요.',
      '"칠하기 + 이동"이 계속 되풀이되는 것을 찾아보세요. 다음 미션에서 쓸모가 있어요!',
    ],
  },
  {
    id: 5,
    title: '하트 만들기',
    difficulty: 'easy',
    learn: '좌표와 색칠',
    story: '분홍 하트를 그려요. 칠할 칸의 좌표: (1,1) (3,1) (1,2) (2,2) (3,2) (2,3)',
    rows: ['.....', '.K.K.', '.KKK.', '..K..', '.....'],
    blocks: [...MOVES, 'paint', 'color'],
    solution: 'color:K R D paint R R paint D paint L paint L paint D R paint',
    hints: [
      '좌표 (가로, 세로)에서 앞 숫자는 오른쪽으로 몇 칸, 뒤 숫자는 아래로 몇 칸이에요.',
      '도화지 위쪽과 왼쪽의 숫자를 보면 좌표를 찾기 쉬워요.',
      '먼저 분홍으로 색을 바꾸고, (1,1) → (3,1) → (3,2) → (2,2) → (1,2) → (2,3) 순서로 가 보세요.',
    ],
    concept: {
      title: '좌표 읽기',
      text: '칸의 위치는 (가로, 세로)로 말해요. (2,3)은 오른쪽으로 2칸, 아래로 3칸 간 곳이에요.',
    },
  },
  {
    id: 6,
    title: '반복되는 무지개',
    difficulty: 'normal',
    learn: '반복문',
    story: '줄마다 색이 다른 무지개 깃발! 같은 동작은 [반복하기]로 짧게 만들어요.',
    rows: ['RRRRRRR', 'OOOOOOO', 'YYYYYYY', 'GGGGGGG', 'SSSSSSS'],
    blocks: [...BASIC, 'repeat'],
    solution:
      'color:R repeat:6[paint R] paint D color:O repeat:6[paint L] paint D color:Y repeat:6[paint R] paint D color:G repeat:6[paint L] paint D color:S repeat:6[paint R] paint',
    hints: [
      '[반복하기] 블록 안에 [색칠하기]와 [오른쪽]을 넣어 보세요.',
      '한 줄은 7칸이에요. "칠하고 옮기기"를 6번 반복하고, 마지막 칸은 한 번 더 칠해요.',
      '다음 줄은 반대 방향(왼쪽)으로 가면 되돌아갈 필요가 없어요!',
    ],
    concept: {
      title: '반복하기 마법',
      text: '[반복하기] 블록 안에 넣은 블록들은 정해진 횟수만큼 되풀이돼요. 같은 블록을 여러 번 놓지 않아도 돼요!',
    },
  },
  {
    id: 7,
    title: '마법사의 꽃',
    difficulty: 'normal',
    learn: '반복과 패턴',
    story: '노란 꽃술에 분홍 꽃잎, 초록 줄기와 잎을 가진 꽃을 피워요.',
    rows: ['..K..', '.KYK.', '..K..', '..G..', '.GGG.', '..G..', '..G..'],
    blocks: [...BASIC, 'repeat'],
    solution: 'R R color:K paint D L paint R color:Y paint R color:K paint L D paint color:G repeat:4[D paint] U U L paint R R paint',
    hints: [
      '꽃잎 4장과 꽃술부터 그려요. 꽃술은 노랑이에요.',
      '줄기는 같은 동작이 4번 되풀이돼요: [아래] → [색칠하기].',
      '줄기를 다 그린 뒤 위로 올라가서 양쪽 잎을 칠해요.',
    ],
  },
  {
    id: 8,
    title: '별빛 장식',
    difficulty: 'normal',
    learn: '효율적인 명령',
    story: '지그재그 별빛 장식! 되풀이되는 묶음을 찾으면 아주 짧은 코드로 만들 수 있어요.',
    rows: ['.......', 'Y.Y.Y.Y', '.Y.Y.Y.', '.......'],
    blocks: [...BASIC, 'repeat'],
    solution: 'D color:Y repeat:3[paint D R paint U R] paint',
    hints: [
      '별 두 개(위 하나, 아래 하나)가 한 묶음이에요.',
      '한 묶음: 칠하기 → 아래 → 오른쪽 → 칠하기 → 위 → 오른쪽',
      '그 묶음을 3번 반복하고 마지막 별 하나를 더 칠하면 블록 10개로 끝나요!',
    ],
    concept: {
      title: '효율적인 알고리즘',
      text: '같은 그림도 더 적은 블록으로 만들 수 있어요. 되풀이되는 "묶음"을 찾는 것이 효율의 비밀이에요.',
    },
  },
  {
    id: 9,
    title: '귀여운 버섯',
    difficulty: 'normal',
    learn: '색 변경과 반복',
    story: '하얀 점이 콕콕 박힌 빨간 버섯을 만들어요. 색을 바꿨다가 다시 돌아오는 걸 잊지 마세요.',
    rows: ['..RRR..', '.RRWRR.', 'RWRRRWR', 'RRRRRRR', '..WWW..', '..WWW..'],
    blocks: [...BASIC, 'repeat'],
    solution:
      'color:R R R repeat:2[paint R] paint ' +
      'D R paint L paint L color:W paint color:R L paint L paint ' +
      'D L paint R color:W paint color:R R repeat:3[paint R] color:W paint color:R R paint ' +
      'D repeat:6[paint L] paint ' +
      'D R R color:W repeat:2[paint R] paint ' +
      'D repeat:2[paint L] paint',
    hints: [
      '한 줄씩 지그재그로 내려오면 이동이 적어요.',
      '흰 점을 칠한 다음에는 [색 바꾸기]로 다시 빨강으로 돌아와야 해요.',
      '버섯 기둥은 가로 3칸이 2줄이에요. 반복을 써 보세요.',
    ],
  },
  {
    id: 10,
    title: '마법사의 시험',
    difficulty: 'challenge',
    learn: '종합 미션',
    story: '노란 별이 달린 보라 마법사 모자를 그려요. 지금까지 배운 모든 마법을 써 보세요!',
    rows: ['....P...', '...PP...', '...PPP..', '..PPYP..', '..PPPPP.', '.PPPPPP.', 'NNNNNNNN', '........'],
    blocks: ALL,
    solution:
      'repeat:4[R] paint ' +
      'D L paint R paint ' +
      'D L repeat:2[paint R] paint ' +
      'D paint L color:Y paint color:P L paint L paint ' +
      'D repeat:4[paint R] paint ' +
      'D repeat:5[paint L] paint ' +
      'D L color:N repeat:7[paint R] paint',
    hints: [
      '펜은 처음부터 보라색이에요. 꼭대기 (4,0)부터 시작해 보세요.',
      '한 줄씩 내려오며 지그재그로 칠하면 이동이 줄어요.',
      '모자의 챙(갈색)은 한 줄 전체예요. [반복하기]로 한 번에!',
    ],
  },
  {
    id: 11,
    title: '고장 난 마법 주문',
    difficulty: 'challenge',
    learn: '디버깅',
    story: '누군가 파란 액자 주문을 적었는데 마법이 고장 났어요! 주문을 실행해 보고 틀린 곳을 고쳐 주세요.',
    rows: ['BBBBB', 'B...B', 'B...B', 'B...B', 'BBBBB'],
    blocks: ALL,
    starter: 'color:B repeat:5[paint R] repeat:4[paint D] repeat:4[paint R] repeat:4[paint U]',
    solution: 'color:B repeat:4[paint R] repeat:4[paint D] repeat:4[paint L] repeat:4[paint U]',
    hints: [
      '먼저 [한 단계] 버튼으로 천천히 실행하며 펜이 어디서 멈추는지 보세요.',
      '도화지는 5칸이에요. 오른쪽으로 5번 가면 어떻게 될까요?',
      '버그는 2개! 첫 번째 반복 횟수와, 세 번째 반복의 방향을 살펴보세요.',
    ],
    concept: {
      title: '디버깅 탐정',
      text: '코드 속 실수(버그)를 찾아 고치는 것을 디버깅이라고 해요. 한 단계씩 실행하며 펜을 따라가 보세요.',
    },
  },
  {
    id: 12,
    title: '체크무늬 마법진',
    difficulty: 'challenge',
    learn: '중첩 반복',
    story: '분홍 체크무늬 마법진! 반복 안에 반복을 넣어 짧고 멋진 주문을 만들어요.',
    rows: ['K.K.K.', '.K.K.K', 'K.K.K.', '.K.K.K', '......'],
    blocks: ALL,
    solution: 'color:K repeat:2[paint repeat:2[R R paint] D R paint repeat:2[L L paint] D L]',
    hints: [
      '한 줄에 별이 3개: 칠하기 → (오른쪽 2칸 → 칠하기)를 2번.',
      '두 줄이 한 묶음이에요. 첫 줄은 오른쪽으로, 둘째 줄은 왼쪽으로 가요.',
      '두 줄 묶음 전체를 [반복하기 2번] 안에 넣어 보세요. 반복 안에 반복!',
    ],
    concept: {
      title: '반복 안의 반복',
      text: '[반복하기] 안에 또 [반복하기]를 넣을 수 있어요. 바깥 반복이 한 번 돌 때마다 안쪽 반복이 처음부터 다시 돌아요.',
    },
  },
];

export interface MissionData extends MissionDef {
  width: number;
  height: number;
  target: Grid;
}

export const MISSION_DATA: MissionData[] = MISSIONS.map((m) => {
  const g = gridFromRows(m.rows);
  return { ...m, width: g.width, height: g.height, target: g.grid };
});

export function getMission(id: number): MissionData {
  return MISSION_DATA.find((m) => m.id === id) ?? MISSION_DATA[0];
}

/** 별 개수: 성공 1개, 블록 수가 정답 예시의 1.5배 이하 2개, 정답 예시 이하 3개 */
export function starsFor(blocksUsed: number, par: number): number {
  if (blocksUsed <= par) return 3;
  if (blocksUsed <= Math.ceil(par * 1.5)) return 2;
  return 1;
}

export const TITLES: { min: number; name: string }[] = [
  { min: 0, name: '꼬마 견습 마법사' },
  { min: 4, name: '반짝 픽셀 마법사' },
  { min: 12, name: '반복 주문 마법사' },
  { min: 22, name: '무지개 대마법사' },
  { min: 33, name: '전설의 픽셀 현자' },
];

export function titleFor(stars: number): string {
  let t = TITLES[0].name;
  for (const x of TITLES) if (stars >= x.min) t = x.name;
  return t;
}
