import { useState } from 'react';
import { api, type Events } from '../api';
import { usePoll } from '../hooks';
import { Pill, Seg, Skeleton } from '../components/ui';
import { dayLabel, dur, istDate, num, pct, t12, gradeText, gradeTone, relDay } from '../format';

function Calendar({ data }: { data: Events }) {
  const today = istDate(Date.now());
  const byDate = new Map(data.supply.map((s) => [s.date, s]));
  const evByDate = new Map<string, string | null>();
  data.events.forEach((e) => { const d = istDate(e.opened_at); if (!evByDate.has(d) || e.grade === 'successful') evByDate.set(d, e.grade); });
  // 8 weeks, Monday first, ending this week.
  const end = new Date(today + 'T12:00:00+05:30');
  const dow = (end.getUTCDay() + 6) % 7;
  const start = end.getTime() - (7 * 7 + dow) * 86400000;
  const cols: string[][] = [];
  for (let c = 0; c < 8; c++) cols.push(Array.from({ length: 7 }, (_, r) => istDate(start + (c * 7 + r) * 86400000)));
  const wd = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <div className="cal" style={{ gridTemplateColumns: 'auto' }}>
        <div className="wd" />
        {wd.map((w, i) => <div key={i} className="wd" style={{ height: 26 }}>{w}</div>)}
      </div>
      <div className="cal">
        {cols.map((col, ci) => [
          <div key={`h${ci}`} className="wd">{new Date(col[0] + 'T12:00:00Z').getUTCDate() <= 7 || ci === 0 ? new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(new Date(col[0])) : ''}</div>,
          ...col.map((d) => {
            const s = byDate.get(d), g = evByDate.get(d);
            const cls = d > today ? 'future' : g === 'successful' ? 'filled' : g ? 'short' : s?.supply_day ? 'supply' : '';
            const title = `${dayLabel(Date.parse(d + 'T12:00:00+05:30'))}: ${d > today ? 'upcoming' : g ? gradeText[g] ?? g : s?.supply_day ? 'supply came' : 'no supply'}`;
            return <div key={d} className={`cell ${cls} ${d === today ? 'today' : ''}`} title={title} aria-label={title} />;
          }),
        ])}
      </div>
    </div>
  );
}

export function Supply() {
  const [days, setDays] = useState(30);
  const { data, error } = usePoll(() => api.events(Math.max(days, 56)), 120000, [days]);
  const since = Date.now() - days * 86400000;
  const evs = data?.events.filter((e) => e.opened_at >= since) ?? [];
  const supplyDays = data?.supply.filter((s) => Date.parse(s.date) >= since && s.supply_day).length ?? 0;
  const filled = evs.filter((e) => e.grade === 'successful').length;
  const pumped = evs.reduce((s, e) => s + (e.pumped_min ?? 0), 0);
  const kwh = data?.daily.filter((d) => Date.parse(d.date) >= since).reduce((s, d) => s + (d.kwh ?? 0), 0) ?? 0;

  return (
    <>
      <div className="page-head">
        <div><h1>Supply</h1><p className="muted">When the municipal water came, and how each fill went.</p></div>
        <Seg label="Period" value={days} onChange={setDays} options={[[14, '2 weeks'], [30, '30 days'], [56, '8 weeks']]} />
      </div>
      {error && <p className="err">Couldn't load supply history: {error}</p>}
      {!data ? <Skeleton h={300} /> : (
        <>
          <div className="facts">
            <div className="fact"><div className="k">Supply days</div><div className="v">{supplyDays}</div><div className="d">in the last {days} days</div></div>
            <div className="fact"><div className="k">Filled to target</div><div className="v">{filled} of {evs.length}</div><div className="d">supply events</div></div>
            <div className="fact"><div className="k">Pump time</div><div className="v">{dur(pumped)}</div><div className="d">about {num(kwh, 1)} kWh</div></div>
          </div>

          <div className="two section">
            <div className="panel">
              <div className="panel-head"><h3>Supply calendar</h3><span className="faint small">8 weeks</span></div>
              <Calendar data={data} />
              <div className="legend" style={{ marginTop: 14 }}>
                <span><i style={{ background: 'var(--water)' }} />Filled</span>
                <span><i style={{ background: 'repeating-linear-gradient(135deg, var(--water-soft) 0 3px, var(--warn) 3px 5px)' }} />Fill stopped short</span>
                <span><i style={{ background: 'var(--water-soft)' }} />Supply, no fill</span>
                <span><i style={{ background: 'var(--surface-2)' }} />No supply</span>
              </div>
            </div>
            <div className="panel">
              <div className="panel-head"><h3>Submersible top-ups</h3><span className="faint small">{data.backup.length ? `${data.backup.length} recorded` : ''}</span></div>
              {data.backup.length ? (
                <table className="tbl">
                  <thead><tr><th>When</th><th>Tank</th><th className="right">Time</th></tr></thead>
                  <tbody>{data.backup.slice(0, 8).map((b) => (
                    <tr key={b.id}>
                      <td>{relDay(b.start_at)}, {t12(b.start_at)}<div className="faint small">{b.reason}</div></td>
                      <td>{pct(b.tank_start)} to {pct(b.tank_end)}</td>
                      <td className="right">{dur(b.minutes)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              ) : <p className="muted">No top-ups yet. The submersible starts on its own when the tank drops below the top-up level and the next supply is still far off.</p>}
            </div>
          </div>

          <section className="section">
            <div className="section-head"><h2>Supply events</h2><span className="faint small">Newest first</span></div>
            <div className="panel">
              {evs.length === 0 && <p className="muted">No supply events in this period.</p>}
              {evs.map((e) => {
                const a = e.tank_start ?? 0, b = e.tank_end ?? a;
                return (
                  <div key={e.id} className="ev">
                    <div className="ev-date">
                      <div className="d1">{dayLabel(e.opened_at)}</div>
                      <div className="d2">{t12(e.opened_at)} to {e.closed_at ? t12(e.closed_at) : 'now'}</div>
                    </div>
                    <div className="ev-mid">
                      <div className="lvl" aria-label={`Tank from ${pct(a)} to ${pct(b)}`}>
                        <div className="from" style={{ width: `${Math.min(a, b)}%` }} />
                        <div className="to" style={{ left: `${Math.min(a, b)}%`, width: `${Math.max(0, b - a)}%` }} />
                      </div>
                      <div className="ev-stats">
                        <span>Tank <b>{pct(a)} to {pct(b)}</b></span>
                        <span>Pumped <b>{dur(e.pumped_min)}</b></span>
                        <span>TDS <b>{num(e.tds_min)} to {num(e.tds_max)}</b> ppm</span>
                        <span>Peak flow <b>{num(e.peak_flow)}</b> L/min</span>
                        {e.manual_min ? <span>By hand <b>{dur(e.manual_min)}</b></span> : null}
                      </div>
                    </div>
                    <Pill tone={gradeTone(e.grade)}>{gradeText[e.grade ?? ''] ?? 'Open'}</Pill>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </>
  );
}
