import type { ReactElement } from 'react';

// ─────────────────────────────────────────────
// 앱 전체에서 쓰는 손그림 느낌의 둥근 선 아이콘 (SVG)
// 모든 아이콘은 같은 선 굵기·둥근 끝 처리로 통일했습니다.
// ─────────────────────────────────────────────

export type IconName =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'brush'
  | 'eraser'
  | 'drop'
  | 'loop'
  | 'play'
  | 'pause'
  | 'step'
  | 'stepBack'
  | 'penDown'
  | 'penUp'
  | 'rainbow'
  | 'branch'
  | 'magic'
  | 'restart'
  | 'clear'
  | 'star'
  | 'sound'
  | 'mute'
  | 'expand'
  | 'shrink'
  | 'help'
  | 'save'
  | 'folder'
  | 'download'
  | 'trash'
  | 'plus'
  | 'copy'
  | 'film'
  | 'map'
  | 'lock'
  | 'bulb'
  | 'close'
  | 'undo'
  | 'redo'
  | 'hand'
  | 'code'
  | 'grip'
  | 'chevUp'
  | 'chevDown'
  | 'chevLeft'
  | 'chevRight'
  | 'check'
  | 'eye'
  | 'onion'
  | 'teacher'
  | 'wand'
  | 'stop'
  | 'sparkle'
  | 'new';

const P: Record<IconName, ReactElement> = {
  up: <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" />,
  down: <path d="M12 5v14M5.5 12.5 12 19l6.5-6.5" />,
  left: <path d="M19 12H5M11.5 5.5 5 12l6.5 6.5" />,
  right: <path d="M5 12h14M12.5 5.5 19 12l-6.5 6.5" />,
  brush: (
    <>
      <path d="M14.5 4.5 19.5 9.5 11 18l-5-5z" />
      <path d="M6 13c-2 0-3 1.6-3 3.4V20h3.6C8.4 20 10 19 10 17" />
    </>
  ),
  eraser: (
    <>
      <path d="M8.5 19.5 3.8 14.8a1.6 1.6 0 0 1 0-2.3l8.4-8.4a1.6 1.6 0 0 1 2.3 0l4.6 4.6a1.6 1.6 0 0 1 0 2.3L11 19.5z" />
      <path d="M8 9.5 14.5 16M11 19.5h9" />
    </>
  ),
  drop: <path d="M12 3.5s6 6.4 6 10.8A6 6 0 0 1 6 14.3C6 9.9 12 3.5 12 3.5z" />,
  loop: (
    <>
      <path d="M4.5 12a7.5 7.5 0 0 1 12.8-5.3L19.5 9" />
      <path d="M19.5 4v5h-5" />
      <path d="M19.5 12a7.5 7.5 0 0 1-12.8 5.3L4.5 15" />
      <path d="M4.5 20v-5h5" />
    </>
  ),
  play: <path d="M7.5 5.2v13.6a.8.8 0 0 0 1.2.7l10.6-6.8a.8.8 0 0 0 0-1.4L8.7 4.5a.8.8 0 0 0-1.2.7z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="2.5" />,
  step: (
    <>
      <path d="M5.5 6.2v11.6a.7.7 0 0 0 1.1.6l8.6-5.8a.7.7 0 0 0 0-1.2L6.6 5.6a.7.7 0 0 0-1.1.6z" />
      <path d="M19 5.5v13" />
    </>
  ),
  stepBack: (
    <>
      <path d="M18.5 6.2v11.6a.7.7 0 0 1-1.1.6l-8.6-5.8a.7.7 0 0 1 0-1.2l8.6-5.8a.7.7 0 0 1 1.1.6z" />
      <path d="M5 5.5v13" />
    </>
  ),
  penDown: (
    <>
      <path d="m14.5 4.5 5 5L9 20H4v-5z" />
      <path d="M4 22h16" />
    </>
  ),
  penUp: (
    <>
      <path d="m15.5 2.5 4 4L11 15H7v-4z" />
      <path d="M4 21h4m4 0h4m4 0h0" />
    </>
  ),
  rainbow: (
    <>
      <path d="M3 17a9 9 0 0 1 18 0" />
      <path d="M7 17a5 5 0 0 1 10 0" />
      <path d="M11 17a1 1 0 0 1 2 0" />
    </>
  ),
  branch: (
    <>
      <path d="M12 3v6" />
      <path d="M12 9 6 15v5" />
      <path d="m12 9 6 6v5" />
      <circle cx="12" cy="3" r="0.5" />
    </>
  ),
  magic: (
    <>
      <path d="M4 20 14 10" />
      <path d="m15 3 1 2.5L18.5 6.5 16 7.5 15 10l-1-2.5L11.5 6.5 14 5.5z" />
      <path d="M19 12v3m-1.5-1.5h3" />
    </>
  ),
  restart: (
    <>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5" />
      <path d="M4.5 4v5h5" />
    </>
  ),
  clear: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </>
  ),
  star: <path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />,
  sparkle: (
    <path d="M12 3c.6 4.4 2.6 6.4 7 7-4.4.6-6.4 2.6-7 7-.6-4.4-2.6-6.4-7-7 4.4-.6 6.4-2.6 7-7zM19 16c.2 1.6.9 2.3 2.5 2.5-1.6.2-2.3.9-2.5 2.5-.2-1.6-.9-2.3-2.5-2.5 1.6-.2 2.3-.9 2.5-2.5z" />
  ),
  sound: (
    <>
      <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
  mute: (
    <>
      <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" />
      <path d="m15.5 9.5 5 5M20.5 9.5l-5 5" />
    </>
  ),
  expand: <path d="M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15" />,
  shrink: <path d="M9 4.5V9H4.5M19.5 9H15V4.5M15 19.5V15h4.5M4.5 15H9v4.5" />,
  help: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.6a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.6M12 17h.01" />
    </>
  ),
  save: (
    <>
      <path d="M5 4.5h11l3.5 3.5v11.5h-14.5z" />
      <path d="M8 4.5v4.5h7V4.5M8 19.5v-6h8v6" />
    </>
  ),
  folder: (
    <path d="M3.5 7.5V18a1.5 1.5 0 0 0 1.5 1.5h14a1.5 1.5 0 0 0 1.5-1.5V9.5A1.5 1.5 0 0 0 19 8h-7.5L9.5 5.5H5A1.5 1.5 0 0 0 3.5 7z" />
  ),
  download: <path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14" />,
  trash: (
    <>
      <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5" />
      <path d="M10.5 11v5M13.5 11v5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
    </>
  ),
  film: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <path d="M7.5 5v14M16.5 5v14M3.5 9.5h4M3.5 14.5h4M16.5 9.5h4M16.5 14.5h4" />
    </>
  ),
  map: <path d="M3.5 6.5 9 4.5l6 2 5.5-2v13l-5.5 2-6-2-5.5 2zM9 4.5v13M15 6.5v13" />,
  lock: (
    <>
      <rect x="5.5" y="10.5" width="13" height="9.5" rx="2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  bulb: <path d="M9 17.5h6M10 20.5h4M12 3.5A5.8 5.8 0 0 0 8.6 14c.6.5.9 1.2.9 2v1.5h5V16c0-.8.3-1.5.9-2A5.8 5.8 0 0 0 12 3.5z" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  undo: (
    <>
      <path d="M8.5 5 4.5 9l4 4" />
      <path d="M4.5 9H14a5.5 5.5 0 0 1 0 11H9" />
    </>
  ),
  redo: (
    <>
      <path d="m15.5 5 4 4-4 4" />
      <path d="M19.5 9H10a5.5 5.5 0 0 0 0 11h5" />
    </>
  ),
  hand: (
    <path d="M8 12.5V6a1.5 1.5 0 0 1 3 0v5.5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v7.5c0 4-2.5 7-6.5 7-2.4 0-3.8-1-5-2.6L3.6 15a1.5 1.5 0 0 1 2.3-1.8L8 15" />
  ),
  code: <path d="m8.5 7-5 5 5 5M15.5 7l5 5-5 5M13.5 4.5l-3 15" />,
  grip: (
    <>
      <circle cx="9" cy="6" r="1.2" />
      <circle cx="15" cy="6" r="1.2" />
      <circle cx="9" cy="12" r="1.2" />
      <circle cx="15" cy="12" r="1.2" />
      <circle cx="9" cy="18" r="1.2" />
      <circle cx="15" cy="18" r="1.2" />
    </>
  ),
  chevUp: <path d="m6 15 6-6 6 6" />,
  chevDown: <path d="m6 9 6 6 6-6" />,
  chevLeft: <path d="m15 6-6 6 6 6" />,
  chevRight: <path d="m9 6 6 6-6 6" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  onion: (
    <>
      <rect x="3.5" y="3.5" width="11" height="11" rx="2" strokeDasharray="2.5 2.5" />
      <rect x="9.5" y="9.5" width="11" height="11" rx="2" />
    </>
  ),
  teacher: (
    <>
      <rect x="3.5" y="4.5" width="17" height="11" rx="1.5" />
      <path d="M8 20l4-4.5 4 4.5M7 8.5h6M7 11.5h4" />
    </>
  ),
  wand: (
    <>
      <path d="M4 20 14.5 9.5" />
      <path d="M16 3v3M16 12v3M11.5 7.5h-2.5M23 7.5h-3M19.2 4.3l-1.4 1.4M14.2 10.7l-1-1M19.2 10.7l-1.4-1.4" />
    </>
  ),
  new: (
    <>
      <path d="M6 3.5h8l4.5 4.5v12.5H6z" />
      <path d="M12 11v6M9 14h6" />
    </>
  ),
};

const FILLED: Partial<Record<IconName, boolean>> = { play: true, star: true, sparkle: true, step: false, grip: true, stop: true };

export function Icon({ name, size = 22, className, title }: { name: IconName; size?: number; className?: string; title?: string }) {
  const filled = FILLED[name];
  return (
    <svg
      className={'icon ' + (className ?? '')}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 1.4 : 2.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      {P[name]}
    </svg>
  );
}
