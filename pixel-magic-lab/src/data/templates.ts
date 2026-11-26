import type { AnimProject } from '../lib/storage';
import { gridFromRows, emptyGrid } from '../engine/interpreter';
import { parseProgram, uid } from '../engine/program';

// ─────────────────────────────────────────────
// 움직이는 픽셀 극장 — 예시 애니메이션 템플릿 (8×8)
// rows: 손 그림(밑그림) 층, code: 프레임별 명령 블록
// ─────────────────────────────────────────────

interface TemplateFrame {
  rows?: string[];
  code?: string;
}
export interface AnimTemplate {
  key: string;
  name: string;
  desc: string;
  fps: number;
  frames: TemplateFrame[];
}

const catOpen = ['O......O', 'OO....OO', 'OOOOOOOO', 'OODOODOO', 'OODOODOO', 'OOOKKOOO', '.OOOOOO.', '..OOOO..'];
const catShut = ['O......O', 'OO....OO', 'OOOOOOOO', 'OOOOOOOO', 'ODDOODDO', 'OOOKKOOO', '.OOOOOO.', '..OOOO..'];

const bunny = (lift: number) => {
  const body = ['..W.W...', '..K.K...', '..WWW...', '..WDWW..', '..WWWW..'];
  const rows = Array(7).fill('........');
  const top = 2 - lift;
  body.forEach((r, i) => (rows[top + i] = r));
  return [...rows, 'GGGGGGGG'];
};

const star = {
  small: ['........', '........', '...Y....', '..YYY...', '...Y....', '........', '........', '........'],
  mid: ['........', '...Y....', '..YYY...', '.YYYYY..', '..YYY...', '...Y....', '........', '........'],
  big: ['...Y....', '...Y...W', '..YYY...', 'YYYYYYY.', '..YYY...', '...Y....', 'W..Y....', '........'],
};

const flower = {
  sprout: ['........', '........', '........', '........', '........', '..G.G...', '...G....', 'NNNNNNNN'],
  bud: ['........', '........', '...K....', '...G....', '..GG....', '...GG...', '...G....', 'NNNNNNNN'],
  bloom: ['..KKK...', '.KKYKK..', '..KKK...', '...G....', '..GG....', '...GG...', '...G....', 'NNNNNNNN'],
};

const dinoTop = ['....GGG.', '....GDGG', '....GGGG', 'G..GGG..', 'GGGGGG..', '.GGGGG..'];
const dino1 = [...dinoTop, '..G.G...', 'NNNNNNNN'];
const dino2 = [...dinoTop, '.G...G..', 'NNNNNNNN'];

export const TEMPLATES: AnimTemplate[] = [
  {
    key: 'cat',
    name: '눈 깜빡이는 고양이',
    desc: '눈을 감았다 뜨는 2장 그림',
    fps: 4,
    frames: [{ rows: catOpen }, { rows: catOpen }, { rows: catShut }, { rows: catOpen }],
  },
  {
    key: 'bunny',
    name: '통통 뛰는 토끼',
    desc: '위로 올라갔다 내려오는 토끼',
    fps: 4,
    frames: [{ rows: bunny(0) }, { rows: bunny(1) }, { rows: bunny(2) }, { rows: bunny(1) }],
  },
  {
    key: 'star',
    name: '반짝이는 별',
    desc: '작아졌다 커지는 별빛',
    fps: 4,
    frames: [{ rows: star.small }, { rows: star.mid }, { rows: star.big }, { rows: star.mid }],
  },
  {
    key: 'flower',
    name: '피어나는 꽃',
    desc: '새싹 → 꽃봉오리 → 활짝',
    fps: 2,
    frames: [{ rows: flower.sprout }, { rows: flower.bud }, { rows: flower.bloom }, { rows: flower.bloom }],
  },
  { key: 'dino', name: '걷는 공룡', desc: '다리를 번갈아 움직이는 공룡', fps: 4, frames: [{ rows: dino1 }, { rows: dino2 }] },
  {
    key: 'ball',
    name: '코드로 굴리는 공',
    desc: '가운데에서 왼쪽·오른쪽으로 몇 칸 갈지 바꿔서 공을 움직여요',
    fps: 4,
    frames: [0, 1, 2, 3, 4, 5, 6, 7].map((k) => ({
      code: k === 4 ? 'U color:R paint' : k < 4 ? `U color:R repeat:${4 - k}[L] paint` : `U color:R repeat:${k - 4}[R] paint`,
      rows: ['........', '........', '........', '........', 'NNNNNNNN', '........', '........', '........'],
    })),
  },
];

export function projectFromTemplate(t: AnimTemplate): AnimProject {
  const size = 8;
  return {
    id: uid(),
    name: t.name,
    size,
    fps: t.fps,
    loop: true,
    updatedAt: Date.now(),
    frames: t.frames.map((f) => ({
      id: uid(),
      program: f.code ? parseProgram(f.code) : [],
      base: f.rows ? gridFromRows(f.rows).grid : emptyGrid(size, size),
    })),
  };
}

export function blankProject(size = 8): AnimProject {
  return {
    id: uid(),
    name: '',
    size,
    fps: 4,
    loop: true,
    updatedAt: Date.now(),
    frames: [{ id: uid(), program: [], base: emptyGrid(size, size) }],
  };
}
