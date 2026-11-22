import { useCallback, useEffect, useRef, useState } from 'react';

/** Fetch now and every `ms`, pausing while the tab is hidden. */
export function usePoll<T>(fn: () => Promise<T>, ms: number, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const load = useCallback(async () => {
    try { setData(await fnRef.current()); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, []);
  useEffect(() => {
    load();
    const id = setInterval(() => { if (!document.hidden) load(); }, ms);
    const vis = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', vis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, load, ...deps]);
  return { data, error, reload: load };
}

export function useSize<E extends HTMLElement>() {
  const ref = useRef<E>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function useTick(ms = 1000) {
  const [, set] = useState(0);
  useEffect(() => { const id = setInterval(() => set((x) => x + 1), ms); return () => clearInterval(id); }, [ms]);
}

export function useHashRoute(): string {
  const get = () => (location.hash.replace(/^#\/?/, '') || 'overview').split('?')[0];
  const [r, set] = useState(get);
  useEffect(() => {
    const on = () => { set(get()); window.scrollTo({ top: 0 }); };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return r;
}
