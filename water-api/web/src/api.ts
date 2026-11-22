// Data contract between the web app and the Water API (server/water-api.js).
import { demo } from './demo';

export type Sw = 'on' | 'off' | null;

export interface Now {
  ts: number;
  tank: number | null;
  flow: number | null;
  tds: number | null;
  volts: number | null;
  main: { state: Sw; watts: number | null };
  valve: Sw;
  sub: { state: Sw; watts: number | null; autoOffMin: number | null };
  manual: { on: boolean; since: number | null; until: number | null };
  ctrl: {
    phase: string | null;
    sub: string | null;
    event: null | {
      id: string; kind: string; openedAt: number; mode: string | null;
      tankStart: number | null; tankMax: number | null; runs: number; runMin: number;
      tdsMin: number | null; tdsMax: number | null; peakFlow: number | null;
    };
    lastStop: null | { at: number; reason: string };
    online: boolean;
  };
  week: {
    window: string | null;
    lastSupply: string | null;
    next: null | { date: string; label: string; p: number };
    days: { date: string; label: string; p: number; status: 'came' | 'expected' | 'unlikely' | 'none' }[];
  };
  backup: {
    running: null | { startAt: number; target: number; startTank: number };
    rate: number; hoursLeft: number | null; nextAt: number | null;
    cfg: BackupCfg;
  };
  seen: { tank: number | null; flow: number | null; tds: number | null };
}

export interface BackupCfg { startBelow: number; leaveAtSupply: number; maxTarget: number; minHoursAway: number; maxRunMin: number }

export interface Reading { ts: number; tank: number | null; flow: number | null; tds: number | null; pump_w: number | null }
export interface PumpRun { id: number; started_at: number; ended_at: number | null; minutes: number | null; stop_reason: string | null; tank_start: number | null; tank_end: number | null; avg_power_w: number | null; event_id: string | null }
export interface BackupRun { id: number; start_at: number; end_at: number; tank_start: number; tank_end: number; target: number; minutes: number; reason: string; failed: number }
export interface Probe { ts: number; good: number; activity: number }
export interface SupplyEvent {
  id: string; opened_at: number; closed_at: number | null; kind: string; grade: string | null; reason: string | null;
  runs: number | null; pumped_min: number | null; tank_start: number | null; tank_max: number | null; tank_end: number | null;
  peak_flow: number | null; tds_min: number | null; tds_max: number | null; manual_min: number | null; avg_flow: number | null;
}
export interface Today { date: string; tankMidnight: number | null; readings: Reading[]; runs: PumpRun[]; backup: BackupRun[]; probes: Probe[]; events: SupplyEvent[] }
export interface History { hours: number; points: Reading[]; runs: PumpRun[] }
export interface SupplyDay { date: string; supply_day: number; start_ist: string | null; max_flow: number | null }
export interface Daily { date: string; pump_minutes: number | null; fills_ok: number | null; fills_failed: number | null; kwh: number | null; tank_min: number | null; tank_max: number | null }
export interface Events { events: SupplyEvent[]; supply: SupplyDay[]; daily: Daily[]; backup: BackupRun[] }
export interface SystemInfo {
  devices: { key: string; name: string; detail: string; state: 'ok' | 'stale' | 'down'; seen: number | null }[];
  anomalies: { id: number; kind: string; severity: string; opened_at: number; detail: string; explanation: string | null }[];
  log: { ts: number; topic: string; text: string }[];
  ai: { calls: number; ok: number; avgMs: number | null };
  db: { readings: number; events: number; since: number | null };
}
export interface Settings { backup: BackupCfg }

export const isDemo = (): boolean =>
  import.meta.env.VITE_DEMO === '1' || new URLSearchParams(location.search).has('demo');

async function get<T>(path: string): Promise<T> {
  if (isDemo()) return demo(path) as T;
  const r = await fetch(path, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`${r.status} ${await r.text().catch(() => '')}`.trim());
  return r.json();
}
async function post<T>(path: string, body: unknown): Promise<T> {
  if (isDemo()) { await new Promise((r) => setTimeout(r, 450)); return demo(path, body) as T; }
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j as T;
}

export const api = {
  now: () => get<Now>('/api/v1/now'),
  today: () => get<Today>('/api/v1/today'),
  history: (hours: number) => get<History>(`/api/v1/history?hours=${hours}`),
  events: (days: number) => get<Events>(`/api/v1/events?days=${days}`),
  system: () => get<SystemInfo>('/api/v1/system'),
  settings: () => get<Settings>('/api/v1/settings'),
  saveSettings: (s: Settings) => post<Settings>('/api/v1/settings', s),
  control: (target: 'pump' | 'valve' | 'sub' | 'manual', on: boolean) => post<{ ok: true }>('/api/v1/control', { target, on }),
};
