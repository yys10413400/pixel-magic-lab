import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/App';

// 앱 전체를 띄워서 아이가 하는 순서대로 눌러 봐요 (속도는 '바로'로 저장해 두고 시작)
function start() {
  localStorage.setItem('pml.settings.v1', JSON.stringify({ muted: true, speed: 'instant' }));
  const user = userEvent.setup();
  render(<App />);
  return user;
}

describe('앱 전체 흐름', () => {
  it('미션 1: 개념 안내를 닫고, 블록을 쌓아 실행하면 성공 창이 떠요', async () => {
    const user = start();
    await user.click(await screen.findByRole('button', { name: '알겠어요!' }));
    // 숨겨진 모드 화면은 찾지 않으므로 지금 보이는 미션 화면의 블록만 찾아져요
    for (const name of ['오른쪽', '오른쪽', '아래로', '아래로', '색칠하기']) await user.click(screen.getByRole('button', { name }));
    await user.click(screen.getByRole('button', { name: /실행하기/ }));
    expect(await screen.findByRole('heading', { name: '미션 성공!' })).toBeInTheDocument();
    // 성공 기록이 저장돼요
    const progress = JSON.parse(localStorage.getItem('pml.progress.v1') ?? '{}');
    expect(progress.missions?.['1']?.stars).toBe(3);
  });

  it('미션 1: 틀린 곳에 칠하면 실패 안내가 나와요', async () => {
    const user = start();
    await user.click(await screen.findByRole('button', { name: '알겠어요!' }));
    await user.click(screen.getByRole('button', { name: '색칠하기' }));
    await user.click(screen.getByRole('button', { name: /실행하기/ }));
    expect(await screen.findByText(/목표 그림과 다른 칸이 있어요/)).toBeInTheDocument();
  });

  it('공방: 저장하면 내 작품 보관함에 들어가요', async () => {
    const user = start();
    await user.click(await screen.findByRole('button', { name: '알겠어요!' }));
    await user.click(screen.getByRole('button', { name: /자유 픽셀 공방/ }));
    // 숨겨진 모드 화면은 찾지 않으므로, 지금 보이는 공방 화면의 버튼만 찾아져요
    await user.type(screen.getByRole('textbox', { name: /작품 이름/ }), '테스트 작품');
    await user.click(screen.getByRole('button', { name: '색칠하기' }));
    await user.click(screen.getByRole('button', { name: /^저장하기/ }));
    const works = JSON.parse(localStorage.getItem('pml.works.v1') ?? '[]');
    expect(works).toHaveLength(1);
    expect(works[0]).toMatchObject({ name: '테스트 작품', schema: 2 });
  });
});
