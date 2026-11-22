import { useEffect, useState } from 'react';
import { Activity, Gauge, LayoutGrid, SlidersHorizontal, Settings2, CalendarDays } from 'lucide-react';
import { api, isDemo } from './api';
import { useHashRoute, usePoll, useTick } from './hooks';
import { ToastProvider, Seg } from './components/ui';
import { Overview } from './pages/Overview';
import { Supply } from './pages/Supply';
import { Trends } from './pages/Trends';
import { Controls } from './pages/Controls';
import { Settings } from './pages/Settings';
import { System } from './pages/System';
import { ago } from './format';

const NAV = [
  { id: 'overview', label: 'Overview', short: 'Home', icon: LayoutGrid },
  { id: 'supply', label: 'Supply', short: 'Supply', icon: CalendarDays },
  { id: 'trends', label: 'Trends', short: 'Trends', icon: Activity },
  { id: 'controls', label: 'Controls', short: 'Controls', icon: SlidersHorizontal },
  { id: 'settings', label: 'Settings', short: 'Settings', icon: Settings2 },
  { id: 'system', label: 'System', short: 'System', icon: Gauge },
];
const TABS = ['overview', 'supply', 'trends', 'controls', 'system'];

function Mark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden>
      <rect x="4" y="3" width="24" height="26" rx="7" fill="var(--surface-2)" stroke="var(--line)" strokeWidth="1.5" />
      <path d="M4 17 q 6 -3 12 0 t 12 0 V22 a7 7 0 0 1 -7 7 H11 a7 7 0 0 1 -7 -7 Z" fill="var(--water)" />
    </svg>
  );
}

type Theme = 'auto' | 'light' | 'dark';
function useTheme(): [Theme, (t: Theme) => void] {
  const [t, set] = useState<Theme>(() => { try { return (localStorage.getItem('theme') as Theme) || 'auto'; } catch { return 'auto'; } });
  useEffect(() => {
    if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('theme', t); } catch { /* storage unavailable */ }
  }, [t]);
  return [t, set];
}

export default function App() {
  const route = useHashRoute();
  const page = NAV.some((n) => n.id === route) ? route : 'overview';
  const now = usePoll(api.now, 5000);
  const [theme, setTheme] = useTheme();
  useTick(5000);
  useEffect(() => { document.title = `${NAV.find((n) => n.id === page)?.label} · Water storage`; }, [page]);

  const live = now.error ? <span className="err small">Can't reach the house server. Retrying.</span>
    : now.data ? <span className="faint small">{isDemo() ? 'Preview data. ' : ''}Updated {ago(now.data.ts)}</span> : <span className="faint small">Connecting</span>;

  return (
    <ToastProvider>
      <div className="shell">
        <aside className="rail">
          <div className="brand"><Mark /><div><div className="brand-name">Water storage</div><div className="brand-sub">Tickoo Niwas</div></div></div>
          <nav className="nav" aria-label="Main">
            {NAV.map(({ id, label, icon: I }) => (
              <a key={id} href={`#/${id}`} aria-current={page === id ? 'page' : undefined}><I size={18} strokeWidth={1.8} />{label}</a>
            ))}
          </nav>
          <div className="rail-foot">
            {live}
            <Seg label="Theme" value={theme} onChange={setTheme} options={[['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']]} />
          </div>
        </aside>
        <main className="main" id="main">
          {page === 'overview' && <Overview now={now.data} />}
          {page === 'supply' && <Supply />}
          {page === 'trends' && <Trends />}
          {page === 'controls' && <Controls now={now.data} refresh={now.reload} />}
          {page === 'settings' && <Settings now={now.data} />}
          {page === 'system' && <SystemWithLinks theme={theme} setTheme={setTheme} live={live} />}
        </main>
        <nav className="tabbar" aria-label="Main">
          {TABS.map((id) => {
            const n = NAV.find((x) => x.id === id)!;
            const I = n.icon;
            const cur = page === id || (id === 'system' && page === 'settings');
            return <a key={id} href={`#/${id}`} aria-current={cur ? 'page' : undefined}><I size={21} strokeWidth={1.8} />{n.short}</a>;
          })}
        </nav>
      </div>
    </ToastProvider>
  );
}

function SystemWithLinks({ theme, setTheme, live }: { theme: Theme; setTheme: (t: Theme) => void; live: React.ReactNode }) {
  return (
    <>
      <System />
      <section className="section panel only-mobile">
        <div className="panel-head"><h3>This app</h3>{live}</div>
        <div className="row" style={{ gridTemplateColumns: '1fr auto' }}>
          <a href="#/settings">Top-up settings and how the system works</a><Settings2 size={18} />
        </div>
        <div className="row" style={{ gridTemplateColumns: '1fr auto' }}>
          <span>Appearance</span>
          <Seg label="Theme" value={theme} onChange={setTheme} options={[['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']]} />
        </div>
      </section>
    </>
  );
}
