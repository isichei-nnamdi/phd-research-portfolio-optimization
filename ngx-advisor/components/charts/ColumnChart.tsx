'use client';
import { useMemo, useState } from 'react';
import { C, Series, Tooltip, TipState, YGrid, AXIS_FONT, linear, niceDomain, useWidth, vBarPath, localPoint } from './core';

export type ColumnChartProps = {
  categories: { key: string; label: string; sub?: string }[];
  series: Series[];
  value: (catIndex: number, seriesKey: string) => number;
  /** Override a bar's colour (emphasis: highlight one, mute the rest). */
  colorFor?: (catIndex: number, s: Series) => string;
  /** Text on the bar cap; return null to skip. */
  capLabel?: (catIndex: number, s: Series) => string | null;
  yFormat: (v: number) => string;
  valueFormat?: (v: number) => string;
  yDomain?: [number, number];
  refLines?: { y: number; label: string }[];
  height?: number;
  maxBar?: number;
  tipTitle?: (catIndex: number) => string;
  tipNote?: (catIndex: number) => string | undefined;
  ariaLabel: string;
};

export function ColumnChart(p: ColumnChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [pt, setPt] = useState({ x: 0, y: 0 });
  const height = p.height ?? 260;
  const vf = p.valueFormat ?? p.yFormat;
  const n = p.categories.length, k = p.series.length;
  const hasSub = p.categories.some(c => c.sub);

  const [y0, y1, ticks] = useMemo(() => {
    const vals = p.categories.flatMap((_, i) => p.series.map(s => p.value(i, s.key)));
    if (p.refLines) vals.push(...p.refLines.map(r => r.y));
    if (p.yDomain) vals.push(...p.yDomain);
    return niceDomain(vals, 5, true);
  }, [p]);

  const labelW = Math.max(...ticks.map(t => p.yFormat(t).length)) * 6.6 + 14;
  const m = { top: p.capLabel ? 22 : 12, right: 8, bottom: hasSub ? 42 : 28, left: Math.max(36, labelW) };
  const iw = Math.max(0, width - m.left - m.right);
  const ih = height - m.top - m.bottom;
  const y = linear(y0, y1, m.top + ih, m.top);
  const band = iw / n;
  const gap = 2;
  const barW = Math.max(3, Math.min(p.maxBar ?? 24, (band * 0.72 - gap * (k - 1)) / k));
  const groupW = barW * k + gap * (k - 1);
  const base = y(0);

  const tip: TipState = hover == null ? null : {
    x: pt.x, y: pt.y,
    title: p.tipTitle ? p.tipTitle(hover) : p.categories[hover].label,
    rows: p.series.map(s => ({
      color: p.colorFor ? p.colorFor(hover, s) : s.color, kind: 'rect' as const,
      label: s.label, value: vf(p.value(hover, s.key)),
    })),
    note: p.tipNote?.(hover),
  };

  return (
    <div ref={ref} className="relative w-full select-none outline-none" style={{ height }}
      tabIndex={0} role="img" aria-label={p.ariaLabel}
      onKeyDown={e => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          const next = Math.min(n - 1, Math.max(0, (hover ?? (e.key === 'ArrowRight' ? -1 : n)) + (e.key === 'ArrowRight' ? 1 : -1)));
          setHover(next);
          setPt({ x: m.left + band * next + band / 2, y: m.top + 10 });
        }
      }}
      onBlur={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} className="block overflow-visible"
          onPointerLeave={() => setHover(null)}>
          <YGrid ticks={ticks} y={y} x0={m.left} x1={m.left + iw} fmt={p.yFormat} zero />

          {p.categories.map((c, i) => {
            const gx = m.left + band * i + (band - groupW) / 2;
            const dim = hover != null && hover !== i;
            return (
              <g key={c.key} opacity={dim ? 0.45 : 1} style={{ transition: 'opacity .15s' }}>
                {p.series.map((s, j) => {
                  const v = p.value(i, s.key);
                  const bx = gx + j * (barW + gap);
                  const end = y(v);
                  const cap = p.capLabel?.(i, s);
                  return (
                    <g key={s.key}>
                      <path d={vBarPath(bx, barW, base, end)} fill={p.colorFor ? p.colorFor(i, s) : s.color} />
                      {cap && (
                        <text x={bx + barW / 2} y={v >= 0 ? end - 6 : end + 14} textAnchor="middle"
                          fontSize={11.5} fontWeight={600} fill={C.ink} className="tabular">{cap}</text>
                      )}
                    </g>
                  );
                })}
                <text x={m.left + band * i + band / 2} y={m.top + ih + 18} textAnchor="middle" {...AXIS_FONT} fill={C.ink2}>{c.label}</text>
                {c.sub && <text x={m.left + band * i + band / 2} y={m.top + ih + 32} textAnchor="middle" {...AXIS_FONT}>{c.sub}</text>}
                {/* Hit target: the whole category band */}
                <rect x={m.left + band * i} y={m.top} width={band} height={ih} fill="transparent"
                  onPointerMove={e => { setHover(i); setPt(localPoint(e, e.currentTarget.ownerSVGElement!)); }} />
              </g>
            );
          })}

          {p.refLines?.map(r => (
            <g key={r.label} pointerEvents="none">
              <line x1={m.left} x2={m.left + iw} y1={y(r.y)} y2={y(r.y)} stroke={C.ink3} strokeWidth={1} strokeDasharray="4 4" />
              <text x={m.left + iw} y={y(r.y) - 5} textAnchor="end" fontSize={10.5} fill={C.ink2}>{r.label}</text>
            </g>
          ))}
          <line x1={m.left} x2={m.left + iw} y1={base} y2={base} stroke={C.axis} shapeRendering="crispEdges" pointerEvents="none" />
        </svg>
      )}
      <Tooltip tip={tip} width={width} />
    </div>
  );
}
