// Preview data, modelled on the real system's records (Oct–Nov 2026) and shifted so "now" is always now.
import type { Now, Today, History, Events, SystemInfo, Settings, SupplyEvent, Reading, PumpRun, BackupRun, BackupCfg } from './api';

const REAL_NOW = 1795330740000; // 22 Nov 2026, 12:29 PM IST
const H = 3600000, M = 60000, D = 86400000;
let shift = Date.now() - REAL_NOW;
const T = (ms: number) => ms + shift;

type Raw = [id: string, opened: number, closed: number, kind: string, grade: string, reason: string, runs: number, pumpedMin: number,
  tStart: number, tMax: number, tEnd: number, peak: number, tdsMin: number, tdsMax: number, manualMin: number];
const RAW: Raw[] = [
  ['2026-10-21-01', 1792565473942, 1792582211226, 'successful', 'successful', 'supply ended', 8, 100, 36, 99, 88, 864, 134, 627, 17],
  ['2026-10-23-02', 1792737004455, 1792752659561, 'completed', 'successful', 'completed fill, tank reached 95%', 2, 94, 22, 96, 96, 76, 128, 177, 0],
  ['2026-10-25-03', 1792911010739, 1792920176390, 'completed', 'successful', 'completed fill, tank reached 95%', 2, 98, 35, 94, 94, 87, 128, 187, 2],
  ['2026-10-27-04', 1793082904719, 1793103323614, 'successful', 'successful', 'supply ended', 4, 183, 28, 87, 82, 77, 122, 243, 90],
  ['2026-10-29-05', 1793255404985, 1793276411360, 'successful', 'successful', 'supply ended', 5, 107, 35, 86, 85, 75, 141, 207, 181],
  ['2026-10-31-06', 1793428506339, 1793437334531, 'fill', 'unsuccessful_system', 'supply ended', 6, 62, 86, 86, 86, 82, 130, 392, 5],
  ['2026-11-02-13', 1793602504905, 1793619611463, 'successful', 'successful', 'supply ended', 3, 129, 43, 86, 85, 68, 132, 243, 90],
  ['2026-11-04-14', 1793774404077, 1793795400902, 'successful', 'successful', 'supply ended', 3, 106, 49, 87, 85, 77, 126, 236, 180],
  ['2026-11-06-16', 1793957118777, 1793968200984, 'fill', 'unsuccessful_system', 'supply ended', 3, 143, 14, 54, 54, 69, 126, 191, 63],
  ['2026-11-08-17', 1794121204290, 1794134266128, 'completed', 'successful', 'completed fill, tank reached 95%', 3, 182, 30, 95, 95, 60, 93, 139, 43],
  ['2026-11-10-18', 1794292506698, 1794313800079, 'fill', 'unsuccessful_system', 'supply day ended', 9, 123, 40, 70, 69, 73, 122, 267, 84],
  ['2026-11-12-19', 1794465306906, 1794479911573, 'completed', 'successful', 'completed fill, tank reached 95%', 4, 124, 15, 60, 56, 75, 121, 127, 100],
  ['2026-11-15-20', 1794736382435, 1794746568826, 'fill', 'unsuccessful_system', 'supply day ended', 2, 3, 76, 76, 72, 35, 125, 459, 3],
  ['2026-11-16-21', 1794816004065, 1794827686136, 'completed', 'successful', 'completed fill, tank reached 95%', 3, 100, 57, 93, 93, 53, 123, 133, 0],
  ['2026-11-18-22', 1794984904857, 1795002482814, 'completed', 'successful', 'completed fill, tank reached 92%', 5, 120, 58, 91, 91, 52, 131, 144, 1],
  ['2026-11-20-23', 1795156204137, 1795163418950, 'completed', 'successful', 'completed fill, tank reached 92%', 2, 44, 67, 91, 91, 60, 113, 184, 0],
  ['2026-11-22-24', 1795328124822, 1795330884248, 'completed', 'successful', 'completed fill, tank reached 92%', 1, 43, 62, 92, 92, 85, 113, 212, 41],
];

const events = (): SupplyEvent[] => RAW.map((r) => ({
  id: r[0], opened_at: T(r[1]), closed_at: T(Math.min(r[2], REAL_NOW)), kind: r[3], grade: r[4], reason: r[5], runs: r[6], pumped_min: r[7],
  tank_start: r[8], tank_max: r[9], tank_end: r[10], peak_flow: r[11], tds_min: r[12], tds_max: r[13], manual_min: r[14], avg_flow: Math.round(r[11] * 0.8),
}));

// Pump runs: one block per event, starting ~35 min after first flow.
const runsFor = (): PumpRun[] => RAW.map((r, i) => {
  const start = r[1] + 35 * M;
  const end = Math.min(start + r[7] * M, REAL_NOW + 4 * M);
  return { id: i + 1, started_at: T(start), ended_at: T(end), minutes: r[7], stop_reason: r[5].replace('completed fill, ', ''), tank_start: r[8], tank_end: r[10], avg_power_w: 1255, event_id: r[0] };
});

const usePerHour = (ms: number) => {
  const h = new Date(ms + 5.5 * H).getUTCHours();
  if (h >= 6 && h < 10) return 1.55;
  if (h >= 10 && h < 18) return 0.75;
  if (h >= 18 && h < 23) return 1.0;
  return 0.12;
};

let cache: { at: number; pts: Reading[] } | null = null;
function series(): Reading[] {
  if (cache && Date.now() - cache.at < 30000) return cache.pts;
  shift = Date.now() - REAL_NOW;
  const runs = runsFor().map((r) => ({ s: r.started_at, e: r.ended_at!, a: r.tank_start!, b: r.tank_end! }));
  const pts: Reading[] = [];
  const end = Date.now();
  let t = end - 31 * D, tank = 64;
  const step = 5 * M;
  for (; t <= end; t += step) {
    const run = runs.find((r) => t >= r.s && t <= r.e);
    let flow = 0, tds: number | null = 58.5, w = 0;
    if (run) {
      const f = (t - run.s) / (run.e - run.s || 1);
      tank = run.a + (run.b - run.a) * f;
      flow = 62 + 14 * Math.sin(t / 900000) + (Math.random() - 0.5) * 6;
      tds = 118 + 70 * Math.exp(-((t - run.s) / M) / 6) + (Math.random() - 0.5) * 8;
      w = 1240 + (Math.random() - 0.5) * 40;
    } else {
      tank = Math.max(4, tank - usePerHour(t) * (step / H) + (Math.random() - 0.5) * 0.15);
    }
    pts.push({ ts: t, tank: Math.round(tank * 10) / 10, flow: Math.round(flow * 10) / 10, tds: tds == null ? null : Math.round(tds), pump_w: Math.round(w) });
  }
  cache = { at: Date.now(), pts };
  return pts;
}

let manual = { on: false, since: null as number | null };
let pumpOn: 'on' | 'off' = 'off', valveOn: 'on' | 'off' = 'off', subOn: 'on' | 'off' = 'off';
let cfg: BackupCfg = { startBelow: 20, leaveAtSupply: 25, maxTarget: 50, minHoursAway: 6, maxRunMin: 60 };
const backupRuns = (): BackupRun[] => [
  { id: 1, start_at: T(1794700800000), end_at: T(1794700800000 + 26 * M), tank_start: 17, tank_end: 33, target: 41, minutes: 26, reason: 'target 41% reached', failed: 0 },
];

function istDate(ms: number) { return new Date(ms + 5.5 * H).toISOString().slice(0, 10); }
function label(ms: number) { return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(ms)); }

function now(): Now {
  const pts = series();
  const last = pts[pts.length - 1];
  const t = Date.now();
  const lastSupply = T(RAW[RAW.length - 1][1]);
  const days = Array.from({ length: 7 }, (_, i) => {
    const ms = t + i * D;
    const k = Math.round((Date.parse(istDate(ms)) - Date.parse(istDate(lastSupply))) / D);
    const status = k === 0 ? 'came' : k % 2 === 0 ? 'expected' : 'unlikely';
    return { date: istDate(ms), label: label(ms), p: status === 'came' ? 100 : status === 'expected' ? 95 : 1, status: status as 'came' | 'expected' | 'unlikely' };
  });
  const nx = days.find((d) => d.status === 'expected')!;
  const nextAt = Date.parse(nx.date + 'T12:00:00+05:30');
  return {
    ts: t, tank: last.tank, flow: pumpOn === 'on' ? 66.2 : 0, tds: pumpOn === 'on' ? 121 : 58.5, volts: 226,
    main: { state: pumpOn, watts: pumpOn === 'on' ? 1258 : 0 }, valve: valveOn,
    sub: { state: subOn, watts: subOn === 'on' ? 742 : 0, autoOffMin: 120 },
    manual: { on: manual.on, since: manual.since, until: manual.since ? manual.since + 90 * M : null },
    ctrl: { phase: manual.on ? 'manual' : 'idle', sub: null, event: null, lastStop: { at: T(1795330899189), reason: 'tank reached 92%' }, online: true },
    week: { window: '12:00 PM - 12:58 PM', lastSupply: istDate(lastSupply), next: { date: nx.date, label: nx.label, p: nx.p }, days },
    backup: { running: subOn === 'on' ? { startAt: t - 4 * M, target: 41, startTank: last.tank ?? 0 } : null, rate: 0.67, hoursLeft: (nextAt - t) / H, nextAt, cfg },
    seen: { tank: t - 40000, flow: t - 3000, tds: t - 2000 },
  };
}

function today(): Today {
  const pts = series();
  const mid = Date.parse(istDate(Date.now()) + 'T00:00:00+05:30');
  const ev = events().filter((e) => (e.closed_at ?? Date.now()) >= mid);
  return {
    date: istDate(Date.now()), tankMidnight: pts.find((p) => p.ts >= mid)?.tank ?? null,
    readings: pts.filter((p) => p.ts >= mid), runs: runsFor().filter((r) => (r.ended_at ?? Date.now()) >= mid),
    backup: backupRuns().filter((b) => b.end_at >= mid),
    probes: Array.from({ length: 6 }, (_, i) => ({ ts: mid + 12 * H + i * 5 * M - 15 * M, good: i >= 3 ? 1 : 0, activity: i >= 2 ? 1 : 0 })).filter((p) => p.ts < Date.now()),
    events: ev,
  };
}

function history(hours: number): History {
  const since = Date.now() - hours * H;
  const pts = series().filter((p) => p.ts >= since);
  const every = Math.max(1, Math.ceil(pts.length / 500));
  return { hours, points: pts.filter((_, i) => i % every === 0), runs: runsFor().filter((r) => (r.ended_at ?? 0) >= since) };
}

function eventsAll(days: number): Events {
  const since = Date.now() - days * D;
  const ev = events().filter((e) => e.opened_at >= since).reverse();
  const supply = Array.from({ length: days }, (_, i) => {
    const ms = Date.now() - i * D, d = istDate(ms);
    const e = ev.find((x) => istDate(x.opened_at) === d);
    const k = Math.round((Date.parse(istDate(T(RAW[RAW.length - 1][1]))) - Date.parse(d)) / D);
    const isDay = Boolean(e) || (k % 2 === 0 && d !== '2026-11-14');
    return { date: d, supply_day: isDay ? 1 : 0, start_ist: isDay ? '11:45' : null, max_flow: e?.peak_flow ?? null };
  });
  const daily = supply.map((s) => {
    const e = ev.find((x) => istDate(x.opened_at) === s.date);
    return { date: s.date, pump_minutes: e?.pumped_min ?? 0, fills_ok: e?.grade === 'successful' ? 1 : 0, fills_failed: e && e.grade !== 'successful' ? 1 : 0, kwh: e ? Math.round((e.pumped_min ?? 0) / 60 * 1.25 * 100) / 100 : 0, tank_min: null, tank_max: e?.tank_max ?? null };
  });
  return { events: ev, supply, daily, backup: backupRuns() };
}

function system(): SystemInfo {
  const t = Date.now();
  return {
    devices: [
      { key: 'esp-motor', name: 'Pump-side sensors', detail: 'Flow, TDS and drain valve (ESP32)', state: 'ok', seen: t - 2000 },
      { key: 'esp-tank', name: 'Tank level sensor', detail: 'Ultrasonic, 120 cm tanks (ESP32)', state: 'ok', seen: t - 40000 },
      { key: 'main-plug', name: 'Main pump plug', detail: 'Tapo P110, 1.5 HP pump, 226 V mains', state: 'ok', seen: t - 9000 },
      { key: 'sub-plug', name: 'Submersible plug', detail: 'Tapo plug, auto-off after 120 min', state: 'ok', seen: t - 12000 },
      { key: 'controller', name: 'Automatic controller', detail: 'Node-RED, Controller v5', state: 'ok', seen: t - 1000 },
      { key: 'ai', name: 'AI assistant', detail: 'FreeLLMAPI on the home server', state: 'ok', seen: t - 300000 },
    ],
    anomalies: [],
    log: [
      { ts: T(1795330884248), topic: 'event', text: 'Event 2026-11-22-24: completed fill, tank reached 92%.' },
      { ts: T(1795330899189), topic: 'pump', text: 'Pump off: tank reached 92%.' },
      { ts: T(1795328190302), topic: 'event', text: 'Event 2026-11-22-24: fill event, TDS accepted (126 ppm).' },
      { ts: T(1795328140043), topic: 'manual', text: 'Manual control on. Hands back to automatic after 90 min.' },
      { ts: T(1795328124822), topic: 'event', text: 'Supply event opened: water arrived at 11:45 AM.' },
    ],
    ai: { calls: 214, ok: 209, avgMs: 2380 },
    db: { readings: 18432, events: 24, since: T(1792500000000) },
  };
}

export function demo(path: string, body?: unknown): unknown {
  if (path.startsWith('/api/v1/now')) return now();
  if (path.startsWith('/api/v1/today')) return today();
  if (path.startsWith('/api/v1/history')) return history(Number(new URL(path, 'http://x').searchParams.get('hours')) || 24);
  if (path.startsWith('/api/v1/events')) return eventsAll(Number(new URL(path, 'http://x').searchParams.get('days')) || 56);
  if (path.startsWith('/api/v1/system')) return system();
  if (path.startsWith('/api/v1/settings')) {
    if (body) cfg = { ...cfg, ...(body as Settings).backup };
    return { backup: cfg } as Settings;
  }
  if (path.startsWith('/api/v1/control')) {
    const b = body as { target: string; on: boolean };
    const v = b.on ? 'on' : 'off';
    if (b.target === 'manual') { manual = { on: b.on, since: b.on ? Date.now() : null }; if (!b.on) { pumpOn = 'off'; valveOn = 'off'; } }
    if (b.target === 'pump') pumpOn = v;
    if (b.target === 'valve') valveOn = v;
    if (b.target === 'sub') subOn = v;
    return { ok: true };
  }
  throw new Error('unknown path ' + path);
}
