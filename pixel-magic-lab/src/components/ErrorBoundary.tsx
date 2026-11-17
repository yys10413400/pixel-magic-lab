import { Component, type ReactNode } from 'react';

// 예상하지 못한 오류가 나도 하얀 화면 대신 친절한 안내를 보여줍니다.
// 저장된 작품과 미션 기록은 브라우저에 그대로 남아 있습니다.
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[픽셀 마법사 연구소] 오류', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="crash">
        <div className="crash-card">
          <h1>앗, 마법이 잠깐 꼬였어요!</h1>
          <p>저장한 작품과 미션 기록은 그대로 있어요. 아래 버튼을 눌러 다시 시작해 주세요.</p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            다시 시작하기
          </button>
        </div>
      </div>
    );
  }
}
