import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

export const env = (name: string, required = true): string => {
  const v = Deno.env.get(name) ?? '';
  if (!v && required) throw new Error(`Missing secret ${name}`);
  return v;
};

/** Service-role client. Never expose anything it returns without checking ownership first. */
export const admin = (): SupabaseClient =>
  createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

/** The signed-in (anonymous) user making this request, or null. */
export async function userOf(req: Request): Promise<{ id: string } | null> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data } = await admin().auth.getUser(token);
  return data.user ? { id: data.user.id } : null;
}

/** Wraps a handler with CORS, method check and uniform error responses. */
export function serve(handler: (req: Request) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    try {
      return await handler(req);
    } catch (err) {
      console.error(err);
      const message = err instanceof HttpError ? err.message : 'Something went wrong. Please try again.';
      return json({ error: message }, err instanceof HttpError ? err.status : 500);
    }
  });
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Server-side check of the Pro entitlement, so the print discount cannot be faked by the app. */
export async function isPro(userId: string): Promise<boolean> {
  const key = env('REVENUECAT_SECRET_KEY', false);
  if (!key) return false;
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, { headers: { Authorization: `Bearer ${key}` } });
  if (!res.ok) return false;
  const body = await res.json();
  const ent = body?.subscriber?.entitlements?.pro;
  return !!ent && (ent.expires_date == null || new Date(ent.expires_date).getTime() > Date.now());
}

export type Address = { name: string; line1: string; line2?: string; city: string; region: string; postalCode: string; country: string; email?: string };

export function cleanAddress(a: unknown): Address {
  const x = (a ?? {}) as Record<string, unknown>;
  const s = (k: string, max = 120) => String(x[k] ?? '').trim().slice(0, max);
  const out = { name: s('name'), line1: s('line1'), line2: s('line2'), city: s('city'), region: s('region'), postalCode: s('postalCode', 20), country: s('country', 2).toUpperCase(), email: s('email', 200) };
  for (const k of ['name', 'line1', 'city', 'region', 'postalCode', 'country'] as const) if (!out[k]) throw new HttpError(400, 'The delivery address is incomplete.');
  return out;
}

export async function stripe(path: string, params: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('STRIPE_SECRET_KEY')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Stripe: ${body?.error?.message ?? res.status}`);
  return body;
}
