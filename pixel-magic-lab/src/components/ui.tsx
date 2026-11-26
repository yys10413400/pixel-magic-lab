import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';
import type { RunnerView, RunStatus } from './useRunner';
import { SPEED_LABEL } from './useRunner';
import type { SpeedKey } from '../lib/storage';
import { colorHex, colorName } from '../engine/palette';
import { describeStep } from '../engine/interpreter';

// ─────────────────────────────────────────────
// 공통 UI 조각: 실행 버튼 묶음, 상태 표시줄, 팝업 창
// ─────────────────────────────────────────────

export const STATUS_TEXT: Record<RunStatus, string> = {
  idle: '준비 완료',
  running: '마법 실행 중…',
  paused: '잠깐 멈춤',
  done: '실행 끝!',
  error: '앗, 멈췄어요',
};

interface RunControlsProps {
  view: RunnerView;
  speed: SpeedKey;
  onSpeed: (s: SpeedKey) => void;
  onRun: () => void;
  onPause: () => void;
  onResume: () => void;
  onStep: () => void;
  onReset: () => void;
  compact?: boolean;
}

export function RunControls(p: RunControlsProps) {
  const { status } = p.view;
  const main =
    status === 'running'
      ? { label: '일시정지', icon: 'pause' as const, fn: p.onPause, cls: 'pause' }
      : status === 'paused'
        ? { label: '계속하기', icon: 'play' as const, fn: p.onResume, cls: 'go' }
        : { label: '실행하기', icon: 'play' as const, fn: p.onRun, cls: 'go' };
  return (
    <div className={'run-controls' + (p.compact ? ' compact' : '')}>
      <button type="button" className={'btn-run ' + main.cls} onClick={main.fn}>
        <Icon name={main.icon} size={24} />
        {main.label}
      </button>
      <button type="button" className="btn-ctl" onClick={p.onStep} title="명령을 하나씩 실행해요">
        <Icon name="step" size={20} />한 단계
      </button>
      <button type="button" className="btn-ctl" onClick={p.onRun} title="도화지를 비우고 처음부터 다시 실행해요">
        <Icon name="restart" size={20} />
        처음부터
      </button>
      <button type="button" className="btn-ctl" onClick={p.onReset} title="실행 결과를 지우고 처음 상태로">
        <Icon name="clear" size={20} />
        초기화
      </button>
      <div className="speed" role="radiogroup" aria-label="실행 속도">
        <span className="speed-label">속도</span>
        {(['slow', 'normal', 'fast', 'instant'] as SpeedKey[]).map((s) => (
          <button
            type="button"
            key={s}
            role="radio"
            aria-checked={p.speed === s}
            className={p.speed === s ? 'on' : ''}
            onClick={() => p.onSpeed(s)}
          >
            {SPEED_LABEL[s]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function StatusBar({ view, extra }: { view: RunnerView; extra?: ReactNode }) {
  const msg =
    view.current && view.status !== 'idle'
      ? describeStep(view.current)
      : view.stale
        ? '코드가 바뀌었어요. 실행해서 확인해 봐요!'
        : '실행 버튼을 누르면 마법 펜이 움직여요';
  return (
    <div className={'status-bar st-' + view.status} aria-live="polite">
      <span className="st-chip">{STATUS_TEXT[view.status]}</span>
      <span className="st-item" title="마법 펜 위치">
        <Icon name="wand" size={16} /> ({view.x},{view.y})
      </span>
      <span className="st-item" title="펜 색">
        <span className="sw sm" style={{ background: colorHex(view.color) }} />
        {colorName(view.color)}
      </span>
      <span className="st-item" title="실행 단계">
        단계 {view.applied}/{view.total}
      </span>
      <span className="st-msg">{msg}</span>
      {extra}
    </div>
  );
}

interface ModalProps {
  open: boolean;
  title?: ReactNode;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
  icon?: ReactNode;
}

export function Modal({ open, title, onClose, children, className, footer, icon }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => {
      const el = ref.current?.querySelector<HTMLElement>('[data-autofocus], .modal-foot button, button');
      el?.focus();
    }, 30);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', key);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', key);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={'modal ' + (className ?? '')} role="dialog" aria-modal="true" ref={ref}>
        <ModalCorners />
        {(title || onClose) && (
          <div className="modal-head">
            {icon}
            <h2>{title}</h2>
            {onClose && (
              <button type="button" className="btn-icon" onClick={onClose} aria-label="닫기">
                <Icon name="close" size={20} />
              </button>
            )}
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

function ModalCorners() {
  // 예전 장식 모서리. 지금은 팝업 자체가 픽셀 모서리 틀이라 그리지 않아요.
  return null;
}

export interface ConfirmState {
  title: string;
  message: ReactNode;
  confirmText: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  extra?: { text: string; onClick: () => void };
}

export function ConfirmDialog({ state, onClose }: { state: ConfirmState | null; onClose: () => void }) {
  return (
    <Modal
      open={!!state}
      title={state?.title}
      onClose={onClose}
      className="confirm"
      icon={<Icon name="help" size={24} />}
      footer={
        state && (
          <>
            <button type="button" className="btn" onClick={onClose}>
              {state.cancelText ?? '취소'}
            </button>
            {state.extra && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  state.extra!.onClick();
                  onClose();
                }}
              >
                {state.extra.text}
              </button>
            )}
            <button
              type="button"
              className={'btn ' + (state.danger ? 'btn-danger' : 'btn-primary')}
              data-autofocus
              onClick={() => {
                state.onConfirm();
                onClose();
              }}
            >
              {state.confirmText}
            </button>
          </>
        )
      }
    >
      <div className="confirm-msg">{state?.message}</div>
    </Modal>
  );
}

/** 별 모양 (채움 / 빈) */
export function Stars({ n, max = 3, size = 20 }: { n: number; max?: number; size?: number }) {
  return (
    <span className="stars" aria-label={`별 ${n}개`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < n ? 'st on' : 'st'}>
          <Icon name="star" size={size} />
        </span>
      ))}
    </span>
  );
}

/** 완료 도장 */
export function Stamp({ size = 46 }: { size?: number }) {
  return (
    <svg className="stamp" width={size} height={size} viewBox="0 0 60 60" aria-label="완료 도장">
      <circle cx="30" cy="30" r="26" />
      <circle cx="30" cy="30" r="21" className="in" />
      <path className="star" d="m30 13 4.2 8.6 9.4 1.4-6.8 6.6 1.6 9.4L30 34.6 21.6 39l1.6-9.4-6.8-6.6 9.4-1.4z" />
      <text x="30" y="51" textAnchor="middle">
        참 잘했어요
      </text>
    </svg>
  );
}
