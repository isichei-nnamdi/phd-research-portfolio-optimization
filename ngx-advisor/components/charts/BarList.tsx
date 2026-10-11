'use client';
import { useState } from 'react';
import { C, Tooltip, TipState, TipRow, XGrid, linear, niceDomain, useWidth, hBarPath, localPoint } from './core';

export type BarItem = { label: string; value: number; color: string; group?: string };

export type BarListProps = {
  items: BarItem[];
  xFormat: (v: number) => string;
  valueFormat?: (v: number) => string;
  threshold?: { value: number; label: string };
  rowHeight?: number;
  /** Print the value just past each bar end. */
  tipValues?: boolean;
  tipRows?: (item: BarItem) => TipRow[];
  xLabel?: string;
  ariaLabel: string;
};

export function BarList(p: BarListProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [pt, setPt] = useState({ x: 0, y: 0 });
  const rowH = p.rowHeight ?? 18;
  const vf = p.valueFormat ?? p.xFormat;

  const vals = p.items.map(d => d.value);
  if (p.threshold) vals.push(p.threshold.value);
  const [, x1, ticks] = niceDomain(vals, 5, true);
  const labelW = Math.max(...p.items.map(d => d.label.length)) * 6.6 + 12;
  const m = { top: p.threshold ? 20 : 6, right: p.tipValues ? 40 : 16, bottom: p.xLabel ? 42 : 26, left: labelW };
  const height = m.top + rowH * p.items.length + m.bottom;
  const iw = Math.max(0, width - m.left - m.right);
  const ih = rowH * p.items.length;
  const x = linear(0, x1, m.left, m.left + iw);
  const barH = Math.max(6, rowH - 4);

  const tip: TipState = hover == null ? null : {
    x: pt.x, y: pt.y, title: p.items[hover].label,
    rows: p.tipRows ? p.tipRows(p.items[hover]) : [{ color: p.items[hover].color, kind: 'rect', label: p.items[hover].group ?? '', value: vf(p.items[hover].value) }],
  };

  return (
    <div ref={ref} className="relative w-full select-none outline-none" style={{ height }}
      tabIndex={0} role="img" aria-label={p.ariaLabel}
      onKeyDown={e => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const n = p.items.length;
          const next = Math.min(n - 1, Math.max(0, (hover ?? (e.key === 'ArrowDown' ? -1 : n)) + (e.key === 'ArrowDown' ? 1 : -1)));
          setHover(next);
          setPt({ x: m.left + iw / 2, y: m.top + next * rowH });
        }
      }}
      onBlur={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} className="block overflow-visible" onPointerLeave={() => setHover(null)}>
          <XGrid ticks={ticks} x={x} y0={m.top} y1={m.top + ih} fmt={p.xFormat} />
          {p.xLabel && <text x={m.left + iw / 2} y={height - 6} textAnchor="middle" fontSize={11} fill={C.ink2}>{p.xLabel}</text>}

          {p.items.map((d, i) => {
            const ry = m.top + i * rowH;
            const active = hover === i;
            return (
              <g key={d.label} opacity={hover != null && !active ? 0.5 : 1} style={{ transition: 'opacity .12s' }}>
                <text x={m.left - 8} y={ry + rowH / 2} dy="0.32em" textAnchor="end" fontSize={10.5}
                  fill={active ? C.ink : C.ink2} fontWeight={active ? 600 : 400}>{d.label}</text>
                <path d={hBarPath(ry + (rowH - barH) / 2, barH, m.left, Math.max(m.left + 1, x(d.value)), 3)} fill={d.color} />
                {p.tipValues && (
                  <text x={x(d.value) + 6} y={ry + rowH / 2} dy="0.32em" fontSize={10.5} fill={C.ink2} className="tabular">{vf(d.value)}</text>
                )}
                <rect x={0} y={ry} width={width} height={rowH} fill="transparent"
                  onPointerMove={e => { setHover(i); setPt(localPoint(e, e.currentTarget.ownerSVGElement!)); }} />
              </g>
            );
          })}

          <line x1={m.left} x2={m.left} y1={m.top} y2={m.top + ih} stroke={C.axis} shapeRendering="crispEdges" />
          {p.threshold && (
            <g pointerEvents="none">
              <line x1={x(p.threshold.value)} x2={x(p.threshold.value)} y1={m.top - 4} y2={m.top + ih} stroke={C.ink2} strokeWidth={1.25} strokeDasharray="4 3" />
              <text x={x(p.threshold.value) + 5} y={m.top - 8} fontSize={10.5} fontWeight={500} fill={C.ink2}>{p.threshold.label}</text>
            </g>
          )}
        </svg>
      )}
      <Tooltip tip={tip} width={width} />
    </div>
  );
}
