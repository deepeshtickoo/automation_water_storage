import { useMemo, useState } from 'react';
import { api } from '../api';
import { usePoll } from '../hooks';
import { Chart, type Band } from '../components/Chart';
import { Seg, Skeleton } from '../components/ui';
import { dur, num } from '../format';

export function Trends() {
  const [hours, setHours] = useState(72);
  const { data, error } = usePoll(() => api.history(hours), 120000, [hours]);
  const to = Date.now(), from = to - hours * 3600000;
  const bands: Band[] = useMemo(() => (data?.runs ?? []).map((r) => ({ from: r.started_at, to: r.ended_at ?? Date.now(), color: 'color-mix(in srgb, var(--water) 10%, transparent)' })), [data]);
  const pts = data?.points ?? [];
  const pumping = pts.filter((p) => (p.pump_w ?? 0) > 200);
  const stats = useMemo(() => {
    if (!data) return null;
    const runMin = data.runs.reduce((s, r) => s + (r.minutes ?? 0), 0);
    const tds = pumping.map((p) => p.tds).filter((v): v is number => v != null);
    const flow = pumping.map((p) => p.flow).filter((v): v is number => v != null && v > 1);
    const med = (a: number[]) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
    return { runMin, tds: med(tds), flow: med(flow), kwh: (runMin / 60) * 1.25 };
  }, [data, pumping]);

  return (
    <>
      <div className="page-head">
        <div><h1>Trends</h1><p className="muted">Tank level, water quality and pump power over time. Shaded areas are pump runs.</p></div>
        <Seg label="Range" value={hours} onChange={setHours} options={[[24, '24 h'], [72, '3 days'], [168, '7 days'], [720, '30 days']]} />
      </div>
      {error && <p className="err">Couldn't load readings: {error}</p>}
      {!data ? <Skeleton h={320} /> : (
        <>
          <div className="facts">
            <div className="fact"><div className="k">Pump time</div><div className="v">{dur(stats?.runMin)}</div><div className="d">about {num(stats?.kwh, 1)} kWh</div></div>
            <div className="fact"><div className="k">Typical TDS while pumping</div><div className="v">{num(stats?.tds)} ppm</div><div className="d">Clean supply reads 110 to 150</div></div>
            <div className="fact"><div className="k">Typical flow while pumping</div><div className="v">{num(stats?.flow)} L/min</div><div className="d">Lower at peak hours</div></div>
          </div>

          <section className="section panel">
            <div className="panel-head"><h3>Tank level</h3><span className="faint small">Percent of 6,000 L</span></div>
            <Chart label="Tank level over time" points={pts.map((p) => ({ ts: p.ts, v: p.tank }))} min={0} max={100} unit="%" bands={bands} from={from} to={to} height={240}
              refLines={[{ v: 92, label: 'Pump stops' }]} />
          </section>
          <div className="two section">
            <div className="panel">
              <div className="panel-head"><h3>Water quality</h3><span className="faint small">TDS while pumping, ppm</span></div>
              <Chart label="TDS while pumping" points={pumping.map((p) => ({ ts: p.ts, v: p.tds }))} min={0} color="var(--good)" area={false} unit=" ppm" from={from} to={to} bands={bands} />
            </div>
            <div className="panel">
              <div className="panel-head"><h3>Incoming flow</h3><span className="faint small">L/min</span></div>
              <Chart label="Incoming flow" points={pts.map((p) => ({ ts: p.ts, v: p.flow }))} min={0} color="var(--water)" unit=" L/min" from={from} to={to} />
            </div>
          </div>
          <section className="section panel">
            <div className="panel-head"><h3>Main pump power</h3><span className="faint small">Watts</span></div>
            <Chart label="Main pump power" points={pts.map((p) => ({ ts: p.ts, v: p.pump_w }))} min={0} color="var(--ink-2)" unit=" W" from={from} to={to} height={160} />
          </section>
        </>
      )}
    </>
  );
}
