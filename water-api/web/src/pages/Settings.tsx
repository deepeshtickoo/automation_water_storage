import { useEffect, useState } from 'react';
import { api, type BackupCfg, type Now } from '../api';
import { useToast, Skeleton } from '../components/ui';

function Stepper({ value, onChange, min, max, step = 1, unit = '%', label }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit?: string; label: string }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button aria-label={`Lower ${label}`} onClick={() => onChange(Math.max(min, value - step))}>−</button>
      <output aria-live="polite">{value}{unit}</output>
      <button aria-label={`Raise ${label}`} onClick={() => onChange(Math.min(max, value + step))}>+</button>
    </div>
  );
}

const RULES = [
  'Between 12 PM and 6 PM, the drain valve opens for 10 seconds every 5 minutes to check for supply.',
  'When water is found, the system waits 40 minutes so the dirty first rush passes.',
  'A 5-minute drain test compares TDS before and after. Falling or steady in range means the water is good.',
  'The main pump runs in pulses, then keeps running while flow stays above 19 L/min.',
  'The pump stops at 92%. A single run is capped at 120 minutes, followed by a short rest.',
  'On days without expected supply, it checks less often so it never misses an early arrival.',
  'The submersible tops up only when the tank is low and the next supply is far off, and only as much as the house will use.',
];

export function Settings({ now }: { now: Now | null }) {
  const toast = useToast();
  const [cfg, setCfg] = useState<BackupCfg | null>(null);
  const [saved, setSaved] = useState<BackupCfg | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.settings().then((s) => { setCfg(s.backup); setSaved(s.backup); }).catch((e) => toast(`Couldn't load settings: ${e.message}`)); }, [toast]);
  const dirty = cfg && saved && JSON.stringify(cfg) !== JSON.stringify(saved);
  const rate = now?.backup.rate ?? 0.67;
  const exampleH = 30;
  const example = cfg ? Math.min(cfg.maxTarget, Math.round(cfg.leaveAtSupply + exampleH * rate)) : 0;

  const save = async () => {
    if (!cfg) return;
    setBusy(true);
    try { const s = await api.saveSettings({ backup: cfg }); setSaved(s.backup); setCfg(s.backup); toast('Settings saved'); }
    catch (e) { toast(`Couldn't save: ${e instanceof Error ? e.message : e}`); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="page-head"><div><h1>Settings</h1><p className="muted">How the backup top-up behaves, and how the automatic system works.</p></div></div>
      <div className="two">
        <div className="panel">
          <div className="panel-head"><h3>Submersible top-up</h3></div>
          {!cfg ? <Skeleton h={220} /> : (
            <>
              <div className="setting">
                <div><div style={{ fontWeight: 600 }}>Start when the tank is below</div><div className="faint small">Only when the next supply is at least {cfg.minHoursAway} hours away</div></div>
                <Stepper label="start level" value={cfg.startBelow} min={5} max={50} onChange={(v) => setCfg({ ...cfg, startBelow: v })} />
              </div>
              <div className="setting">
                <div><div style={{ fontWeight: 600 }}>Leave this much when supply arrives</div><div className="faint small">Room is kept free for fresh municipal water</div></div>
                <Stepper label="level at supply" value={cfg.leaveAtSupply} min={5} max={60} onChange={(v) => setCfg({ ...cfg, leaveAtSupply: v })} />
              </div>
              <div className="setting">
                <div><div style={{ fontWeight: 600 }}>Never fill above</div><div className="faint small">Upper limit for any top-up</div></div>
                <Stepper label="maximum fill" value={cfg.maxTarget} min={20} max={90} step={5} onChange={(v) => setCfg({ ...cfg, maxTarget: v })} />
              </div>
              <div className="setting">
                <div><div style={{ fontWeight: 600 }}>Longest single run</div><div className="faint small">The plug also cuts power after 120 minutes</div></div>
                <Stepper label="longest run" value={cfg.maxRunMin} min={10} max={110} step={5} unit=" min" onChange={(v) => setCfg({ ...cfg, maxRunMin: v })} />
              </div>
              <div className="note" style={{ marginTop: 6 }}>
                If the tank drops below {cfg.startBelow}% with {exampleH} hours to the next supply, the submersible fills to about {example}%. The house uses around {rate.toFixed(2)}% an hour.
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button className="btn ghost" disabled={!dirty || busy} onClick={() => setCfg(saved)}>Discard</button>
                <button className="btn primary" disabled={!dirty || busy} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button>
              </div>
            </>
          )}
        </div>
        <div className="panel">
          <div className="panel-head"><h3>How the automatic system works</h3></div>
          <ol className="rules">{RULES.map((r) => <li key={r}><span>{r}</span></li>)}</ol>
        </div>
      </div>
    </>
  );
}
