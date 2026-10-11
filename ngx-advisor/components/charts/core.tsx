'use client';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Table2, LineChart as LineIcon } from 'lucide-react';
import clsx from 'clsx';

/* ── Palette roles (CSS variables defined in globals.css, theme-aware) ────────
   Categorical order is fixed and validated (all-pairs, both themes):
   s1 = proposed model (green), s2 = baseline 1 (blue), s3 = baseline 2 (gold). */
export const C = {
  s1: 'var(--s1)', s2: 'var(--s2)', s3: 'var(--s3)',
  muted: 'var(--mark-muted)', neg: 'var(--mark-neg)',
  grid: 'var(--grid)', axis: 'var(--axis)', band: 'var(--band)',
  ink: 'rgb(var(--ink))', ink2: 'rgb(var(--ink-2))', ink3: 'rgb(var(--ink-3))',
  surface: 'rgb(var(--surface))',
};

export type Series = { key: string; label: string; color: string; dash?: string };

/* ── Sizing ─────────────────────────────────────────────────────────────── */
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/* ── Scales & ticks ─────────────────────────────────────────────────────── */
export const linear = (d0: number, d1: number, r0: number, r1: number) =>
  (v: number) => (d1 === d0 ? r0 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0));

export function niceTicks(min: number, max: number, count = 5): number[] {
  if (min === max) return [min];
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(s => s * mag).find(s => s >= raw) ?? raw;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [+start.toFixed(10)];
  while (ticks[ticks.length - 1] < max - 1e-9) ticks.push(+(ticks[ticks.length - 1] + step).toFixed(10));
  return ticks;
}

/** Domain padded to nice tick bounds. */
export function niceDomain(values: number[], count = 5, includeZero = false): [number, number, number[]] {
  let lo = Math.min(...values), hi = Math.max(...values);
  if (includeZero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  const ticks = niceTicks(lo, hi, count);
  return [ticks[0], ticks[ticks.length - 1], ticks];
}

/** Bar path with a 4px rounded data-end and a square baseline (vertical bars). */
export function vBarPath(x: number, w: number, base: number, end: number, r = 4) {
  const h = Math.abs(end - base);
  const rr = Math.min(r, h, w / 2);
  if (h < 0.5) return '';
  if (end <= base) {
    return `M${x},${base}V${end + rr}Q${x},${end} ${x + rr},${end}H${x + w - rr}Q${x + w},${end} ${x + w},${end + rr}V${base}Z`;
  }
  return `M${x},${base}V${end - rr}Q${x},${end} ${x + rr},${end}H${x + w - rr}Q${x + w},${end} ${x + w},${end - rr}V${base}Z`;
}

/** Horizontal bar growing right from `base` to `end`, rounded at the end. */
export function hBarPath(y: number, h: number, base: number, end: number, r = 4) {
  const w = Math.abs(end - base);
  const rr = Math.min(r, w, h / 2);
  if (w < 0.5) return '';
  return `M${base},${y}H${end - rr}Q${end},${y} ${end},${y + rr}V${y + h - rr}Q${end},${y + h} ${end - rr},${y + h}H${base}Z`;
}

/* ── Tooltip ────────────────────────────────────────────────────────────── */
export type TipRow = { color?: string; label: string; value: string; kind?: 'line' | 'rect' | 'dash'; dash?: string };
export type TipState = { x: number; y: number; title: string; rows: TipRow[]; note?: string } | null;

export function Tooltip({ tip, width }: { tip: TipState; width: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(180);
  useIsoLayoutEffect(() => { if (ref.current) setW(ref.current.offsetWidth); }, [tip]);
  if (!tip) return null;
  const flip = tip.x + 16 + w > width;
  const left = flip ? Math.max(0, tip.x - 16 - w) : tip.x + 16;
  return (
    <div ref={ref} role="status"
      className="pointer-events-none absolute z-20 min-w-[150px] max-w-[260px] rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-xl"
      style={{ left, top: Math.max(0, tip.y - 12) }}>
      <div className="mb-1.5 font-medium text-ink-2">{tip.title}</div>
      <div className="space-y-1">
        {tip.rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            {r.color && <Key color={r.color} kind={r.kind ?? 'line'} dash={r.dash} />}
            <span className="tabular font-semibold text-ink">{r.value}</span>
            <span className="truncate text-ink-3">{r.label}</span>
          </div>
        ))}
      </div>
      {tip.note && <div className="mt-1.5 border-t border-line pt-1.5 text-ink-3">{tip.note}</div>}
    </div>
  );
}

function Key({ color, kind, dash }: { color: string; kind: 'line' | 'rect' | 'dash'; dash?: string }) {
  if (kind === 'rect') return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />;
  return (
    <svg width="14" height="8" className="shrink-0" aria-hidden="true">
      <line x1="1" y1="4" x2="13" y2="4" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={dash} />
    </svg>
  );
}

/* ── Legend ─────────────────────────────────────────────────────────────── */
export function Legend({ items }: { items: { label: string; color: string; kind?: 'line' | 'rect'; dash?: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-2">
      {items.map(it => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <Key color={it.color} kind={it.kind ?? 'line'} dash={it.dash} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/* ── Table view (accessible twin of every chart) ─────────────────────────── */
export type TableSpec = { columns: string[]; rows: (string | number)[][] };

function DataTable({ table }: { table: TableSpec }) {
  return (
    <div className="max-h-[420px] overflow-auto rounded-lg border border-line">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-subtle text-ink-2">
          <tr>{table.columns.map(c => <th key={c} className="whitespace-nowrap px-3 py-2 font-semibold">{c}</th>)}</tr>
        </thead>
        <tbody className="tabular text-ink">
          {table.rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              {r.map((v, j) => <td key={j} className={clsx('whitespace-nowrap px-3 py-1.5', j > 0 && 'text-ink-2')}>{v}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Chart card: title, subtitle, legend, plot, table toggle, caption ─────── */
export function ChartCard({ eyebrow, title, subtitle, legend, table, caption, children, className }: {
  eyebrow?: string; title: string; subtitle?: ReactNode; legend?: ReactNode; table?: TableSpec;
  caption?: ReactNode; children: ReactNode; className?: string;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <figure className={clsx('card flex flex-col p-5', className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
          <h3 className="text-[15px] font-semibold leading-snug text-ink">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs leading-relaxed text-ink-2">{subtitle}</p>}
        </div>
        {table && (
          <button onClick={() => setShowTable(s => !s)}
            aria-label={showTable ? 'Show chart' : 'Show data table'} title={showTable ? 'Show chart' : 'Show data table'}
            className="shrink-0 rounded-lg border border-line p-1.5 text-ink-3 transition-colors hover:bg-subtle hover:text-ink">
            {showTable ? <LineIcon className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
      {legend && !showTable && <div className="mb-3">{legend}</div>}
      <div className="flex-1">{showTable && table ? <DataTable table={table} /> : children}</div>
      {caption && <figcaption className="mt-3 text-xs leading-relaxed text-ink-3">{caption}</figcaption>}
    </figure>
  );
}

/** Figure-level heading that groups panels (a), (b), (c) of one thesis figure. */
export function FigureHeader({ num, title, children }: { num: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-4 mt-10">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="rounded-md bg-brand/10 px-2 py-0.5 text-xs font-semibold text-accent">Figure {num}</span>
        <h3 className="text-lg font-semibold tracking-tight text-ink">{title}</h3>
      </div>
      {children && <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-ink-2">{children}</p>}
    </div>
  );
}

/* ── Shared axis pieces ─────────────────────────────────────────────────── */
export const AXIS_FONT = { fontSize: 11, fill: C.ink3 } as const;

export function YGrid({ ticks, y, x0, x1, fmt, zero }: {
  ticks: number[]; y: (v: number) => number; x0: number; x1: number; fmt: (v: number) => string; zero?: boolean;
}) {
  return (
    <g>
      {ticks.map(t => (
        <g key={t}>
          <line x1={x0} x2={x1} y1={y(t)} y2={y(t)} stroke={zero && t === 0 ? C.axis : C.grid} strokeWidth={1} shapeRendering="crispEdges" />
          <text x={x0 - 8} y={y(t)} dy="0.32em" textAnchor="end" className="tabular" {...AXIS_FONT}>{fmt(t)}</text>
        </g>
      ))}
    </g>
  );
}

export function XGrid({ ticks, x, y0, y1, fmt }: {
  ticks: number[]; x: (v: number) => number; y0: number; y1: number; fmt: (v: number) => string;
}) {
  return (
    <g>
      {ticks.map(t => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={y0} y2={y1} stroke={C.grid} strokeWidth={1} shapeRendering="crispEdges" />
          <text x={x(t)} y={y1 + 16} textAnchor="middle" className="tabular" {...AXIS_FONT}>{fmt(t)}</text>
        </g>
      ))}
    </g>
  );
}

/** Pointer position relative to an element. */
export function localPoint(e: React.PointerEvent | React.MouseEvent, el: Element) {
  const r = el.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

export const fmt = {
  n: (d: number) => (v: number) => v.toFixed(d),
  pct: (d: number) => (v: number) => `${v.toFixed(d)}%`,
  signed: (d: number) => (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(d)}`,
  signedPct: (d: number) => (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(d)}%`,
  x: (d: number) => (v: number) => `${v.toFixed(d)}×`,
  compact: (v: number) => Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(v),
};
