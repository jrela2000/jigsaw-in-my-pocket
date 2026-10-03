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

export async function syncProfile(patch: { birth_year?: number; ump_consent_status?: string; att_status?: string }) {
  const id = await ensureSession();
  if (!supabase || !id) return;
  const { error } = await supabase.from('profiles').upsert({ id, ...patch, updated_at: new Date().toISOString() });
  if (error) console.warn('[supabase] profile sync failed', error.message);
}

/** Attaches an email to the anonymous account so purchases and orders can be recovered on another device. */
export async function linkEmail(email: string): Promise<{ ok: boolean; message: string }> {
  const id = await ensureSession();
  if (!supabase || !id) return { ok: false, message: 'Cloud sync is not available right now.' };
  const { error } = await supabase.auth.updateUser({ email });
  return error ? { ok: false, message: error.message } : { ok: true, message: 'Check your inbox to confirm your email.' };
}

export async function recordUnlock(puzzleId: string, pieces: number) {
  const id = await ensureSession();
  if (!supabase || !id) return;
  await supabase.from('unlocks').insert({ user_id: id, puzzle_id: puzzleId, unlocked_piece_count: pieces });
}

export async function consumeUnlock(puzzleId: string) {
  const id = await ensureSession();
  if (!supabase || !id) return;
  await supabase.from('unlocks').update({ used: true }).eq('user_id', id).eq('puzzle_id', puzzleId);
}
