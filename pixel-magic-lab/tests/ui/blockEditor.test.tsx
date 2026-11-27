import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BlockEditor } from '../../src/components/blocks/BlockEditor';
import type { BlockKind, Program } from '../../src/engine/types';

const ALL: BlockKind[] = [
  'up',
  'down',
  'left',
  'right',
  'paint',
  'erase',
  'color',
  'repeat',
  'next',
  'penDown',
  'penUp',
  'if',
  'ifElse',
  'define',
];

function Harness({ onProgram }: { onProgram?: (p: Program) => void }) {
  const [program, setProgram] = useState<Program>([]);
  return (
    <BlockEditor
      program={program}
      kinds={ALL}
      onChange={(p) => {
        setProgram(p);
        onProgram?.(p);
      }}
    />
  );
}

const workspace = () => screen.getByRole('region', { name: '명령 블록 작업 공간' });
const blocksIn = () =>
  within(workspace())
    .queryAllByRole('group')
    .filter((el) => el.getAttribute('aria-roledescription') === '블록');

describe('블록 편집기', () => {
  it('팔레트 블록을 누르면 순서대로 작업 공간에 들어가요', async () => {
    const user = userEvent.setup();
    let last: Program = [];
    render(<Harness onProgram={(p) => (last = p)} />);
    await user.click(screen.getByRole('button', { name: '오른쪽' }));
    await user.click(screen.getByRole('button', { name: '색칠하기' }));
    expect(blocksIn().map((b) => b.getAttribute('aria-label'))).toEqual(['오른쪽으로 1칸', expect.stringMatching(/^색칠하기/)]);
    expect(last.map((b) => b.type)).toEqual(['move', 'paint']);
  });

  it('반복 블록을 넣으면 다음 블록은 반복 안으로 들어가요', async () => {
    const user = userEvent.setup();
    let last: Program = [];
    render(<Harness onProgram={(p) => (last = p)} />);
    await user.click(screen.getByRole('button', { name: 'N번 반복하기' }));
    await user.click(screen.getByRole('button', { name: '아래로' }));
    expect(last).toHaveLength(1);
    expect(last[0].type).toBe('repeat');
    expect(last[0].type === 'repeat' && last[0].body.map((b) => b.type)).toEqual(['move']);
  });

  it('반복 횟수는 [+] 로 엔진 한도(30)까지만 올라가요', async () => {
    const user = userEvent.setup();
    let last: Program = [];
    render(<Harness onProgram={(p) => (last = p)} />);
    await user.click(screen.getByRole('button', { name: 'N번 반복하기' }));
    const input = screen.getByRole('textbox', { name: '반복 횟수' });
    // 지우고 새로 쓰면 그 숫자 그대로 (예전에는 지우는 순간 1이 돼서 "129"처럼 됐어요)
    await user.clear(input);
    expect(input).toHaveValue('');
    await user.type(input, '29');
    expect(last[0].type === 'repeat' && last[0].times).toBe(29);
    const plus = screen.getByRole('button', { name: '반복 횟수 늘리기' });
    await user.click(plus);
    expect(last[0].type === 'repeat' && last[0].times).toBe(30);
    expect(plus).toBeDisabled();
  });

  it('고른 블록은 Delete 키로 지우고, ▲ 버튼으로 옮겨요', async () => {
    const user = userEvent.setup();
    let last: Program = [];
    render(<Harness onProgram={(p) => (last = p)} />);
    await user.click(screen.getByRole('button', { name: '위로' }));
    await user.click(screen.getByRole('button', { name: '왼쪽' }));
    // 방금 넣은 [왼쪽] 이 골라져 있어요 → 위로 옮기기
    await user.click(screen.getByRole('button', { name: '위로 옮기기' }));
    expect(last.map((b) => b.type === 'move' && b.dir)).toEqual(['left', 'up']);
    blocksIn()[0].focus();
    await user.keyboard('{Delete}');
    expect(last.map((b) => b.type === 'move' && b.dir)).toEqual(['up']);
  });

  it('비우기는 확인 창에서 [모두 지우기]를 눌러야 지워져요', async () => {
    const user = userEvent.setup();
    let last: Program = [];
    render(<Harness onProgram={(p) => (last = p)} />);
    await user.click(screen.getByRole('button', { name: '색칠하기' }));
    await user.click(screen.getByRole('button', { name: /비우기/ }));
    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(last).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: /비우기/ }));
    await user.click(screen.getByRole('button', { name: '모두 지우기' }));
    expect(last).toHaveLength(0);
  });

  it('색 바꾸기 블록의 물감을 바꿀 수 있어요', async () => {
    const user = userEvent.setup();
    let last: Program = [];
    render(<Harness onProgram={(p) => (last = p)} />);
    await user.click(screen.getByRole('button', { name: '색 바꾸기 블록: 빨강' }));
    await user.click(screen.getByRole('button', { name: /색 고르기/ }));
    await user.click(within(screen.getByRole('group', { name: '물감 고르기' })).getByRole('button', { name: '파랑' }));
    expect(last[0].type === 'color' && last[0].color).toBe('B');
  });

  it('나만의 블록: 만들고 이름을 바꾸면 블록 상자에 그 이름의 블록이 생기고, 누르면 들어가요', async () => {
    const user = userEvent.setup();
    let last: Program = [];
    render(<Harness onProgram={(p) => (last = p)} />);
    await user.click(screen.getByRole('button', { name: '나만의 블록 만들기' }));
    await user.click(screen.getByRole('button', { name: '색칠하기' })); // 만들기 안으로 들어가요
    const name = screen.getByRole('textbox', { name: '나만의 블록 이름' });
    await user.clear(name);
    await user.type(name, '점');
    expect(last[0]).toMatchObject({ type: 'define', name: '점' });
    expect(last[0].type === 'define' && last[0].body.map((b) => b.type)).toEqual(['paint']);
    // 커서가 [만들기] 안에 있어도, 자기 자신 안에는 넣지 않고 바깥 맨 아래에 넣어요
    await user.click(screen.getByRole('button', { name: '점' }));
    expect(last[1]).toMatchObject({ type: 'call', defId: last[0].id });
    expect(last[0].type === 'define' && last[0].body).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('자기 자신을 넣을 수 없어요');
  });

  it('만약 ~ 아니면: 조건을 바꾸고, 아니면 칸이 있어요', async () => {
    const user = userEvent.setup();
    let last: Program = [];
    render(<Harness onProgram={(p) => (last = p)} />);
    await user.click(screen.getByRole('button', { name: '만약 ~ 아니면' }));
    await user.selectOptions(screen.getByRole('combobox', { name: '조건' }), '칠해져 있으면');
    expect(last[0]).toMatchObject({ type: 'if', cond: 'filled', elseBody: [] });
    expect(screen.getByText('아닐 때 할 일을 넣어요')).toBeInTheDocument();
  });
});
