import { useMemo, useState } from 'react';
import { useSize } from '../hooks';
import { t12, dayLabel } from '../format';

export interface Band { from: number; to: number; color: string; label?: string }

interface Props {
  points: { ts: number; v: number | null }[];
  height?: number;
  color?: string;
  area?: boolean;
  min?: number;
  max?: number;
  unit?: string;
  decimals?: number;
  bands?: Band[];
  refLines?: { v: number; label: string }[];
  from?: number;
  to?: number;
  label: string;
}

const PAD = { l: 40, r: 8, t: 10, b: 24 };

export function Chart({ points, height = 200, color = 'var(--water)', area = true, min, max, unit = '', decimals = 0, bands = [], refLines = [], from, to, label }: Props) {
  const [ref, w] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pts = useMemo(() => points.filter((p) => p.v != null && Number.isFinite(p.v)) as { ts: number; v: number }[], [points]);
  const t0 = from ?? pts[0]?.ts ?? Date.now() - 86400000, t1 = to ?? pts[pts.length - 1]?.ts ?? Date.now();
  const vals = pts.map((p) => p.v);
  const lo = min ?? Math.floor(Math.min(...vals, Infinity));
  let hi = max ?? Math.ceil(Math.max(...vals, -Infinity));
  if (!Number.isFinite(hi) || hi <= lo) hi = lo + 1;
  const iw = Math.max(10, w - PAD.l - PAD.r), ih = height - PAD.t - PAD.b;
  const X = (t: number) => PAD.l + ((t - t0) / (t1 - t0 || 1)) * iw;
  const Y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * ih;

  // Break the line where readings are missing for more than 20 minutes.
  const path = useMemo(() => {
    let d = '', a = '', segStart = -1;
    pts.forEach((p, i) => {
      const gap = i > 0 && p.ts - pts[i - 1].ts > 20 * 60000;
      if (i === 0 || gap) {
        if (segStart >= 0) a += ` L${X(pts[i - 1].ts).toFixed(1)},${(PAD.t + ih).toFixed(1)} Z`;
        d += ` M${X(p.ts).toFixed(1)},${Y(p.v).toFixed(1)}`;
        a += ` M${X(p.ts).toFixed(1)},${(PAD.t + ih).toFixed(1)} L${X(p.ts).toFixed(1)},${Y(p.v).toFixed(1)}`;
        segStart = i;
      } else {
        d += ` L${X(p.ts).toFixed(1)},${Y(p.v).toFixed(1)}`;
        a += ` L${X(p.ts).toFixed(1)},${Y(p.v).toFixed(1)}`;
      }
    });
    if (pts.length) a += ` L${X(pts[pts.length - 1].ts).toFixed(1)},${(PAD.t + ih).toFixed(1)} Z`;
    return { d, a };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pts, w, height, lo, hi, t0, t1]);

  const span = t1 - t0;
  // Ticks on round local times: every few hours for short ranges, midnights for longer ones.
  const IST = 19800000, HR = 3600000, DAY = 86400000;
  const maxTicks = Math.max(2, Math.floor(iw / 80));
  const steps = [3 * HR, 6 * HR, 12 * HR, DAY, 2 * DAY, 7 * DAY];
  const step = steps.find((st) => span / st <= maxTicks) ?? 7 * DAY;
  const xt: number[] = [];
  for (let t = Math.ceil((t0 + IST) / step) * step - IST; t <= t1; t += step) xt.push(t);
  const yt = [0, 0.5, 1].map((f) => lo + f * (hi - lo));
  const xLabel = (t: number) => (step >= DAY ? dayLabel(t).replace(/ \w+$/, '') : t12(t).replace(':00', ''));

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!pts.length) return;
    const r = e.currentTarget.getBoundingClientRect();
    const t = t0 + ((e.clientX - r.left - PAD.l) / iw) * span;
    let best = 0, bd = Infinity;
    for (let i = 0; i < pts.length; i++) { const dd = Math.abs(pts[i].ts - t); if (dd < bd) { bd = dd; best = i; } }
    setHover(best);
  };
  const hp = hover != null ? pts[hover] : null;
  const fmt = (v: number) => v.toFixed(decimals) + unit;

  return (
    <div className="chart" ref={ref}>
      {w > 0 && (
        <svg height={height} viewBox={`0 0 ${w} ${height}`} role="img" aria-label={label} onPointerMove={onMove} onPointerLeave={() => setHover(null)} style={{ touchAction: 'pan-y' }}>
          {bands.map((b, i) => {
            const x1 = Math.max(PAD.l, X(b.from)), x2 = Math.min(PAD.l + iw, X(b.to));
            return x2 > x1 ? <rect key={i} x={x1} y={PAD.t} width={Math.max(1.5, x2 - x1)} height={ih} fill={b.color} rx={2} /> : null;
          })}
          <g className="grid">{yt.map((v, i) => <line key={i} x1={PAD.l} x2={PAD.l + iw} y1={Y(v)} y2={Y(v)} />)}</g>
          <g className="axis">
            {yt.map((v, i) => <text key={i} x={PAD.l - 8} y={Y(v) + 4} textAnchor="end">{Math.round(v)}{unit.trim() === '%' ? '%' : ''}</text>)}
            {xt.map((t, i) => <text key={i} x={X(t)} y={height - 6} textAnchor={X(t) < PAD.l + 20 ? 'start' : X(t) > PAD.l + iw - 20 ? 'end' : 'middle'}>{xLabel(t)}</text>)}
          </g>
          {refLines.map((r, i) => (
            <g key={i}>
              <line x1={PAD.l} x2={PAD.l + iw} y1={Y(r.v)} y2={Y(r.v)} stroke="var(--ink-3)" strokeDasharray="3 4" />
              <text x={PAD.l + iw} y={Y(r.v) - 5} textAnchor="end" fontSize={11.5} fill="var(--ink-3)">{r.label}</text>
            </g>
          ))}
          {area && <path d={path.a} fill={color} opacity={0.12} />}
          <path d={path.d} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
          {hp && (
            <g>
              <line x1={X(hp.ts)} x2={X(hp.ts)} y1={PAD.t} y2={PAD.t + ih} stroke="var(--ink-3)" />
              <circle cx={X(hp.ts)} cy={Y(hp.v)} r={4} fill="var(--surface)" stroke={color} strokeWidth={2} />
            </g>
          )}
        </svg>
      )}
      {hp && w > 0 && (
        <div className="tip" style={{ left: Math.min(Math.max(X(hp.ts), 70), w - 70) }}>
          <b>{fmt(hp.v)}</b> <span style={{ opacity: 0.75 }}>{span > 86400000 ? dayLabel(hp.ts) + ', ' : ''}{t12(hp.ts)}</span>
        </div>
      )}
      {!pts.length && <p className="faint small" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>No readings in this period.</p>}
    </div>
  );
}
