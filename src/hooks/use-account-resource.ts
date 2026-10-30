import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

/** Scoped screens are remounted when the signed-in user changes. Ignore stale refreshes too. */
export function useAccountResource<T>(load: () => Promise<T>, initial: T) {
  const [data, setData] = useState(initial); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const version = useRef(0);
  const reload = useCallback(async () => {
    const request = ++version.current; setLoading(true); setError('');
    try { const result = await load(); if (request === version.current) setData(result); }
    catch (failure) { if (request === version.current) setError(failure instanceof Error ? failure.message : 'Could not load this page.'); }
    finally { if (request === version.current) setLoading(false); }
  }, [load]);
  useFocusEffect(useCallback(() => { void reload(); return () => { version.current++; }; }, [reload]));
  return { data, loading, error, reload };
}
