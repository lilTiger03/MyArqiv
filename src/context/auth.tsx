import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { getProfile, type AccountProfile } from '@/lib/community';
import { supabase, accountsConfigured } from '@/lib/supabase';

type AuthState = { session: Session | null; profile: AccountProfile | null; ready: boolean; error: string; configured: boolean; refreshProfile: () => Promise<void> };
const AuthContext = createContext<AuthState>({ session: null, profile: null, ready: false, error: '', configured: accountsConfigured, refreshProfile: async () => {} });
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const currentUser = useRef<string | null>(null);
  useEffect(() => {
    if (!supabase) return;
    let active = true; let lastUser: string | null | undefined; let generation = 0;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    async function sync(next: Session | null) {
      if (!active) return;
      setSession(next);
      const id = next?.user.id || null;
      if (id === lastUser) return;
      lastUser = id; currentUser.current = id;
      const version = ++generation;
      setProfile(null); setError(''); setReady(false);
      try {
        const result = id ? await getProfile(id) : null;
        if (active && generation === version) setProfile(result);
      } catch (failure) { if (active && generation === version) setError(failure instanceof Error ? failure.message : 'Could not load your profile.'); }
      finally { if (active && generation === version) setReady(true); }
    }
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      const timer = setTimeout(() => { timers.delete(timer); void sync(next); }, 0); timers.add(timer);
    });
    void supabase.auth.getSession().then(({ data, error: failure }) => {
      if (failure && active) { setError(failure.message); setReady(true); }
      else void sync(data.session);
    }).catch(failure => { if (active) { setError(failure instanceof Error ? failure.message : 'Could not restore your session.'); setReady(true); } });
    const appState = AppState.addEventListener('change', state => {
      if (Platform.OS !== 'web') { if (state === 'active') supabase?.auth.startAutoRefresh(); else supabase?.auth.stopAutoRefresh(); }
    });
    return () => { active = false; generation++; subscription.subscription.unsubscribe(); appState.remove(); timers.forEach(clearTimeout); };
  }, []);
  const refreshProfile = useCallback(async () => {
    const id = currentUser.current;
    if (!id) return;
    setError('');
    try { const result = await getProfile(id); if (currentUser.current === id) setProfile(result); }
    catch (failure) { if (currentUser.current === id) setError(failure instanceof Error ? failure.message : 'Could not load your profile.'); }
  }, []);
  return <AuthContext.Provider value={{ session, profile, ready: !accountsConfigured || ready, error, configured: accountsConfigured, refreshProfile }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
