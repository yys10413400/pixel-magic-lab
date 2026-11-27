import { useRef } from 'react';
import type { ColorKey, Grid } from '../engine/types';
import { colorHex } from '../engine/palette';

// ─────────────────────────────────────────────
// 픽셀 도화지 (SVG)
// - 마법 펜 위치(점선 테두리 + 별), 틀린 칸(X 표시 / 점선 동그라미)을
//   색이 아닌 모양으로도 구분할 수 있게 그립니다.
// ─────────────────────────────────────────────

const C = 10; // 칸 하나의 크기 (SVG 단위)

export interface DiffMark {
  index: number;
  expected: ColorKey | null;
}

interface Props {
  width: number;
  height: number;
  grid: Grid;
  pen?: { x: number; y: number; color: ColorKey; mode: 'idle' | 'active' | 'error' } | null;
  errorTarget?: { x: number; y: number } | null;
  diff?: DiffMark[] | null;
  ghost?: Grid | null; // 반투명하게 겹쳐 보이는 그림 (어니언 스킨, 목표 겹쳐 보기)
  ghostOpacity?: number;
  axes?: boolean;
  frame?: boolean;
  lastChange?: number;
  className?: string;
  label?: string;
  onPaintStart?: (index: number) => void;
  onPaintMove?: (index: number) => void;
  onPaintEnd?: () => void;
  cursor?: 'brush' | 'eraser' | null;
}

export function PixelCanvas(props: Props) {
  const { width, height, grid, pen, diff, ghost, axes = false, frame = true } = props;
  const svgRef = useRef<SVGSVGElement>(null);
  const painting = useRef(false);
  const lastCell = useRef(-1);

  const m = axes ? 11 : frame ? 4 : 0;
  const vbW = width * C + m * 2;
  const vbH = height * C + m * 2;
  const interactive = !!props.onPaintStart;

  const cellFromEvent = (e: React.PointerEvent): number => {
    const svg = svgRef.current;
    if (!svg) return -1;
    const ctm = svg.getScreenCTM();
    if (!ctm) return -1;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    const gx = Math.floor(p.x / C);
    const gy = Math.floor(p.y / C);
    if (gx < 0 || gy < 0 || gx >= width || gy >= height) return -1;
    return gy * width + gx;
  };

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!interactive) return;
    const i = cellFromEvent(e);
    if (i < 0) return;
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    painting.current = true;
    lastCell.current = i;
    props.onPaintStart?.(i);
  };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!painting.current) return;
    const i = cellFromEvent(e);
    if (i < 0 || i === lastCell.current) return;
    // 빠르게 움직여도 칸을 건너뛰지 않도록 사이 칸을 모두 칠함
    const prev = lastCell.current;
    if (prev >= 0) {
      let x0 = prev % width;
      let y0 = Math.floor(prev / width);
      const x1 = i % width;
      const y1 = Math.floor(i / width);
      const dx = Math.abs(x1 - x0);
      const dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      while (!(x0 === x1 && y0 === y1)) {
        const e2 = 2 * err;
        if (e2 >= dy) {
          err += dy;
          x0 += sx;
        }
        if (e2 <= dx) {
          err += dx;
          y0 += sy;
        }
        props.onPaintMove?.(y0 * width + x0);
      }
    } else props.onPaintMove?.(i);
    lastCell.current = i;
  };
  const onUp = () => {
    if (!painting.current) return;
    painting.current = false;
    lastCell.current = -1;
    props.onPaintEnd?.();
  };

  const cells = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const c = grid[i];
      const checker = (x + y) % 2 === 0;
      cells.push(<rect key={'b' + i} x={x * C} y={y * C} width={C} height={C} className={checker ? 'cell-empty a' : 'cell-empty b'} />);
      if (!c && ghost && ghost[i]) {
        cells.push(
          <rect key={'g' + i} x={x * C} y={y * C} width={C} height={C} fill={colorHex(ghost[i])} opacity={props.ghostOpacity ?? 0.32} />,
        );
      }
      if (c) {
        cells.push(
          <rect
            key={'c' + i + c}
            x={x * C}
            y={y * C}
            width={C}
            height={C}
            fill={colorHex(c)}
            className={'cell-fill' + (props.lastChange === i ? ' pop' : '')}
            style={{ transformOrigin: `${x * C + C / 2}px ${y * C + C / 2}px` }}
          />,
        );
      }
    }
  }

  const lines = [];
  for (let x = 1; x < width; x++) lines.push(<line key={'vx' + x} x1={x * C} y1={0} x2={x * C} y2={height * C} />);
  for (let y = 1; y < height; y++) lines.push(<line key={'hy' + y} x1={0} y1={y * C} x2={width * C} y2={y * C} />);

  const axisLabels = [];
  if (axes) {
    const fs = width > 12 ? 4.2 : 5;
    for (let x = 0; x < width; x++)
      axisLabels.push(
        <text key={'ax' + x} x={x * C + C / 2} y={-4} fontSize={fs} className="axis-label" textAnchor="middle">
          {x}
        </text>,
      );
    for (let y = 0; y < height; y++)
      axisLabels.push(
        <text key={'ay' + y} x={-4.5} y={y * C + C / 2 + 1.8} fontSize={fs} className="axis-label" textAnchor="middle">
          {y}
        </text>,
      );
  }

  // 틀린 칸 표시
  const diffMarks = (diff ?? []).map((d) => {
    const x = d.index % width;
    const y = Math.floor(d.index / width);
    const has = !!grid[d.index];
    return (
      <g key={'d' + d.index} className="diff-mark">
        {has ? (
          // 칠하면 안 되는 칸 / 색이 다른 칸: X 표시
          <>
            <rect x={x * C + 0.8} y={y * C + 0.8} width={C - 1.6} height={C - 1.6} className="diff-box" />
            <path
              d={`M${x * C + 2.6} ${y * C + 2.6}L${x * C + C - 2.6} ${y * C + C - 2.6}M${x * C + C - 2.6} ${y * C + 2.6}L${x * C + 2.6} ${y * C + C - 2.6}`}
              className="diff-x"
            />
          </>
        ) : (
          // 칠해야 하는데 빈 칸: 점선 동그라미 + 원래 색 점
          <>
            <circle cx={x * C + C / 2} cy={y * C + C / 2} r={3.4} className="diff-ring" />
            {d.expected && <circle cx={x * C + C / 2} cy={y * C + C / 2} r={1.5} fill={colorHex(d.expected)} />}
          </>
        )}
        {has && d.expected && (
          <circle cx={x * C + C - 2} cy={y * C + C - 2} r={1.5} fill={colorHex(d.expected)} stroke="#4a3a33" strokeWidth={0.4} />
        )}
      </g>
    );
  });

  // 오류: 펜이 나가려던 방향
  let errArrow = null;
  if (pen && props.errorTarget) {
    const dx = props.errorTarget.x - pen.x;
    const dy = props.errorTarget.y - pen.y;
    const cx = pen.x * C + C / 2;
    const cy = pen.y * C + C / 2;
    const ex = cx + dx * (C * 0.95);
    const ey = cy + dy * (C * 0.95);
    errArrow = (
      <g className="err-arrow">
        <line x1={cx} y1={cy} x2={ex} y2={ey} />
        <circle cx={ex} cy={ey} r={3.3} className="err-badge" />
        <text x={ex} y={ey + 1.6} textAnchor="middle" fontSize={4.6} className="err-badge-text">
          !
        </text>
      </g>
    );
  }

  return (
    <svg
      ref={svgRef}
      className={
        'pixel-canvas ' + (props.className ?? '') + (interactive ? ' interactive' : '') + (props.cursor ? ' cur-' + props.cursor : '')
      }
      viewBox={`${-m} ${-m} ${vbW} ${vbH}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={props.label ?? `${width}×${height} 픽셀 도화지`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onLostPointerCapture={onUp}
    >
      {frame && (
        <>
          <rect
            x={-4}
            y={-4}
            width={width * C + 8}
            height={height * C + 8}
            rx={5}
            className="canvas-frame-shadow"
            transform="translate(0 2.4)"
          />
          <rect x={-4} y={-4} width={width * C + 8} height={height * C + 8} rx={5} className="canvas-frame" />
        </>
      )}
      <g className="cells">{cells}</g>
      <g className="grid-lines">{lines}</g>
      {frame && <rect x={0} y={0} width={width * C} height={height * C} className="grid-edge" />}
      {axisLabels}
      {diffMarks}
      {pen && (
        <g className={'pen pen-' + pen.mode} transform={`translate(${pen.x * C} ${pen.y * C})`}>
          <rect x={0.6} y={0.6} width={C - 1.2} height={C - 1.2} rx={1.2} className="pen-ring" />
          <circle cx={C - 1.2} cy={1.2} r={2.4} className="pen-dot" fill={colorHex(pen.color)} />
          <path
            className="pen-star"
            transform={`translate(${C - 1.2} ${1.2}) scale(0.16) translate(-12 -12)`}
            d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"
          />
        </g>
      )}
      {errArrow}
    </svg>
  );
}

/** 작은 미리보기 그림 (썸네일) */
export function PixelThumb({ grid, width, height, className }: { grid: Grid; width: number; height: number; className?: string }) {
  const rects = [];
  for (let i = 0; i < grid.length; i++) {
    const c = grid[i];
    if (!c) continue;
    rects.push(<rect key={i} x={i % width} y={Math.floor(i / width)} width={1.02} height={1.02} fill={colorHex(c)} />);
  }
  return (
    <svg
      className={'pixel-thumb ' + (className ?? '')}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="crispEdges"
      aria-hidden
    >
      <rect width={width} height={height} className="thumb-bg" />
      {rects}
    </svg>
  );
}
