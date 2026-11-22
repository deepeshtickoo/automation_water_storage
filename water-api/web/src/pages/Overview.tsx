import { api, type Now } from '../api';
import { usePoll, useTick } from '../hooks';
import { Tank } from '../components/Tank';
import { DayStrip, Pill, Skeleton } from '../components/ui';
import { ago, dur, fmtL, hoursText, litres, num, pct, relDay, t12, istDate, gradeText, gradeTone } from '../format';

export function sentence(n: Now): string {
  const tank = pct(n.tank);
  if (n.manual.on) return `You're in control. The automatic system takes over again at ${t12(n.manual.until)}.`;
  if (n.main.state === 'on') return `Filling from the mains. The tank is at ${tank} and rising.`;
  if (n.backup.running) return `Topping up from the submersible, from ${pct(n.backup.running.startTank)} to ${pct(n.backup.running.target)}.`;
  if (n.ctrl.event && n.valve === 'on') return 'Water has arrived. Checking it runs clean before pumping.';
  if (n.ctrl.event) return 'Supply is on. The pump starts once the water tests clean.';
  if (!n.week.next) return `All quiet. The tank is at ${tank}.`;
  const at = Date.parse(n.week.next.date + 'T12:00:00+05:30');
  return `All quiet. Next supply ${relDay(at).toLowerCase() === 'tomorrow' ? 'tomorrow' : relDay(at)} around ${(n.week.window?.split(' - ')[0] ?? '12:00 PM').replace(':00', '')}.`;
}

function lastsText(n: Now) {
  if (n.tank == null || !n.backup.rate) return null;
  const h = Math.max(0, n.tank - 5) / n.backup.rate;
  return `Lasts about ${hoursText(h)} at the usual pace`;
}

export function Overview({ now }: { now: Now | null }) {
  useTick(30000);
  const today = usePoll(api.today, 60000);
  const recent = usePoll(() => api.events(14), 300000);
  if (!now) return <div className="hero"><Skeleton h={420} /><Skeleton h={420} /></div>;

  const projected = now.tank != null && now.backup.hoursLeft != null ? Math.max(0, now.tank - now.backup.hoursLeft * now.backup.rate) : null;
  const filling = now.main.state === 'on' || now.sub.state === 'on';
  const nextAt = now.backup.nextAt;
  const t = today.data;
  const change = t && t.tankMidnight != null && now.tank != null ? now.tank - t.tankMidnight : null;
  const pumped = t ? t.runs.reduce((s, r) => s + (r.minutes ?? ((r.ended_at ?? Date.now()) - r.started_at) / 60000), 0) : null;
  const supplyToday = now.week.days[0]?.status === 'came' || now.week.days[0]?.status === 'expected';
  const lastEv = recent.data?.events[0];

  return (
    <>
      <div className="hero">
        <div className="vessel-wrap">
          <div className="vessel-read">
            <div className="vessel-pct num">{now.tank == null ? '—' : Math.round(now.tank)}<small>%</small></div>
            <div className="vessel-litres">
              <div style={{ fontWeight: 600 }}>{fmtL(litres(now.tank))}</div>
              <div className="faint small">of 6,000 L</div>
            </div>
          </div>
          <Tank pct={now.tank} stopAt={92} topUpBelow={now.backup.cfg.startBelow} projected={projected} filling={filling} />
          <p className="faint small">Reading {ago(now.seen.tank)}</p>
        </div>

        <div className="hero-side">
          <div>
            <p className="say">{sentence(now)}</p>
            <p className="muted" style={{ marginTop: 10 }}>{lastsText(now)}</p>
          </div>
          <div className="facts">
            <div className="fact">
              <div className="k">Next supply</div>
              <div className="v">{nextAt ? relDay(nextAt) : '—'}</div>
              <div className="d">{now.week.window ? `${now.week.window.replace(' - ', ' to ')}` : 'Window not learned yet'}{now.backup.hoursLeft != null ? `, in ${hoursText(now.backup.hoursLeft)}` : ''}</div>
            </div>
            <div className="fact">
              <div className="k">Today</div>
              <div className="v">{change == null ? '—' : `${change > 0 ? '+' : ''}${Math.round(change)}%`}</div>
              <div className="d">{pumped ? `Pumped ${dur(pumped)}` : 'No pumping yet'}{t?.backup.length ? `, ${t.backup.length} top-up` : ''}</div>
            </div>
            <div className="fact">
              <div className="k">Last fill</div>
              <div className="v">{lastEv ? `${pct(lastEv.tank_start)} to ${pct(lastEv.tank_end)}` : '—'}</div>
              <div className="d">{lastEv ? `${relDay(lastEv.opened_at)}, ${gradeText[lastEv.grade ?? ''] ?? 'in progress'}` : 'No fills recorded'}</div>
            </div>
          </div>
          <div className="panel" style={{ minWidth: 0 }}>
            <div className="panel-head"><h3>Today</h3><span className="faint small">{t ? istDate(Date.now()) === t.date ? 'Midnight to midnight' : '' : ''}</span></div>
            {t ? <DayStrip today={t} windowText={now.week.window} supplyToday={supplyToday} /> : <Skeleton h={110} />}
          </div>
        </div>
      </div>

      <section className="section">
        <div className="section-head"><h2>Equipment</h2><a href="#/controls" className="small">Open controls</a></div>
        <div className="equip">
          <div className="eq">
            <div className="eq-top"><span className="eq-name">Main pump</span><Pill tone={now.main.state === 'on' ? 'live' : 'quiet'}>{now.main.state === 'on' ? 'Running' : now.main.state === 'off' ? 'Off' : 'Unknown'}</Pill></div>
            <div className="eq-val num">{num(now.main.watts)}<small>W</small></div>
            <div className="faint small">Mains {num(now.volts)} V{now.ctrl.lastStop ? `. Last stop ${t12(now.ctrl.lastStop.at)}` : ''}</div>
          </div>
          <div className="eq">
            <div className="eq-top"><span className="eq-name">Incoming water</span><Pill tone={(now.flow ?? 0) >= 10 ? 'live' : 'quiet'}>{(now.flow ?? 0) >= 10 ? 'Flowing' : 'No flow'}</Pill></div>
            <div className="eq-val num">{num(now.flow)}<small>L/min</small></div>
            <div className="faint small">TDS {num(now.tds)} ppm{now.main.state === 'on' ? (now.tds != null && now.tds < 200 ? ', clean' : ', check quality') : ', idle reading'}</div>
          </div>
          <div className="eq">
            <div className="eq-top"><span className="eq-name">Submersible</span><Pill tone={now.sub.state === 'on' ? 'live' : 'quiet'}>{now.sub.state === 'on' ? 'Topping up' : 'Off'}</Pill></div>
            <div className="eq-val num">{num(now.sub.watts)}<small>W</small></div>
            <div className="faint small">{now.backup.running ? `Filling to ${pct(now.backup.running.target)}` : `Starts below ${now.backup.cfg.startBelow}% if supply is far off`}</div>
          </div>
          <div className="eq">
            <div className="eq-top"><span className="eq-name">Drain valve</span><Pill tone={now.valve === 'on' ? 'warn' : 'quiet'}>{now.valve === 'on' ? 'Open' : 'Closed'}</Pill></div>
            <div className="eq-val" style={{ fontSize: 15, fontFamily: 'var(--text)', fontWeight: 500, minHeight: 33, display: 'flex', alignItems: 'center' }}>
              {now.manual.on ? 'Manual control' : 'Automatic'}
            </div>
            <div className="faint small">Opens briefly to test the supply</div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head"><h2>This week</h2><span className="faint small">Supply usually comes every {2} days</span></div>
        <div className="week">
          {now.week.days.map((d) => {
            const ms = Date.parse(d.date + 'T12:00:00+05:30');
            return (
              <div key={d.date} className={`day ${d.status}`}>
                <div className="dn">{relDay(ms) === 'Today' ? 'Today' : d.label.split(' ')[0]}</div>
                <div className="dd num">{d.label.split(' ')[1]}</div>
                <div className="small" style={{ marginTop: 2 }}>{d.status === 'came' ? 'Came' : d.status === 'expected' ? 'Expected' : d.status === 'none' ? 'None' : 'Unlikely'}</div>
                <div className="drop" aria-label={`${d.p}% chance`}><i style={{ width: `${d.p}%` }} /></div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="section">
        <div className="section-head"><h2>Recent supply</h2><a href="#/supply" className="small">See all</a></div>
        <div className="panel">
          {recent.data ? (
            <div className="list">
              {recent.data.events.slice(0, 4).map((e) => (
                <div key={e.id} className="row" style={{ gridTemplateColumns: '1fr auto' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{relDay(e.opened_at)}, {t12(e.opened_at)}</div>
                    <div className="faint small">Tank {pct(e.tank_start)} to {pct(e.tank_end)}, pumped {dur(e.pumped_min)}</div>
                  </div>
                  <Pill tone={gradeTone(e.grade)}>{gradeText[e.grade ?? ''] ?? 'Open'}</Pill>
                </div>
              ))}
            </div>
          ) : <Skeleton h={160} />}
        </div>
      </section>
    </>
  );
}
