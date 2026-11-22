import { api } from '../api';
import { usePoll } from '../hooks';
import { Pill, Skeleton } from '../components/ui';
import { ago, dayLabel, relDay, t12 } from '../format';

export function System() {
  const { data, error } = usePoll(api.system, 30000);
  return (
    <>
      <div className="page-head"><div><h1>System</h1><p className="muted">Devices, alerts and recent activity.</p></div></div>
      {error && <p className="err">Couldn't load system status: {error}</p>}
      {!data ? <Skeleton h={300} /> : (
        <>
          <div className="panel">
            <div className="panel-head"><h3>Devices</h3><span className="faint small">{data.devices.filter((d) => d.state === 'ok').length} of {data.devices.length} reporting</span></div>
            <div className="list">
              {data.devices.map((d) => (
                <div key={d.key} className="row" style={{ gridTemplateColumns: '1fr auto auto' }}>
                  <div><div style={{ fontWeight: 600 }}>{d.name}</div><div className="faint small">{d.detail}</div></div>
                  <span className="faint small">{ago(d.seen)}</span>
                  <Pill tone={d.state === 'ok' ? 'good' : d.state === 'stale' ? 'warn' : 'bad'}>{d.state === 'ok' ? 'Online' : d.state === 'stale' ? 'Quiet' : 'Offline'}</Pill>
                </div>
              ))}
            </div>
          </div>

          <div className="two section">
            <div className="panel">
              <div className="panel-head"><h3>Open alerts</h3></div>
              {data.anomalies.length === 0 ? <p className="muted">Nothing needs attention.</p> : (
                <div className="list">
                  {data.anomalies.map((a) => (
                    <div key={a.id} className="row" style={{ gridTemplateColumns: '1fr auto' }}>
                      <div><div style={{ fontWeight: 600 }}>{a.detail}</div><div className="faint small">{a.explanation ?? `Since ${relDay(a.opened_at)}, ${t12(a.opened_at)}`}</div></div>
                      <Pill tone={a.severity === 'high' ? 'bad' : 'warn'}>{a.severity === 'high' ? 'High' : 'Watch'}</Pill>
                    </div>
                  ))}
                </div>
              )}
              <hr className="rule" />
              <div className="small muted">
                AI assistant: {data.ai.calls} requests in the last day, {data.ai.calls ? Math.round((data.ai.ok / data.ai.calls) * 100) : 0}% answered{data.ai.avgMs ? `, ${(data.ai.avgMs / 1000).toFixed(1)} s on average` : ''}.
                <br />Database: {data.db.readings.toLocaleString('en-IN')} readings and {data.db.events} supply events{data.db.since ? ` since ${dayLabel(data.db.since)}` : ''}.
              </div>
            </div>
            <div className="panel">
              <div className="panel-head"><h3>Activity</h3><span className="faint small">From the controller</span></div>
              <table className="tbl">
                <tbody>{data.log.map((l, i) => (
                  <tr key={i}><td style={{ whiteSpace: 'nowrap', width: 1 }} className="faint">{relDay(l.ts) === 'Today' ? t12(l.ts) : `${relDay(l.ts)} ${t12(l.ts)}`}</td><td>{l.text}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
