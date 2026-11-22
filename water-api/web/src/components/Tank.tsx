import { useEffect, useId, useState } from 'react';

interface Props {
  pct: number | null;
  stopAt: number;
  topUpBelow: number;
  projected: number | null; // level expected when the next supply arrives
  filling: boolean;
  draining?: boolean;
}

const VW = 290, X = 6, W = 168, TOP = 8, HGT = 300, R = 20;
const y = (p: number) => TOP + HGT * (1 - Math.max(0, Math.min(100, p)) / 100);

/** The tank, drawn as a cross-section with its working marks. */
export function Tank({ pct, stopAt, topUpBelow, projected, filling }: Props) {
  const id = useId().replace(/:/g, '');
  const [shown, setShown] = useState(0);
  useEffect(() => { const t = requestAnimationFrame(() => setShown(pct ?? 0)); return () => cancelAnimationFrame(t); }, [pct]);
  const level = y(shown);
  const wave = (amp: number, len: number) => {
    let d = `M ${X - len} ${0}`;
    for (let x = X - len; x <= X + W + len; x += len / 2) d += ` q ${len / 4} ${-amp} ${len / 2} 0 t ${len / 2} 0`;
    return d + ` V ${HGT + 40} H ${X - len} Z`;
  };
  const mark = (p: number, text: string, tone: string, dashed = true) => (
    <g>
      <line x1={X} x2={X + W + 8} y1={y(p)} y2={y(p)} stroke={tone} strokeWidth={1.25} strokeDasharray={dashed ? '4 4' : undefined} />
      <text x={X + W + 14} y={y(p) + 4} fontSize={12} fill="var(--ink-2)" fontFamily="var(--text)">{text}</text>
    </g>
  );
  return (
    <svg viewBox={`0 0 ${VW} ${HGT + TOP * 2}`} role="img" aria-label={pct == null ? 'Tank level unavailable' : `Tank at ${Math.round(pct)} percent`} style={{ width: '100%', height: 'auto', maxHeight: 380 }}>
      <defs>
        <clipPath id={`c${id}`}><rect x={X} y={TOP} width={W} height={HGT} rx={R} /></clipPath>
        <linearGradient id={`g${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--water)" stopOpacity="0.92" />
          <stop offset="1" stopColor="var(--water-deep)" stopOpacity="1" />
        </linearGradient>
      </defs>
      <rect x={X} y={TOP} width={W} height={HGT} rx={R} fill="var(--surface-2)" />
      <g clipPath={`url(#c${id})`}>
        {[25, 50, 75].map((p) => <line key={p} x1={X} x2={X + 14} y1={y(p)} y2={y(p)} stroke="var(--line)" strokeWidth={1.5} />)}
        <g style={{ transform: `translateY(${level}px)`, transition: 'transform 1.4s cubic-bezier(.2,.7,.2,1)' }}>
          <path d={wave(4, 84)} fill="var(--water-soft)" className={filling ? 'wave fast' : 'wave'} style={{ opacity: 0.9 }} />
          <g transform="translate(0 4)"><path d={wave(3, 120)} fill={`url(#g${id})`} className={filling ? 'wave rev fast' : 'wave rev'} /></g>
        </g>
        {filling && (
          <g className="inflow" stroke="#fff" strokeOpacity={0.55} strokeWidth={2} strokeLinecap="round">
            <line x1={X + W / 2} x2={X + W / 2} y1={TOP} y2={level - 4} strokeDasharray="2 9" />
          </g>
        )}
      </g>
      <rect x={X} y={TOP} width={W} height={HGT} rx={R} fill="none" stroke="var(--line)" strokeWidth={1.5} />
      {mark(stopAt, `Stops at ${stopAt}%`, 'var(--ink-3)')}
      {mark(topUpBelow, `Top-up below ${topUpBelow}%`, 'var(--warn)')}
      {projected != null && pct != null && Math.abs(projected - pct) > 3 && (
        <g>
          <line x1={X} x2={X + W + 8} y1={y(projected)} y2={y(projected)} stroke="var(--water)" strokeWidth={1.5} strokeDasharray="1 4" strokeLinecap="round" />
          <text x={X + W + 14} y={y(projected) - 2} fontSize={12} fill="var(--water)" fontFamily="var(--text)" fontWeight={600}>At next supply</text>
          <text x={X + W + 14} y={y(projected) + 13} fontSize={12} fill="var(--water)" fontFamily="var(--text)">about {Math.round(projected)}%</text>
        </g>
      )}
      <style>{`
        .wave { animation: drift 7s linear infinite; }
        .wave.rev { animation-name: drift2; animation-direction: reverse; animation-duration: 9s; }
        .wave.fast { animation-duration: 3.2s; }
        .wave.rev.fast { animation-duration: 4.2s; }
        .inflow line { animation: pour .6s linear infinite; }
        @keyframes drift { to { transform: translateX(84px); } }
        @keyframes drift2 { to { transform: translateX(120px); } }
        @keyframes pour { to { stroke-dashoffset: -11; } }
      `}</style>
    </svg>
  );
}
