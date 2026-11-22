import { useState } from 'react';
import { Info, TriangleAlert } from 'lucide-react';
import { api, type Now } from '../api';
import { useTick } from '../hooks';
import { Dialog, Pill, Switch, useToast } from '../components/ui';
import { num, pct, t12 } from '../format';

type Target = 'pump' | 'valve' | 'sub' | 'manual';
const NAMES: Record<Target, string> = { pump: 'main pump', valve: 'drain valve', sub: 'submersible', manual: 'manual control' };

export function Controls({ now, refresh }: { now: Now | null; refresh: () => void }) {
  useTick(15000);
  const toast = useToast();
  const [ask, setAsk] = useState<{ target: Target; on: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!now) return null;

  const run = async (target: Target, on: boolean) => {
    setBusy(true);
    try {
      await api.control(target, on);
      toast(target === 'manual' ? (on ? 'Manual control is on' : 'Back to automatic') : `${NAMES[target][0].toUpperCase() + NAMES[target].slice(1)} turned ${on ? 'on' : 'off'}`);
      refresh(); setTimeout(refresh, 1500);
    } catch (e) {
      toast(`Couldn't switch the ${NAMES[target]}: ${e instanceof Error ? e.message : e}`);
    } finally { setBusy(false); setAsk(null); }
  };

  const m = now.manual;
  const left = m.until ? Math.max(0, Math.round((m.until - Date.now()) / 60000)) : null;
  const both = (ask?.target === 'pump' && ask.on && now.valve === 'on') || (ask?.target === 'valve' && ask.on && now.main.state === 'on');

  const copy: Record<Target, { on: [string, string]; off: [string, string] }> = {
    manual: {
      on: ['Take manual control?', 'The automatic system stops switching the pump and valve. It takes over again after 90 minutes, or when you hand it back.'],
      off: ['Hand back to automatic?', 'The automatic system will decide what to run from here, starting with the next check.'],
    },
    pump: {
      on: ['Turn on the main pump?', 'Water goes straight into the tanks. Only do this when supply is on and the water is clean. The pump stops itself at 92%.'],
      off: ['Turn off the main pump?', 'Filling stops right away.'],
    },
    valve: {
      on: ['Open the drain valve?', 'Incoming water goes down the drain, so you can see whether the supply is on and running clean.'],
      off: ['Close the drain valve?', 'Water stops going to the drain.'],
    },
    sub: {
      on: ['Turn on the submersible?', 'It fills the tanks from the backup line. The plug switches it off by itself after 120 minutes.'],
      off: ['Turn off the submersible?', 'Any top-up in progress stops now.'],
    },
  };

  return (
    <>
      <div className="page-head"><div><h1>Controls</h1><p className="muted">Switch things by hand. Every change asks first.</p></div></div>

      <div className={`manual-band ${m.on ? 'on' : ''}`}>
        <div>
          <h2>{m.on ? 'You have manual control' : 'Automatic control'}</h2>
          <p className="muted" style={{ marginTop: 4 }}>
            {m.on ? `Hands back to automatic at ${t12(m.until)}${left != null ? `, in ${left} min` : ''}.` : 'The system probes for supply, checks water quality and runs the pump on its own.'}
          </p>
        </div>
        <Switch on={m.on} label="Manual control" disabled={busy} onChange={(v) => setAsk({ target: 'manual', on: v })} />
      </div>

      <div className="ctl-grid section">
        <div className="ctl">
          <div className="ctl-top">
            <div><h3>Main pump</h3><p className="faint small">Mains supply line, 1.5 HP</p></div>
            <Switch on={now.main.state === 'on'} label="Main pump" disabled={busy || !m.on} onChange={(v) => setAsk({ target: 'pump', on: v })} />
          </div>
          <div className="meta"><span>{num(now.main.watts)} W</span><span>Flow {num(now.flow)} L/min</span><span>TDS {num(now.tds)} ppm</span></div>
          {!m.on && <div className="note"><Info size={16} />Turn on manual control to switch the main pump.</div>}
        </div>
        <div className="ctl">
          <div className="ctl-top">
            <div><h3>Drain valve</h3><p className="faint small">Tests the supply without filling</p></div>
            <Switch on={now.valve === 'on'} label="Drain valve" disabled={busy || !m.on} onChange={(v) => setAsk({ target: 'valve', on: v })} />
          </div>
          <div className="meta"><span>{now.valve === 'on' ? 'Open' : 'Closed'}</span><span>Normally closed</span></div>
          {!m.on && <div className="note"><Info size={16} />Turn on manual control to open the valve.</div>}
        </div>
        <div className="ctl">
          <div className="ctl-top">
            <div><h3>Submersible</h3><p className="faint small">Backup line, tank level only</p></div>
            <Switch on={now.sub.state === 'on'} label="Submersible" disabled={busy} onChange={(v) => setAsk({ target: 'sub', on: v })} />
          </div>
          <div className="meta">
            <span>{num(now.sub.watts)} W</span>
            <span>{now.backup.running ? `Top-up to ${pct(now.backup.running.target)}` : 'Automatic top-up armed'}</span>
            <span>Auto-off {now.sub.autoOffMin ?? 120} min</span>
          </div>
          <Pill tone={now.sub.state === 'on' ? 'live' : 'quiet'}>{now.sub.state === 'on' ? 'Running' : 'Off'}</Pill>
        </div>
      </div>

      {ask && (
        <Dialog
          title={copy[ask.target][ask.on ? 'on' : 'off'][0]}
          onClose={() => setAsk(null)}
          actions={<>
            <button className="btn ghost" onClick={() => setAsk(null)}>Cancel</button>
            <button className={`btn ${ask.on ? 'primary' : ''}`} disabled={busy} onClick={() => run(ask.target, ask.on)}>
              {busy ? 'Working…' : ask.target === 'manual' ? (ask.on ? 'Take control' : 'Hand back') : ask.target === 'valve' ? (ask.on ? 'Open valve' : 'Close valve') : ask.on ? 'Turn on' : 'Turn off'}
            </button>
          </>}
        >
          <p>{copy[ask.target][ask.on ? 'on' : 'off'][1]}</p>
          {both && <div className="note warn" style={{ marginTop: 12 }}><TriangleAlert size={16} />The pump and the drain valve are never meant to run together. Water would be pumped into the drain.</div>}
        </Dialog>
      )}
    </>
  );
}
