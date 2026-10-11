'use client';
import { useMemo, useState } from 'react';
import { C, Series, Tooltip, TipState, YGrid, AXIS_FONT, linear, niceDomain, useWidth, localPoint } from './core';

type Datum = Record<string, number | string | null>;

export type LineChartProps = {
  data: readonly Datum[];
  series: Series[];
  /** Numeric x field; defaults to the row index. Must be ascending. */
  xKey?: string;
  xTicks: { value: number; label: string }[];
  xDomain?: [number, number];
  yFormat: (v: number) => string;
  valueFormat?: (v: number) => string;
  yDomain?: [number, number];
  yTickCount?: number;
  height?: number;
  tipTitle: (d: Datum, i: number) => string;
  tipNote?: (d: Datum, i: number) => string | undefined;
  area?: boolean;
  bands?: { x0: number; x1: number; label?: string }[];
  refLines?: { y: number; label: string }[];
  markers?: boolean;
  endLabels?: boolean;
  showXAxis?: boolean;
  /** Controlled hover index - lets stacked panels share one crosshair. */
  hover?: number | null;
  onHover?: (i: number | null) => void;
  ariaLabel: string;
};

export function LineChart(p: LineChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [localHover, setLocalHover] = useState<number | null>(null);
  const [pointerY, setPointerY] = useState(0);
  const hover = p.hover !== undefined ? p.hover : localHover;
  const setHover = (i: number | null) => { setLocalHover(i); p.onHover?.(i); };

  const height = p.height ?? 260;
  const showX = p.showXAxis ?? true;
  const vf = p.valueFormat ?? p.yFormat;

  const xs = useMemo(() => p.data.map((d, i) => (p.xKey ? Number(d[p.xKey]) : i)), [p.data, p.xKey]);
  const [y0, y1, yTicks] = useMemo(() => {
    if (p.yDomain) {
      const [, , t] = niceDomain([...p.yDomain], p.yTickCount ?? 5);
      return [p.yDomain[0], p.yDomain[1], t.filter(v => v >= p.yDomain![0] - 1e-9 && v <= p.yDomain![1] + 1e-9)];
    }
    const vals = p.data.flatMap(d => p.series.map(s => d[s.key])).filter((v): v is number => typeof v === 'number');
    return niceDomain(vals, p.yTickCount ?? 5, p.area);
  }, [p.data, p.series, p.yDomain, p.yTickCount, p.area]);

  const labelW = Math.max(...yTicks.map(t => p.yFormat(t).length)) * 6.6 + 14;
  const m = { top: 14, right: p.endLabels ? 52 : 14, bottom: showX ? 30 : 10, left: Math.max(36, labelW) };
  const iw = Math.max(0, width - m.left - m.right);
  const ih = height - m.top - m.bottom;
  const [xd0, xd1] = p.xDomain ?? [xs[0], xs[xs.length - 1]];
  const x = linear(xd0, xd1, m.left, m.left + iw);
  const y = linear(y0, y1, m.top + ih, m.top);

  const paths = useMemo(() => p.series.map(s => {
    let d = '', area = '', run: [number, number][] = [];
    const flush = () => {
      if (run.length) {
        d += 'M' + run.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join('L');
        area += `M${run[0][0].toFixed(1)},${y(Math.max(y0, 0))}L` + run.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join('L') + `L${run[run.length - 1][0].toFixed(1)},${y(Math.max(y0, 0))}Z`;
      }
      run = [];
    };
    p.data.forEach((row, i) => {
      const v = row[s.key];
      if (typeof v === 'number') run.push([x(xs[i]), y(v)]); else flush();
    });
    flush();
    return { s, d, area };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [p.data, p.series, width, y0, y1, xd0, xd1]);

  // End labels only when they don't collide; otherwise the legend + tooltip carry identity.
  const ends = useMemo(() => {
    if (!p.endLabels) return [];
    const last = p.data[p.data.length - 1];
    const pts = p.series.map(s => ({ s, v: last[s.key] as number, y: y(last[s.key] as number) })).sort((a, b) => a.y - b.y);
    return pts.every((pt, i) => i === 0 || pt.y - pts[i - 1].y >= 13) ? pts : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.data, p.series, p.endLabels, width, y0, y1]);

  function nearest(px: number) {
    const target = xd0 + ((px - m.left) / iw) * (xd1 - xd0);
    let lo = 0, hi = xs.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xs[mid] < target) lo = mid; else hi = mid; }
    return Math.abs(xs[lo] - target) <= Math.abs(xs[hi] - target) ? lo : hi;
  }

  const hv = hover != null && hover >= 0 && hover < p.data.length ? hover : null;
  const tip: TipState = hv == null || p.hover !== undefined && localHover == null ? null : {
    x: x(xs[hv]), y: pointerY,
    title: p.tipTitle(p.data[hv], hv),
    rows: p.series.map(s => {
      const v = p.data[hv][s.key];
      return { color: s.color, dash: s.dash, label: s.label, value: typeof v === 'number' ? vf(v) : '–' };
    }),
    note: p.tipNote?.(p.data[hv], hv),
  };

  return (
    <div ref={ref} className="relative w-full select-none outline-none" style={{ height }}
      tabIndex={0} role="img" aria-label={p.ariaLabel}
      onKeyDown={e => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          const cur = hv ?? (e.key === 'ArrowRight' ? -1 : p.data.length);
          setPointerY(m.top + 10);
          setHover(Math.min(p.data.length - 1, Math.max(0, cur + (e.key === 'ArrowRight' ? 1 : -1))));
        }
      }}
      onBlur={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} className="block overflow-visible"
          onPointerMove={e => { const pt = localPoint(e, e.currentTarget); setPointerY(pt.y); setHover(nearest(pt.x)); }}
          onPointerLeave={() => setHover(null)}>

          {p.bands?.map((b, i) => (
            <g key={i}>
              <rect x={x(b.x0)} y={m.top} width={Math.max(0, x(b.x1) - x(b.x0))} height={ih} fill={C.band} />
              {b.label && (
                <text x={x(b.x0) + 6} y={m.top + 12} fontSize={10.5} fontWeight={500} fill={C.ink2}>{b.label}</text>
              )}
            </g>
          ))}

          <YGrid ticks={yTicks} y={y} x0={m.left} x1={m.left + iw} fmt={p.yFormat} zero />

          {showX && (
            <g>
              <line x1={m.left} x2={m.left + iw} y1={m.top + ih} y2={m.top + ih} stroke={C.axis} shapeRendering="crispEdges" />
              {p.xTicks.map(t => (
                <g key={t.value}>
                  <line x1={x(t.value)} x2={x(t.value)} y1={m.top + ih} y2={m.top + ih + 4} stroke={C.axis} />
                  <text x={x(t.value)} y={m.top + ih + 18} textAnchor="middle" className="tabular" {...AXIS_FONT}>{t.label}</text>
                </g>
              ))}
            </g>
          )}

          {p.refLines?.map(r => (
            <g key={r.label}>
              <line x1={m.left} x2={m.left + iw} y1={y(r.y)} y2={y(r.y)} stroke={C.ink3} strokeWidth={1} strokeDasharray="4 4" />
              <text x={m.left + iw} y={y(r.y) - 5} textAnchor="end" fontSize={10.5} fill={C.ink2}>{r.label}</text>
            </g>
          ))}

          {p.area && paths.map(({ s, area }) => <path key={s.key + 'a'} d={area} fill={s.color} opacity={0.12} />)}
          {paths.map(({ s, d }) => (
            <path key={s.key} d={d} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dash}
              strokeLinejoin="round" strokeLinecap="round" />
          ))}

          {p.markers && p.series.map(s => p.data.map((row, i) => typeof row[s.key] === 'number' && (
            <circle key={s.key + i} cx={x(xs[i])} cy={y(row[s.key] as number)} r={4.5} fill={s.color} stroke={C.surface} strokeWidth={2} />
          )))}

          {ends.map(e => (
            <text key={e.s.key} x={m.left + iw + 8} y={e.y} dy="0.32em" fontSize={11} fontWeight={600} fill={C.ink} className="tabular">
              {vf(e.v)}
            </text>
          ))}

          {hv != null && (
            <g pointerEvents="none">
              <line x1={x(xs[hv])} x2={x(xs[hv])} y1={m.top} y2={m.top + ih} stroke={C.ink3} strokeWidth={1} />
              {p.series.map(s => typeof p.data[hv][s.key] === 'number' && (
                <circle key={s.key} cx={x(xs[hv])} cy={y(p.data[hv][s.key] as number)} r={5} fill={s.color} stroke={C.surface} strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>
      )}
      <Tooltip tip={tip} width={width} />
    </div>
  );
}
