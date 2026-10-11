'use client';
import { useState } from 'react';
import { C, Tooltip, TipState, YGrid, AXIS_FONT, linear, niceDomain, useWidth, localPoint } from './core';

type Bin = { x0: number; x1: number; density: number; normal: number; count: number };

/** Empirical density bins with a fitted normal curve overlaid. */
export function Histogram({ bins, height = 260, xTicks, yMax, ariaLabel }: {
  bins: readonly Bin[]; height?: number; xTicks: number[]; yMax?: number; ariaLabel: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [pt, setPt] = useState({ x: 0, y: 0 });

  const [, y1, ticks] = niceDomain([0, yMax ?? Math.max(...bins.map(b => b.density))], 4);
  const m = { top: 12, right: 10, bottom: 30, left: 44 };
  const iw = Math.max(0, width - m.left - m.right);
  const ih = height - m.top - m.bottom;
  const lo = bins[0].x0, hi = bins[bins.length - 1].x1;
  const x = linear(lo, hi, m.left, m.left + iw);
  const y = linear(0, y1, m.top + ih, m.top);
  const curve = 'M' + bins.map(b => `${x((b.x0 + b.x1) / 2).toFixed(1)},${y(b.normal).toFixed(1)}`).join('L');

  const pick = (px: number) => Math.min(bins.length - 1, Math.max(0, Math.floor(((px - m.left) / iw) * bins.length)));
  const b = hover != null ? bins[hover] : null;
  const tip: TipState = b == null ? null : {
    x: pt.x, y: pt.y,
    title: `Daily return ${b.x0.toFixed(2)}% to ${b.x1.toFixed(2)}%`,
    rows: [
      { color: C.s2, kind: 'rect', label: 'Empirical density', value: b.density.toFixed(3) },
      { color: C.s1, kind: 'line', label: 'Normal fit', value: b.normal.toFixed(3) },
    ],
    note: `${b.count.toLocaleString()} stock-day observations`,
  };

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }} role="img" aria-label={ariaLabel}>
      {width > 0 && (
        <svg width={width} height={height} className="block overflow-visible"
          onPointerMove={e => { const p = localPoint(e, e.currentTarget); if (p.x >= m.left && p.x <= m.left + iw) { setPt(p); setHover(pick(p.x)); } else setHover(null); }}
          onPointerLeave={() => setHover(null)}>
          <YGrid ticks={ticks} y={y} x0={m.left} x1={m.left + iw} fmt={v => v.toFixed(2)} zero />
          {bins.map((bn, i) => {
            const bx = x(bn.x0) + 0.5, bw = Math.max(0.5, x(bn.x1) - x(bn.x0) - 1);
            const top = y(Math.min(bn.density, y1));
            return <rect key={i} x={bx} y={top} width={bw} height={m.top + ih - top} fill={C.s2} opacity={hover == null || hover === i ? 1 : 0.55} />;
          })}
          <path d={curve} fill="none" stroke={C.s1} strokeWidth={2.25} strokeLinejoin="round" pointerEvents="none" />
          <line x1={m.left} x2={m.left + iw} y1={m.top + ih} y2={m.top + ih} stroke={C.axis} />
          {xTicks.map(t => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={m.top + ih} y2={m.top + ih + 4} stroke={C.axis} />
              <text x={x(t)} y={m.top + ih + 18} textAnchor="middle" className="tabular" {...AXIS_FONT}>{t > 0 ? `+${t}%` : `${t}%`}</text>
            </g>
          ))}
          {b && <line x1={x((b.x0 + b.x1) / 2)} x2={x((b.x0 + b.x1) / 2)} y1={m.top} y2={m.top + ih} stroke={C.ink3} pointerEvents="none" />}
        </svg>
      )}
      <Tooltip tip={tip} width={width} />
    </div>
  );
}
