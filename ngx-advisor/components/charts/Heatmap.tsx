'use client';
import { useState } from 'react';
import { C, Tooltip, TipState, useWidth, localPoint } from './core';

const LIMIT = 0.8;

/** Diverging colour: blue (negative) <- neutral grey at 0 -> red (positive). Theme-aware via CSS vars. */
export function divColor(v: number) {
  const t = Math.min(1, Math.abs(v) / LIMIT);
  const pole = v >= 0 ? 'var(--div-pos)' : 'var(--div-neg)';
  return `color-mix(in oklab, ${pole} ${(t * 100).toFixed(0)}%, var(--div-mid))`;
}

export function DivergingLegend() {
  const steps = [-0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8];
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-ink-2">
      <span>Pearson ρ</span>
      <div className="flex items-end gap-[2px]">
        {steps.map(s => (
          <div key={s} className="flex flex-col items-center gap-1">
            <span className="block h-3 w-7 rounded-[3px]" style={{ background: divColor(s) }} />
            <span className="tabular text-[10px] text-ink-3">{s > 0 ? `+${s}` : s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Heatmap({ symbols, matrix, sectors, ariaLabel }: {
  symbols: readonly string[]; matrix: readonly (readonly (number | null)[])[];
  sectors: readonly { name: string; size: number }[]; ariaLabel: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<[number, number] | null>(null);
  const [pt, setPt] = useState({ x: 0, y: 0 });
  const n = symbols.length;
  const left = 84, top = 22, bottom = 82;
  const cs = Math.max(11, Math.min(18, Math.floor((width - left - 8) / n)));
  const size = cs * n;
  const svgW = left + size + 8;
  const svgH = top + size + bottom;

  const sectorOf: string[] = [];
  const bounds: number[] = [0];
  sectors.forEach(s => { for (let i = 0; i < s.size; i++) sectorOf.push(s.name); bounds.push(bounds[bounds.length - 1] + s.size); });

  const tip: TipState = hover == null ? null : (() => {
    const [r, c] = hover;
    const v = matrix[r][c];
    return {
      x: pt.x, y: pt.y,
      title: `${symbols[r]} × ${symbols[c]}`,
      rows: [{ color: v == null ? undefined : divColor(v), kind: 'rect' as const, label: 'Pearson ρ', value: v == null ? 'n/a' : v.toFixed(2) }],
      note: sectorOf[r] === sectorOf[c] ? `Within ${sectorOf[r]}` : `${sectorOf[r]} vs ${sectorOf[c]}`,
    };
  })();

  return (
    <div ref={ref} className="relative w-full overflow-x-auto" role="img" aria-label={ariaLabel}>
      {width > 0 && (
        <svg width={svgW} height={svgH} className="block select-none" onPointerLeave={() => setHover(null)}
          onPointerMove={e => {
            const p = localPoint(e, e.currentTarget);
            const c = Math.floor((p.x - left) / cs), r = Math.floor((p.y - top) / cs);
            if (r >= 0 && r < n && c >= 0 && c < n) { setHover([r, c]); setPt(p); } else setHover(null);
          }}>
          {/* Sector names above each block */}
          {sectors.map((s, i) => (
            <text key={s.name} x={left + (bounds[i] + s.size / 2) * cs} y={top - 8} textAnchor="middle"
              fontSize={10.5} fontWeight={600} fill={C.ink2}>{s.name}</text>
          ))}

          {matrix.map((row, r) => row.map((v, c) => (
            <rect key={`${r}-${c}`} x={left + c * cs} y={top + r * cs} width={cs - 1} height={cs - 1}
              style={{ fill: v == null ? 'transparent' : divColor(v) }} />
          )))}

          {/* Sector blocks */}
          {sectors.map((s, i) => (
            <rect key={s.name + 'b'} x={left + bounds[i] * cs - 0.5} y={top + bounds[i] * cs - 0.5}
              width={s.size * cs} height={s.size * cs} fill="none" stroke={C.ink} strokeOpacity={0.55} strokeWidth={1.25} pointerEvents="none" />
          ))}

          {symbols.map((s, i) => {
            const on = hover != null && (hover[0] === i || hover[1] === i);
            return (
              <g key={s}>
                <text x={left - 6} y={top + i * cs + cs / 2} dy="0.32em" textAnchor="end" fontSize={9.5}
                  fill={on ? C.ink : C.ink3} fontWeight={on ? 700 : 400}>{s}</text>
                <text transform={`translate(${left + i * cs + cs / 2},${top + size + 6}) rotate(-90)`} dy="0.32em" textAnchor="end"
                  fontSize={9.5} fill={on ? C.ink : C.ink3} fontWeight={on ? 700 : 400}>{s}</text>
              </g>
            );
          })}

          {hover && (
            <g pointerEvents="none">
              <rect x={left} y={top + hover[0] * cs - 0.5} width={size} height={cs} fill="none" stroke={C.ink} strokeOpacity={0.35} />
              <rect x={left + hover[1] * cs - 0.5} y={top} width={cs} height={size} fill="none" stroke={C.ink} strokeOpacity={0.35} />
              <rect x={left + hover[1] * cs - 1} y={top + hover[0] * cs - 1} width={cs + 1} height={cs + 1} fill="none" stroke={C.ink} strokeWidth={2} />
            </g>
          )}
        </svg>
      )}
      <Tooltip tip={tip} width={Math.max(width, svgW)} />
    </div>
  );
}
