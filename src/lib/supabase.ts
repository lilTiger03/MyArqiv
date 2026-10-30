import 'react-native-url-polyfill/auto';
import { createClient, processLock } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { sessionStorage } from './session-storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
export const accountsConfigured = Boolean(url && key && !key.startsWith('sb_secret_'));
export const supabase = accountsConfigured && (Platform.OS !== 'web' || typeof window !== 'undefined')
  ? createClient(url!, key!, { auth: {
    storage: sessionStorage, autoRefreshToken: true, persistSession: true,
    detectSessionInUrl: false, lock: processLock,
  } }) : null;
export function accountClient() {
  if (!supabase) throw new Error('Accounts are not connected yet. You can still browse Discover.');
  return supabase;
}
