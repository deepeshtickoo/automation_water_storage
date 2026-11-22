const TZ = 'Asia/Kolkata';
const H = 3600000;

export const t12 = (ms: number | null | undefined) =>
  ms == null ? '—' : new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(ms)).replace(/ /g, ' ');

export const dayLabel = (ms: number) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(ms));

export const dayLong = (ms: number) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(ms));

export const istDate = (ms: number) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(ms));

/** Relative day name: Today, Tomorrow, Yesterday, or "Tue 24 Nov". */
export const relDay = (ms: number) => {
  const d = istDate(ms), now = Date.now();
  if (d === istDate(now)) return 'Today';
  if (d === istDate(now + 86400000)) return 'Tomorrow';
  if (d === istDate(now - 86400000)) return 'Yesterday';
  return dayLabel(ms);
};

/** Durations over 59 minutes are written as Xh MMm. */
export const dur = (min: number | null | undefined) => {
  if (min == null || !Number.isFinite(min)) return '—';
  const m = Math.round(min);
  return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
};

export const hoursText = (h: number) => {
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${Math.round(h)} hours`;
  const d = h / 24;
  return d < 10 ? `${Math.round(d * 2) / 2} days`.replace('.5', '½') : `${Math.round(d)} days`;
};

export const ago = (ms: number | null | undefined) => {
  if (ms == null) return 'never';
  const s = (Date.now() - ms) / 1000;
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
};

export const pct = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? '—' : `${Math.round(v)}%`);
export const num = (v: number | null | undefined, d = 0) => (v == null || !Number.isFinite(v) ? '—' : v.toFixed(d));

/** Litres from a tank percentage: three joined 2000 L tanks. */
export const CAPACITY_L = 6000;
export const litres = (p: number | null | undefined) => (p == null ? null : Math.round((p / 100) * CAPACITY_L / 10) * 10);
export const fmtL = (l: number | null | undefined) => (l == null ? '—' : `${l.toLocaleString('en-IN')} L`);

export const gradeText: Record<string, string> = {
  successful: 'Filled',
  unsuccessful_system: 'Stopped early',
  unsuccessful_supply: 'Supply too short',
  unsuccessful_quality: 'Water quality',
  brief_supply: 'Brief supply',
  false_positive: 'False alarm',
};
export const gradeTone = (g: string | null) => (g === 'successful' ? 'good' : g === 'false_positive' || g === 'brief_supply' ? 'quiet' : g ? 'warn' : 'live');

export { H };
