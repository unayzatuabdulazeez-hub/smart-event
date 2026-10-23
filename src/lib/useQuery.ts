'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { friendlyError } from './errors';

/** Tiny fetch hook: loading / error / reload. Errors are always converted to friendly text. */
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const run = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await fnRef.current()); }
    catch (e) { setError(friendlyError(e, 'Unable to load this page. Please try again.')); }
    finally { setLoading(false); }
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { run(); }, deps);
  return { data, loading, error, reload: run, setData };
}

/** Throws the Supabase error so useQuery/handlers can map it. */
export function must<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data as T;
}
