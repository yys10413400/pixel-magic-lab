import type { BlockKind, Grid } from '../engine/types';
import { gridFromRows } from '../engine/interpreter';

// ─────────────────────────────────────────────
// 미션 24개 — 학년마다 8개, 다섯 장
//   1장 첫 마법      (쉬움 · 1~2학년)  순서 · 이동 · 색칠 · 색 바꾸기 · 다음 색으로 · 좌표 · 고치기
//   2장 반복 마법    (보통 · 3~4학년)  반복 · 패턴
//   3장 펜 마법      (보통 · 3~4학년)  펜 내리기 · 펜 올리기 · 되감기로 고치기
//   4장 생각하는 마법 (도전 · 5~6학년)  반복 안의 반복 · 만약 · 만약~아니면 · 되감기로 고치기
//   5장 나만의 마법  (도전 · 5~6학년)  나만의 블록 · 졸업 시험
// 각 장은 "새 개념 만나기 → 연습 → 응용 → 고치기" 흐름이에요.
// 정답 예시(solution)는 테스트가 실제로 실행해서 목표 그림과 같은지 확인해요.
// 펜은 언제나 왼쪽 위 (0,0)에서 보라색으로 출발해요.
// ─────────────────────────────────────────────

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
  /** 개념을 보여 주는 작은 픽셀 그림 */
  art?: string[];
}

export interface MissionDef {
  id: number;
  /** 몇 장에 속하는지 (미션 지도 묶음) */
  chapter: number;
  title: string;
  difficulty: Difficulty;
  /** 핵심 학습 */
  learn: string;
  /** 미션 설명 (아이 눈높이) */
  story: string;
  /** 목표 그림 ('.' 빈칸) */
  rows: string[];
  /** 처음부터 도화지에 칠해져 있는 그림 (만약 미션) */
  baseRows?: string[];
  blocks: BlockKind[];
  /** 정답 예시 코드 (테스트로 실제 실행해 검증합니다) */
  solution: string;
  /** 처음부터 들어 있는 고장 난 코드 (고치기 미션) */
  starter?: string;
  hints: string[];
  /** 처음 열 때 보여 주는 새 개념 소개 */
  concept?: Concept;
}

export const CHAPTERS: { id: number; title: string; difficulty: Difficulty; learn: string }[] = [
  { id: 1, title: '1장 첫 마법', difficulty: 'easy', learn: '순서 · 이동 · 색칠 · 색 바꾸기' },
  { id: 2, title: '2장 반복 마법', difficulty: 'normal', learn: '반복 · 패턴' },
  { id: 3, title: '3장 펜 마법', difficulty: 'normal', learn: '펜 내리기 · 펜 올리기 · 되감기' },
  { id: 4, title: '4장 생각하는 마법', difficulty: 'challenge', learn: '반복 안의 반복 · 만약' },
  { id: 5, title: '5장 나만의 마법', difficulty: 'challenge', learn: '나만의 블록 · 종합' },
];

const MOVES: BlockKind[] = ['up', 'down', 'left', 'right'];
const DRAW: BlockKind[] = [...MOVES, 'paint', 'color'];

export const MISSIONS: MissionDef[] = [
  // ── 1장 첫 마법 (쉬움 · 1~2학년) ──
  {
    id: 1,
    chapter: 1,
    title: '첫 번째 마법 점',
    difficulty: 'easy',
    learn: '이동과 색칠',
    story: '마법 펜을 도화지 한가운데로 옮겨서 보라색 점을 콕 찍어 보세요.',
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
      art: ['...', '.P.', '...'],
    },
  },
  {
    id: 2,
    chapter: 1,
    title: '반짝 가로줄',
    difficulty: 'easy',
    learn: '순서대로',
    story: '둘째 줄을 처음부터 끝까지 보라색으로 칠해서 반짝이는 줄을 만들어요.',
    rows: ['.....', 'PPPPP', '.....'],
    blocks: ['right', 'down', 'paint'],
    solution: 'D paint R paint R paint R paint R paint',
    hints: ['먼저 아래로 1칸 내려가요.', '[색칠하기] → [오른쪽]을 차례로 되풀이해요.', '마지막 칸에서는 오른쪽으로 가지 않고 색칠만 해요.'],
  },
  {
    id: 3,
    chapter: 1,
    title: '신호등',
    difficulty: 'easy',
    learn: '색 바꾸기',
    story: '빨강, 노랑, 초록 신호등을 위에서부터 차례로 켜 보세요.',
    rows: ['.R.', '.Y.', '.G.'],
    blocks: ['right', 'down', 'paint', 'color'],
    solution: 'R color:R paint D color:Y paint D color:G paint',
    hints: [
      '신호등은 가운데 줄에 있어요. 오른쪽으로 1칸 가요.',
      '칠하기 전에 [색 바꾸기]로 빨강을 골라요.',
      '빨강 칠하기 → 아래로 → 노랑으로 바꾸고 칠하기 → 아래로 → 초록!',
    ],
    concept: {
      title: '색 바꾸기 마법',
      text: '[색 바꾸기] 블록을 실행하면 그다음부터 칠하는 색이 바뀌어요. 펜은 처음에 보라색이에요.',
      art: ['R', 'Y', 'G'],
    },
  },
  {
    id: 4,
    chapter: 1,
    title: '계단 오르기',
    difficulty: 'easy',
    learn: '방향 바꾸기',
    story: '주황색 계단을 만들어요. 아래로 한 칸, 오른쪽으로 한 칸씩 번갈아 내려가요.',
    rows: ['O...', 'OO..', '.OO.', '..OO'],
    blocks: ['right', 'down', 'paint', 'color'],
    solution: 'color:O paint D paint R paint D paint R paint D paint R paint',
    hints: [
      '주황으로 바꾸고 출발 칸부터 칠해요.',
      '아래 → 칠하기 → 오른쪽 → 칠하기를 되풀이해요.',
      '[한 단계]를 눌러 칠한 칸이 계단처럼 이어지는지 확인해 봐요.',
    ],
  },
  {
    id: 5,
    chapter: 1,
    title: '꽃 한 송이',
    difficulty: 'easy',
    learn: '색 여러 번 바꾸기',
    story: '분홍 꽃잎 네 장, 노란 꽃술, 초록 줄기로 꽃 한 송이를 피워요.',
    rows: ['.K.', 'KYK', '.K.', '.G.', '.G.'],
    blocks: DRAW,
    solution: 'color:K R paint D L paint R R paint D L paint U color:Y paint D D color:G paint D paint',
    hints: [
      '꽃잎 4장을 먼저 분홍으로 칠하고, 가운데는 나중에 노랑으로 칠하면 색을 덜 바꿔도 돼요.',
      '꽃잎 순서: 위 (1,0) → 왼쪽 (0,1) → 오른쪽 (2,1) → 아래 (1,2).',
      '가운데 (1,1)은 노랑, 줄기 (1,3) (1,4)는 초록이에요.',
    ],
  },
  {
    id: 6,
    chapter: 1,
    title: '무지개 줄',
    difficulty: 'easy',
    learn: '다음 색으로',
    story: '[다음 색으로] 블록으로 빨 주 노 초 하늘, 무지개 줄을 그려요.',
    rows: ['.....', 'ROYGS', '.....'],
    blocks: ['right', 'down', 'paint', 'next'],
    solution: 'D next paint R next paint R next paint R next paint R next paint',
    hints: [
      '펜은 보라색에서 출발해요. [다음 색으로]를 한 번 쓰면 빨강이 돼요.',
      '[다음 색으로] → [색칠하기] → [오른쪽]을 되풀이해요.',
      '마지막 칸에서는 오른쪽으로 가지 않아요.',
    ],
    concept: {
      title: '다음 색으로',
      text: '[다음 색으로]를 실행하면 펜 색이 무지개 순서로 한 칸 바뀌어요. 빨강 → 주황 → 노랑 → 초록 → 하늘 → 파랑 → 보라 → 다시 빨강!',
      art: ['ROYGSBP'],
    },
  },
  {
    id: 7,
    chapter: 1,
    title: '하트 만들기',
    difficulty: 'easy',
    learn: '좌표',
    story: '분홍 하트를 그려요. 칠할 칸의 좌표: (1,1) (3,1) (1,2) (2,2) (3,2) (2,3)',
    rows: ['.....', '.K.K.', '.KKK.', '..K..', '.....'],
    blocks: DRAW,
    solution: 'color:K R D paint R R paint D paint L paint L paint D R paint',
    hints: [
      '좌표 (가로, 세로)에서 앞 숫자는 오른쪽으로 몇 칸, 뒤 숫자는 아래로 몇 칸이에요.',
      '도화지 위쪽과 왼쪽의 숫자를 보면 좌표를 찾기 쉬워요.',
      '먼저 분홍으로 바꾸고 (1,1) → (3,1) → (3,2) → (2,2) → (1,2) → (2,3) 순서로 가 보세요.',
    ],
    concept: {
      title: '좌표 읽기',
      text: '칸의 위치는 (가로, 세로)로 말해요. (2,3)은 오른쪽으로 2칸, 아래로 3칸 간 곳이에요.',
      art: ['.K.K.', '.KKK.', '..K..'],
    },
  },
  {
    id: 8,
    chapter: 1,
    title: '고장 난 집',
    difficulty: 'easy',
    learn: '고치기',
    story: '마법사의 집 주문이 고장 났어요! 지붕은 빨강, 벽은 노랑이어야 해요. 틀린 곳 두 군데를 찾아 고쳐요.',
    rows: ['..R..', '.RRR.', '.Y.Y.', '.YYY.'],
    blocks: DRAW,
    solution: 'R R color:R paint D L paint R paint R paint D color:Y paint L L paint D paint R paint R paint',
    starter: 'R R color:R paint D L paint R paint R paint D paint L paint D paint R paint R paint',
    hints: [
      '먼저 [실행하기]를 누르고 목표 그림과 다른 칸을 찾아봐요.',
      '벽을 칠하기 전에 색을 바꾸는 블록이 빠졌어요.',
      '벽 왼쪽 칸 (1,2)로 가려면 왼쪽으로 몇 칸 가야 할까요?',
    ],
  },

  // ── 2장 반복 마법 (보통 · 3~4학년) ──
  {
    id: 9,
    chapter: 2,
    title: '반짝이 띠',
    difficulty: 'normal',
    learn: '반복',
    story: '노란 띠 8칸을 칠해요. [반복하기]를 쓰면 블록 5개로도 할 수 있어요!',
    rows: ['YYYYYYYY'],
    blocks: ['right', 'paint', 'color', 'repeat'],
    solution: 'color:Y repeat:7[paint R] paint',
    hints: [
      '칠하기 → 오른쪽이 7번 되풀이돼요.',
      '[반복하기] 안에 [색칠하기]와 [오른쪽]을 넣고 횟수를 7로 바꿔요.',
      '반복이 끝나면 펜이 마지막 칸에 있어요. 마지막 칸도 칠해야 해요!',
    ],
    concept: {
      title: '반복하기',
      text: '똑같은 블록을 여러 번 쓰는 대신 [N번 반복하기] 안에 넣으면, 안쪽 블록이 N번 되풀이돼요.',
      art: ['YYYYYYYY'],
    },
  },
  {
    id: 10,
    chapter: 2,
    title: '무지개 계단',
    difficulty: 'normal',
    learn: '반복 + 다음 색',
    story: '한 칸씩 내려갈 때마다 색이 바뀌는 무지개 계단! 블록 7개면 충분해요.',
    rows: ['R.....', '.O....', '..Y...', '...G..', '....S.', '.....B'],
    blocks: ['right', 'down', 'paint', 'next', 'repeat'],
    solution: 'next repeat:5[paint R D next] paint',
    hints: [
      '처음에 [다음 색으로]로 빨강을 만들어요.',
      '칠하기 → 오른쪽 → 아래 → 다음 색이 5번 되풀이돼요.',
      '반복이 끝난 뒤 마지막 칸을 한 번 더 칠해요.',
    ],
  },
  {
    id: 11,
    chapter: 2,
    title: '점선 다리',
    difficulty: 'normal',
    learn: '반복 패턴',
    story: '징검다리처럼 한 칸씩 건너뛰며 보라색 점을 찍어요.',
    rows: ['P.P.P.P'],
    blocks: ['right', 'paint', 'repeat'],
    solution: 'repeat:3[paint R R] paint',
    hints: [
      '칠하고, 오른쪽으로 두 칸 가는 게 되풀이돼요.',
      '[반복하기] 안에 [색칠하기] [오른쪽] [오른쪽]을 넣어요.',
      '반복을 3번 하고 마지막 점은 따로 칠해요.',
    ],
  },
  {
    id: 12,
    chapter: 2,
    title: '줄무늬 깃발',
    difficulty: 'normal',
    learn: '반복 여러 개',
    story: '빨강, 주황, 노랑, 초록 줄무늬 깃발을 만들어요. 줄마다 반복을 하나씩 써요.',
    rows: ['RRRRR', 'OOOOO', 'YYYYY', 'GGGGG'],
    blocks: [...DRAW, 'next', 'repeat'],
    solution: 'next repeat:4[paint R] paint D next repeat:4[paint L] paint D next repeat:4[paint R] paint D next repeat:4[paint L] paint',
    hints: [
      '한 줄을 칠하는 반복을 먼저 만들어 보세요.',
      '줄이 바뀔 때마다 [다음 색으로]를 쓰면 빨 주 노 초 순서가 돼요.',
      '둘째 줄은 왼쪽으로, 셋째 줄은 다시 오른쪽으로 가요.',
    ],
  },

  // ── 3장 펜 마법 (보통 · 3~4학년) ──
  {
    id: 13,
    chapter: 3,
    title: '한 붓으로 ㄱ',
    difficulty: 'normal',
    learn: '펜 내리기',
    story: '펜을 내리고 쭉 그으면 지나간 길이 칠해져요. 파란 ㄱ을 한 붓에 그려요.',
    rows: ['BBBBB', '....B', '....B', '....B', '....B'],
    blocks: ['right', 'down', 'paint', 'color', 'penDown', 'repeat'],
    solution: 'color:B pendown repeat:4[R] repeat:4[D]',
    hints: ['파랑으로 바꾸고 [펜 내리기]를 해요.', '오른쪽으로 4칸 가면 윗줄이 칠해져요. [반복하기]를 써 봐요.', '이어서 아래로 4칸!'],
    concept: {
      title: '펜 내리기',
      text: '[펜 내리기]를 하면 지금 칸이 칠해지고, 그다음부터 펜이 지나가는 칸이 모두 칠해져요. 종이에 펜을 대고 긋는 것과 같아요!',
      art: ['BBB', '..B', '..B'],
    },
  },
  {
    id: 14,
    chapter: 3,
    title: '네모 액자',
    difficulty: 'normal',
    learn: '펜 + 반복',
    story: '펜을 내린 채로 한 바퀴 돌면 파란 액자가 완성돼요.',
    rows: ['BBBBBB', 'B....B', 'B....B', 'B....B', 'B....B', 'BBBBBB'],
    blocks: [...DRAW, 'penDown', 'repeat'],
    solution: 'color:B pendown repeat:5[R] repeat:5[D] repeat:5[L] repeat:5[U]',
    hints: ['오른쪽 → 아래 → 왼쪽 → 위 순서로 한 바퀴 돌아요.', '한 변은 5칸씩 움직여요.', '반복을 4개 쓰면 블록 10개로 끝나요.'],
  },
  {
    id: 15,
    chapter: 3,
    title: '쌍둥이 창문',
    difficulty: 'normal',
    learn: '펜 올리기',
    story: '보라색 창문 두 개를 그려요. 두 창문 사이는 칠하면 안 돼요!',
    rows: ['PPP.PPP', 'P.P.P.P', 'PPP.PPP'],
    blocks: [...DRAW, 'penDown', 'penUp', 'repeat'],
    solution:
      'pendown repeat:2[R] repeat:2[D] repeat:2[L] repeat:2[U] penup repeat:4[R] pendown repeat:2[R] repeat:2[D] repeat:2[L] repeat:2[U]',
    hints: [
      '첫 창문은 펜을 내리고 2칸씩 한 바퀴 돌아요.',
      '다음 창문으로 건너갈 때는 [펜 올리기]! 그래야 사이 칸이 칠해지지 않아요.',
      '두 번째 창문은 (4,0)에서 다시 펜을 내리고 시작해요.',
    ],
    concept: {
      title: '펜 올리기',
      text: '[펜 올리기]를 하면 펜이 종이에서 떨어져요. 움직여도 칠해지지 않아서 떨어진 곳으로 건너갈 수 있어요.',
      art: ['PP.PP'],
    },
  },
  {
    id: 16,
    chapter: 3,
    title: '고장 난 ㄷ',
    difficulty: 'normal',
    learn: '되감기로 고치기',
    story: '파란 ㄷ을 그리는 주문이 고장 났어요. 실행한 뒤 [뒤로]를 눌러 한 단계씩 되돌려 보며 틀린 곳을 찾아요.',
    rows: ['BBBB', 'B...', 'B...', 'BBBB'],
    blocks: [...DRAW, 'penDown', 'penUp', 'repeat'],
    solution: 'color:B pendown repeat:3[D] repeat:3[R] penup repeat:3[U] pendown repeat:3[L]',
    starter: 'color:B pendown repeat:3[D] repeat:3[R] repeat:3[U] pendown repeat:2[L]',
    hints: [
      '실행하고 [뒤로]를 눌러 보세요. 오른쪽 세로줄은 언제 칠해졌나요?',
      '위로 올라가기 전에 펜을 들어야 해요.',
      '윗줄은 왼쪽으로 몇 칸 가야 끝까지 칠해질까요?',
    ],
    concept: {
      title: '되감기',
      text: '[◀ 뒤로]를 누르면 실행을 한 단계씩 되돌려요. 그림이 어디서부터 틀어졌는지 거꾸로 따라가며 찾아봐요.',
    },
  },

  // ── 4장 생각하는 마법 (도전 · 5~6학년) ──
  {
    id: 17,
    chapter: 4,
    title: '체크무늬 마법진',
    difficulty: 'challenge',
    learn: '반복 안의 반복',
    story: '분홍 체크무늬 마법진! 반복 안에 반복을 넣어 짧고 멋진 주문을 만들어요.',
    rows: ['K.K.K.', '.K.K.K', 'K.K.K.', '.K.K.K', '......'],
    blocks: [...DRAW, 'repeat'],
    solution: 'color:K repeat:2[paint repeat:2[R R paint] D R paint repeat:2[L L paint] D L]',
    hints: [
      '한 줄에 점이 3개: 칠하기 → (오른쪽 2칸 → 칠하기)를 2번.',
      '두 줄이 한 묶음이에요. 첫 줄은 오른쪽으로, 둘째 줄은 왼쪽으로 가요.',
      '두 줄 묶음 전체를 [반복하기 2번] 안에 넣어 보세요. 반복 안에 반복!',
    ],
    concept: {
      title: '반복 안의 반복',
      text: '[반복하기] 안에 또 [반복하기]를 넣을 수 있어요. 바깥 반복이 한 번 돌 때마다 안쪽 반복이 처음부터 다시 돌아요.',
      art: ['K.K.K.', '.K.K.K', 'K.K.K.'],
    },
  },
  {
    id: 18,
    chapter: 4,
    title: '빈칸만 채우기',
    difficulty: 'challenge',
    learn: '만약 ~라면',
    story: '분홍 칸은 그대로 두고, 빈칸만 노랗게 채워요. 펜이 칸을 살펴보고 스스로 판단하게 해 봐요.',
    rows: ['YKYKKYY'],
    baseRows: ['.K.KK..'],
    blocks: ['right', 'paint', 'color', 'repeat', 'if'],
    solution: 'color:Y if:empty[paint] repeat:6[R if:empty[paint]]',
    hints: [
      '[만약 이 칸이 비어 있으면] 안에 [색칠하기]를 넣으면, 빈칸일 때만 칠해요.',
      '첫 칸을 먼저 살펴본 다음, "오른쪽 → 살펴보기"를 되풀이해요.',
      '반복 안에 [오른쪽]과 [만약] 블록을 함께 넣어요.',
    ],
    concept: {
      title: '만약 ~라면',
      text: '[만약 이 칸이 비어 있으면] 블록은 펜이 있는 칸을 살펴보고, 맞을 때만 안쪽 블록을 실행해요. 같은 주문도 도화지에 따라 다르게 움직여요!',
      art: ['YKYKKYY'],
    },
  },
  {
    id: 19,
    chapter: 4,
    title: '뒤집기 마법',
    difficulty: 'challenge',
    learn: '만약 ~ 아니면',
    story: '도화지의 그림을 반대로 뒤집어요. 빈칸은 칠하고, 칠해진 칸은 지워요!',
    rows: ['.P.PP.', 'P.P..P'],
    baseRows: ['P.P..P', '.P.PP.'],
    blocks: ['right', 'left', 'down', 'paint', 'erase', 'repeat', 'ifElse'],
    solution:
      'ifelse:empty[paint][erase] repeat:5[R ifelse:empty[paint][erase]] D ifelse:empty[paint][erase] repeat:5[L ifelse:empty[paint][erase]]',
    hints: [
      '[만약 ~ 아니면] 블록: 비어 있으면 [색칠하기], 아니면 [지우기].',
      '첫째 줄은 오른쪽으로, 둘째 줄은 왼쪽으로 가며 칸마다 뒤집어요.',
      '반복 안에 [이동]과 [만약 ~ 아니면]을 함께 넣어요.',
    ],
    concept: {
      title: '만약 ~ 아니면',
      text: '[만약 ~ 아니면] 블록은 조건이 맞으면 위 칸을, 맞지 않으면 "아니면" 칸을 실행해요. 두 갈래 길 중 하나를 고르는 거예요.',
      art: ['P.P..P', '.P.PP.'],
    },
  },
  {
    id: 20,
    chapter: 4,
    title: '고장 난 무지개',
    difficulty: 'challenge',
    learn: '되감기로 고치기',
    story: '무지개 두 줄을 그리는 주문이 고장 났어요. 긴 주문이라 한눈에 찾기 어렵죠? [한 단계]와 [뒤로]로 오가며 찾아봐요.',
    rows: ['ROYGSB', 'SGYORP'],
    blocks: ['right', 'left', 'down', 'paint', 'next', 'repeat'],
    solution: 'next repeat:5[paint next R] paint next D repeat:5[paint next L] paint',
    starter: 'next repeat:4[paint next R] paint next D repeat:5[paint L] paint',
    hints: [
      '첫째 줄이 끝까지 칠해졌나요? 반복 횟수를 살펴봐요.',
      '둘째 줄은 색이 바뀌지 않아요. 어떤 블록이 빠졌을까요?',
      '[한 단계]로 앞으로, [뒤로]로 뒤로 가며 펜 색을 확인해 봐요.',
    ],
  },

  // ── 5장 나만의 마법 (도전 · 5~6학년) ──
  {
    id: 21,
    chapter: 5,
    title: '꽃밭',
    difficulty: 'challenge',
    learn: '나만의 블록',
    story: '꽃 세 송이가 핀 꽃밭을 만들어요. [꽃] 블록을 직접 만들어 세 번 쓰면 금방이에요!',
    rows: ['.K..K..K.', 'KYKKYKKYK', '.K..K..K.'],
    blocks: [...DRAW, 'repeat', 'define'],
    solution: 'def:꽃[color:K paint D L paint R color:Y paint R color:K paint L D paint U U] R call:꽃 repeat:2[R R R call:꽃]',
    hints: [
      '꽃 하나를 그리는 블록을 [나만의 블록 만들기] 안에 넣고 이름을 "꽃"으로 바꿔요.',
      '꽃을 그린 뒤 펜이 맨 위 꽃잎으로 돌아오게 만들면 다음 꽃을 그리기 쉬워요.',
      '꽃과 꽃 사이는 오른쪽으로 3칸이에요. [꽃] 블록을 반복 안에 넣어 봐요.',
    ],
    concept: {
      title: '나만의 블록',
      text: '[나만의 블록 만들기] 안에 블록을 넣고 이름을 붙이면, 블록 상자에 그 이름의 새 블록이 생겨요. 새 블록을 쓰면 안에 넣은 블록이 한꺼번에 실행돼요!',
      art: ['.K.', 'KYK', '.K.'],
    },
  },
  {
    id: 22,
    chapter: 5,
    title: '버섯 마을',
    difficulty: 'challenge',
    learn: '나만의 블록 + 반복',
    story: '빨간 버섯 세 개가 나란히 있는 버섯 마을이에요. [버섯] 블록을 만들어 반복으로 세워 봐요.',
    rows: ['RRR.RRR.RRR', '.Y...Y...Y.'],
    blocks: [...DRAW, 'repeat', 'define'],
    solution: 'def:버섯[color:R paint R paint R paint D L color:Y paint U L] call:버섯 repeat:2[R R R R call:버섯]',
    hints: [
      '버섯 하나: 빨간 갓 3칸, 그 아래 가운데에 노란 기둥 1칸.',
      '버섯을 그린 뒤 펜이 갓 왼쪽 끝으로 돌아오게 만들어요.',
      '버섯과 버섯 사이는 오른쪽으로 4칸이에요.',
    ],
  },
  {
    id: 23,
    chapter: 5,
    title: '세 줄 뒤집기',
    difficulty: 'challenge',
    learn: '나만의 블록 + 만약',
    story: '세 줄짜리 그림을 모두 뒤집어요. [뒤집기] 블록을 만들어 두면 칸마다 한 블록이면 끝!',
    rows: ['.P..PP', 'P.PP..', '..P.P.'],
    baseRows: ['P.PP..', '.P..PP', 'PP.P.P'],
    blocks: ['right', 'left', 'down', 'paint', 'erase', 'repeat', 'ifElse', 'define'],
    solution:
      'def:뒤집기[ifelse:empty[paint][erase]] call:뒤집기 repeat:5[R call:뒤집기] D call:뒤집기 repeat:5[L call:뒤집기] D call:뒤집기 repeat:5[R call:뒤집기]',
    hints: [
      '[나만의 블록 만들기] 안에 [만약 ~ 아니면]을 넣고 이름을 "뒤집기"로 해요.',
      '이제 칸마다 [뒤집기] 블록 하나만 쓰면 돼요.',
      '줄마다 방향이 바뀌어요: 오른쪽 → 왼쪽 → 오른쪽.',
    ],
  },
  {
    id: 24,
    chapter: 5,
    title: '마법사 졸업 시험',
    difficulty: 'challenge',
    learn: '종합',
    story: '연구소 졸업 시험! 파란 액자 안에 무지개 대각선을 그려요. 지금까지 배운 마법을 모두 꺼내 보세요.',
    rows: ['BBBBBBBB', 'BR.....B', 'B.O....B', 'B..Y...B', 'B...G..B', 'B....S.B', 'B.....BB', 'BBBBBBBB'],
    blocks: [...DRAW, 'next', 'penDown', 'penUp', 'repeat', 'if', 'ifElse', 'define'],
    solution: 'color:B pendown repeat:7[R] repeat:7[D] repeat:7[L] repeat:7[U] penup R D color:R repeat:5[paint R D next] paint',
    hints: [
      '액자는 펜 내리기와 반복 4개로 한 바퀴!',
      '액자를 다 그리면 펜을 올리고 (1,1)로 가요.',
      '무지개 대각선은 "칠하기 → 오른쪽 → 아래 → 다음 색"의 반복이에요.',
    ],
  },
];

export interface MissionData extends MissionDef {
  width: number;
  height: number;
  target: Grid;
  /** 처음부터 칠해져 있는 그림 (없으면 빈 도화지) */
  base?: Grid;
}

export const MISSION_DATA: MissionData[] = MISSIONS.map((m) => {
  const g = gridFromRows(m.rows);
  const base = m.baseRows ? gridFromRows(m.baseRows).grid : undefined;
  return { ...m, width: g.width, height: g.height, target: g.grid, base };
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

/** 모은 별에 따른 칭호 (미션 24개 × 별 3개 = 72개) */
export const TITLES: { min: number; name: string }[] = [
  { min: 0, name: '꼬마 견습 마법사' },
  { min: 8, name: '반짝 픽셀 마법사' },
  { min: 20, name: '반복 주문 마법사' },
  { min: 38, name: '펜 마법 대마법사' },
  { min: 56, name: '전설의 픽셀 현자' },
];

export function titleFor(stars: number): string {
  let t = TITLES[0].name;
  for (const x of TITLES) if (stars >= x.min) t = x.name;
  return t;
}
