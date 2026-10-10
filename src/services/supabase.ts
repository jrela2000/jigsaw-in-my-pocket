import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { configured, env } from '../config/env';
import { kv } from '../lib/kv';

const storage = {
  getItem: (key: string) => kv.get(key),
  setItem: (key: string, value: string) => kv.set(key, value),
  removeItem: (key: string) => kv.remove(key),
};

/** Null until Supabase keys are provided; the app then runs fully on-device. */
export const supabase: SupabaseClient | null = configured.supabase
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null;

let userId: string | null = null;
let pending: Promise<string | null> | null = null;

/** Silent anonymous sign-in. Resolves to the user id, or null when offline / not configured. */
export function ensureSession(): Promise<string | null> {
  if (!supabase) return Promise.resolve(null);
  if (userId) return Promise.resolve(userId);
  pending ??= (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) return (userId = data.session.user.id);
      const res = await supabase.auth.signInAnonymously();
      if (res.error) throw res.error;
      return (userId = res.data.user?.id ?? null);
    } catch (err) {
      console.warn('[supabase] anonymous sign-in failed', err);
      return null;
    } finally {
      pending = null;
    }
  })();
  return pending;
}

export const currentUserId = () => userId;

/** Forgets the cached identity after the cloud data has been erased. */
export const forgetSession = () => {
  userId = null;
};
