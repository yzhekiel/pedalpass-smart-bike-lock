/**
 * Chart pieces shared by the Dashboard and Analytics (dark theme, PedalPass blue).
 * Thin marks, recessive grid, round-number axes, a hover tooltip on every chart, and labels/legends so
 * no chart relies on color alone.
 */
import React, { useState } from 'react';

/** A round axis top (1, 2, 2.5 or 5 × 10^n) and the ticks up to it. */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => +(i * step).toFixed(4));
}

/** "12%" (with `up` for the arrow) or "new" change between two periods; null when there is nothing to compare. */
export function change(current: number, previous: number): { text: string; up: boolean } | null {
  if (previous === 0) return current === 0 ? null : { text: 'new', up: true };
  const pct = ((current - previous) / previous) * 100;
  return { text: `${Math.abs(pct).toFixed(0)}%`, up: pct >= 0 };
}

function YAxis({ ticks, height }: { ticks: number[]; height: string }) {
  return (
    <div className={`flex flex-col justify-between text-[11px] text-outline text-right w-7 shrink-0 ${height}`}>
      {[...ticks].reverse().map((t) => (
        <span key={t} className="leading-none -my-[5px]">
          {t}
        </span>
      ))}
    </div>
  );
}

function Grid({ ticks }: { ticks: number[] }) {
  const top = ticks[ticks.length - 1];
  return (
    <>
      {ticks.map((t) => (
        <div key={t} className={`absolute left-0 right-0 border-t ${t === 0 ? 'border-outline-variant' : 'border-outline-variant/40'}`} style={{ bottom: `${(t / top) * 100}%` }} />
      ))}
    </>
  );
}

export type TrendPoint = { key: string; label: string; tip: string; value: number; prev?: number };

/**
 * Smooth area line for one measure over time, with an optional dashed "previous period" line on the same
 * axis. Hover anywhere for a crosshair and both values.
 */
export function TrendChart({ points, everyNth = 1, currentLabel = 'This period', prevLabel = 'Previous period' }: { points: TrendPoint[]; everyNth?: number; currentLabel?: string; prevLabel?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const hasPrev = points.some((p) => p.prev !== undefined);
  const ticks = niceTicks(Math.max(1, ...points.map((p) => Math.max(p.value, p.prev ?? 0))));
  const top = ticks[ticks.length - 1];
  const W = 600;
  const H = 200;
  const n = Math.max(1, points.length - 1);
  const x = (i: number) => (i / n) * W;
  const y = (v: number) => H - (v / top) * H;

  const smooth = (vals: number[]) => {
    const xy = vals.map((v, i) => [x(i), y(v)] as const);
    let d = `M${xy[0][0]},${xy[0][1]}`;
    for (let i = 0; i < xy.length - 1; i++) {
      const [x0, y0] = xy[Math.max(0, i - 1)];
      const [x1, y1] = xy[i];
      const [x2, y2] = xy[i + 1];
      const [x3, y3] = xy[Math.min(xy.length - 1, i + 2)];
      // Catmull-Rom → Bézier, clamped so the curve never dips below zero
      d += ` C${x1 + (x2 - x0) / 6},${Math.min(H, y1 + (y2 - y0) / 6)} ${x2 - (x3 - x1) / 6},${Math.min(H, y2 - (y3 - y1) / 6)} ${x2},${y2}`;
    }
    return d;
  };
  if (points.length === 0) return null;
  const line = smooth(points.map((p) => p.value));
  const prevLine = hasPrev ? smooth(points.map((p) => p.prev ?? 0)) : '';
  const h = hover === null ? null : points[hover];
  const at = (i: number) => `${(i / n) * 100}%`;

  return (
    <div>
      {hasPrev && (
        <div className="flex gap-4 mb-3 text-xs text-on-surface-variant">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 rounded bg-primary-light" />
            {currentLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed border-outline" />
            {prevLabel}
          </span>
        </div>
      )}
      <div className="flex gap-2">
        <YAxis ticks={ticks} height="h-52" />
        <div className="flex-1 min-w-0">
          <div
            className="relative h-52"
            onMouseMove={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              setHover(Math.max(0, Math.min(points.length - 1, Math.round(((e.clientX - box.left) / box.width) * n))));
            }}
            onMouseLeave={() => setHover(null)}
          >
            <Grid ticks={ticks} />
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible">
              <defs>
                <linearGradient id="trend-area" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary-light)" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="var(--color-primary-light)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {hasPrev && <path d={prevLine} fill="none" stroke="var(--color-outline)" strokeWidth="1.5" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />}
              <path d={`${line} L${W},${H} L0,${H} Z`} fill="url(#trend-area)" />
              <path d={line} fill="none" stroke="var(--color-primary-light)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>
            {h && hover !== null && (
              <>
                <div className="absolute top-0 bottom-0 w-px bg-outline/60 pointer-events-none" style={{ left: at(hover) }} />
                {hasPrev && h.prev !== undefined && (
                  <div className="absolute w-2.5 h-2.5 -ml-[5px] -mb-[5px] rounded-full bg-outline ring-2 ring-surface-container-lowest pointer-events-none" style={{ left: at(hover), bottom: `${(h.prev / top) * 100}%` }} />
                )}
                <div className="absolute w-3 h-3 -ml-1.5 -mb-1.5 rounded-full bg-primary-light ring-2 ring-surface-container-lowest pointer-events-none" style={{ left: at(hover), bottom: `${(h.value / top) * 100}%` }} />
                <div
                  className="absolute top-0 -translate-x-1/2 px-3 py-2 rounded-lg bg-surface-container-highest text-xs whitespace-nowrap pointer-events-none shadow-lg z-10"
                  style={{ left: `${Math.min(88, Math.max(12, (hover / n) * 100))}%` }}
                >
                  <p className="text-on-surface-variant mb-0.5">{h.tip}</p>
                  <p>
                    <b>{h.value}</b> rides
                  </p>
                  {hasPrev && h.prev !== undefined && <p className="text-on-surface-variant">{h.prev} the period before</p>}
                </div>
              </>
            )}
          </div>
          <XLabels labels={points.map((p) => p.label)} everyNth={everyNth} />
        </div>
      </div>
    </div>
  );
}

function XLabels({ labels, everyNth }: { labels: string[]; everyNth: number }) {
  return (
    <div className="flex mt-2">
      {labels.map((l, i) => (
        <span key={i} className="flex-1 min-w-0 text-[11px] text-outline text-center whitespace-nowrap overflow-visible">
          {i % everyNth === 0 ? l : ''}
        </span>
      ))}
    </div>
  );
}

/**
 * Single-measure columns: the highest one in full blue (and named), the rest softer, with a dashed average
 * line and a tooltip per column.
 */
export function ColumnChart({ items, everyNth = 1, unit = 'rides' }: { items: { key: string; label: string; tip: string; value: number }[]; everyNth?: number; unit?: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(0, ...items.map((i) => i.value));
  const ticks = niceTicks(Math.max(1, max));
  const top = ticks[ticks.length - 1];
  const avg = items.length ? items.reduce((s, i) => s + i.value, 0) / items.length : 0;
  const peak = items.find((i) => i.value === max && max > 0);

  return (
    <div>
      <div className="flex gap-2">
        <YAxis ticks={ticks} height="h-44" />
        <div className="flex-1 min-w-0">
          <div className="relative h-44">
            <Grid ticks={ticks} />
            {avg > 0 && (
              <div className="absolute left-0 right-0 border-t border-dashed border-tertiary/70 pointer-events-none z-[1]" style={{ bottom: `${(avg / top) * 100}%` }}>
                <span className="absolute right-0 -top-4 text-[10px] text-tertiary">avg {avg.toFixed(1)}</span>
              </div>
            )}
            <div className="absolute inset-0 flex items-end gap-[3px]">
              {items.map((i) => (
                <div
                  key={i.key}
                  className="relative flex-1 h-full flex items-end cursor-default"
                  onMouseEnter={() => setHover(i.key)}
                  onMouseLeave={() => setHover(null)}
                >
                  <div
                    style={{ height: `${(i.value / top) * 100}%`, minHeight: i.value ? 3 : 0 }}
                    className={`w-full rounded-t ${i === peak ? 'bg-primary-light' : hover === i.key ? 'bg-primary-light/80' : 'bg-primary-light/45'}`}
                  />
                  {hover === i.key && (
                    <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 rounded-lg bg-surface-container-highest text-xs whitespace-nowrap shadow-lg z-10">
                      <span className="text-on-surface-variant">{i.tip}:</span> <b>{i.value}</b> {unit}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <XLabels labels={items.map((i) => i.label)} everyNth={everyNth} />
        </div>
      </div>
      {peak && (
        <p className="text-xs text-on-surface-variant mt-2">
          Busiest: <b className="text-on-surface">{peak.tip}</b> with {peak.value} {unit}
        </p>
      )}
    </div>
  );
}

/** Ranked horizontal bars with the value at the end; `onOpen` makes the label a link. */
export function BarList({
  items,
  onOpen,
  empty,
  mono = true,
}: {
  items: { id: string; label?: string; value: number; valueText: string; note?: string }[];
  onOpen?: (id: string) => void;
  empty: string;
  mono?: boolean;
}) {
  if (!items.length) return <p className="text-sm text-on-surface-variant py-6 text-center">{empty}</p>;
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.id}>
          <div className="grid grid-cols-[88px_1fr_auto] items-center gap-3 text-sm">
            {onOpen ? (
              <button onClick={() => onOpen(i.id)} className={`text-left font-semibold text-primary-light hover:underline truncate ${mono ? 'font-mono' : ''}`}>
                {i.label ?? i.id}
              </button>
            ) : (
              <span className={`font-semibold truncate ${mono ? 'font-mono' : ''}`}>{i.label ?? i.id}</span>
            )}
            <div className="h-2.5 rounded-full bg-surface-container overflow-hidden">
              <div style={{ width: `${(i.value / max) * 100}%` }} className="h-full rounded-full bg-primary-light" />
            </div>
            <span className="text-xs text-on-surface-variant whitespace-nowrap text-right min-w-[64px]">{i.valueText}</span>
          </div>
          {i.note && <p className="text-xs text-on-surface-variant mt-1 ml-[100px]">{i.note}</p>}
        </li>
      ))}
    </ul>
  );
}

/** Ring chart; the parts are labelled next to it, so color never carries meaning alone. */
export function Donut({ parts, center, caption, size = 110 }: { parts: { value: number; color: string; label: string }[]; center: string; caption: string; size?: number }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const r = 40;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(', ')} className="shrink-0">
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-surface-container-high)" strokeWidth="11" />
      {total > 0 &&
        parts.map((p) => {
          const len = (p.value / total) * c;
          const el = (
            <circle
              key={p.label}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={p.color}
              strokeWidth="11"
              strokeLinecap={len > 4 ? 'round' : 'butt'}
              strokeDasharray={`${Math.max(0, len - (parts.length > 1 && len > 4 ? 3 : 0))} ${c}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 50 50)"
            >
              <title>{`${p.label}: ${p.value}`}</title>
            </circle>
          );
          offset += len;
          return el;
        })}
      <text x="50" y="49" textAnchor="middle" className="fill-on-surface" fontSize="17" fontWeight="700">
        {center}
      </text>
      <text x="50" y="63" textAnchor="middle" className="fill-on-surface-variant" fontSize="9">
        {caption}
      </text>
    </svg>
  );
}
