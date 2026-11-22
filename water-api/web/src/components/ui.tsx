import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Today } from '../api';
import { t12, H } from '../format';
import { useSize } from '../hooks';

export function Pill({ tone = 'quiet', children }: { tone?: 'good' | 'warn' | 'bad' | 'live' | 'quiet'; children: ReactNode }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

export function Seg<T extends string | number>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, l]) => <button key={String(v)} aria-pressed={v === value} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  );
}

export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button className="switch" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)} />;
}

export function Dialog({ title, children, actions, onClose }: { title: string; children: ReactNode; actions: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    ref.current?.querySelector<HTMLButtonElement>('.actions .btn:last-child')?.focus();
    return () => removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-title" ref={ref}>
        <h2 id="dlg-title">{title}</h2>
        <div className="muted">{children}</div>
        <div className="actions">{actions}</div>
      </div>
    </div>
  );
}

const ToastCtx = createContext<(m: string) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number>(0);
  const show = useCallback((m: string) => { setMsg(m); clearTimeout(timer.current); timer.current = window.setTimeout(() => setMsg(null), 3200); }, []);
  return <ToastCtx.Provider value={show}>{children}{msg && <div className="toast" role="status">{msg}</div>}</ToastCtx.Provider>;
}
export const useToast = () => useContext(ToastCtx);

export function Skeleton({ h = 120 }: { h?: number }) { return <div className="skeleton" style={{ height: h }} aria-hidden />; }

/** Today on one line: supply window, pump runs, top-ups and supply checks across 24 hours. */
export function DayStrip({ today, windowText, supplyToday }: { today: Today; windowText: string | null; supplyToday: boolean }) {
  const [ref, w] = useSize<HTMLDivElement>();
  const mid = Date.parse(today.date + 'T00:00:00+05:30');
  const L = w < 480 ? 0 : 84, PW = Math.max(10, w - L - 14);
  const X = (t: number) => L + ((t - mid) / (24 * H)) * PW;
  const now = Date.now();
  let win: [number, number] | null = null;
  const m = /^(\d{1,2}):(\d{2}) (AM|PM)\s*-\s*(\d{1,2}):(\d{2}) (AM|PM)/.exec(windowText || '');
  if (m && supplyToday) {
    const tm = (h: string, mi: string, ap: string) => mid + ((Number(h) % 12) + (ap === 'PM' ? 12 : 0)) * H + Number(mi) * 60000;
    win = [tm(m[1], m[2], m[3]), tm(m[4], m[5], m[6])];
  }
  const rows = [
    { key: 'Supply', items: today.events.map((e) => ({ a: e.opened_at, b: e.closed_at ?? now, c: 'var(--water-soft)', t: `Supply ${t12(e.opened_at)} to ${e.closed_at ? t12(e.closed_at) : 'now'}` })) },
    { key: 'Main pump', items: today.runs.map((r) => ({ a: r.started_at, b: r.ended_at ?? now, c: 'var(--water)', t: `Pump ${t12(r.started_at)} to ${r.ended_at ? t12(r.ended_at) : 'now'}` })) },
    { key: 'Top-up', items: today.backup.map((r) => ({ a: r.start_at, b: r.end_at, c: 'var(--good)', t: `Submersible ${t12(r.start_at)} to ${t12(r.end_at)}` })) },
  ];
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {w > 0 && (
        <svg width={w} height={rows.length * 26 + 26} role="img" aria-label="Today's activity">
          {win && <rect x={X(win[0])} y={0} width={Math.max(2, X(win[1]) - X(win[0]))} height={rows.length * 26} fill="var(--water-soft)" opacity={0.35} rx={4} />}
          {[0, 6, 12, 18, 24].map((h) => (
            <g key={h}>
              <line x1={X(mid + h * H)} x2={X(mid + h * H)} y1={0} y2={rows.length * 26} stroke="var(--line)" />
              <text x={Math.min(Math.max(X(mid + h * H), L + 16), w - 18)} y={rows.length * 26 + 18} textAnchor="middle" fontSize={11.5} fill="var(--ink-3)">
                {h === 0 || h === 24 ? '12 AM' : h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`}
              </text>
            </g>
          ))}
          {rows.map((r, i) => (
            <g key={r.key}>
              {L > 0 && <text x={0} y={i * 26 + 17} fontSize={12.5} fill="var(--ink-2)">{r.key}</text>}
              <rect x={L} y={i * 26 + 9} width={PW} height={8} rx={4} fill="var(--surface-2)" />
              {r.items.map((it, j) => (
                <rect key={j} x={X(it.a)} y={i * 26 + 7} width={Math.max(4, X(it.b) - X(it.a))} height={12} rx={6} fill={it.c}><title>{it.t}</title></rect>
              ))}
            </g>
          ))}
          {today.probes.map((p, i) => <circle key={i} cx={X(p.ts)} cy={13} r={2.5} fill={p.good ? 'var(--good)' : 'var(--ink-3)'}><title>{`Supply check ${t12(p.ts)}: ${p.good ? 'water found' : 'no water'}`}</title></circle>)}
          <line x1={X(now)} x2={X(now)} y1={-2} y2={rows.length * 26 + 2} stroke="var(--ink)" strokeWidth={1.5} />
        </svg>
      )}
      <div className="legend" style={{ marginTop: 6 }}>
        <span><i style={{ background: 'var(--water-soft)' }} />Supply</span>
        <span><i style={{ background: 'var(--water)' }} />Main pump</span>
        <span><i style={{ background: 'var(--good)' }} />Submersible top-up</span>
        {win && <span><i style={{ background: 'var(--water-soft)', opacity: 0.5 }} />Expected window</span>}
      </div>
    </div>
  );
}
