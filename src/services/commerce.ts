import { env } from '../config/env';
import { readBytes } from '../lib/files';
import { newId } from '../lib/json';
import type { Quote, ShippingTier } from '../../supabase/functions/_shared/pricing';
import { ensureSession, supabase } from './supabase';

export type Address = {
  name: string; line1: string; line2: string; city: string; region: string; postalCode: string; country: string; email: string;
};
export type PrintOrder = {
  id: string; status: string; piece_count: number; total_amount_cents: number; tracking_number: string | null;
  tracking_url: string | null; created_at: string; title: string | null;
};
export type Gift = {
  token: string; senderName: string; recipientName: string; note: string | null; pieces: number; title: string;
  imageUrl: string; prepaid: boolean; rotation: boolean;
};

const NOT_READY = 'This needs the online services to be set up first (see SETUP_CHECKLIST.md).';

async function call<T>(fn: string, body: unknown): Promise<T> {
  if (!supabase) throw new Error(NOT_READY);
  await ensureSession();
  const { data, error } = await supabase.functions.invoke(fn, { body: body as Record<string, unknown> });
  if (error) {
    let message = error.message;
    try {
      const detail = await (error as any).context?.json?.();
      if (detail?.error) message = detail.error;
    } catch {}
    throw new Error(message);
  }
  return data as T;
}

async function upload(bucket: 'print_uploads' | 'puzzle_gifts', uri: string): Promise<string> {
  const uid = await ensureSession();
  if (!supabase || !uid) throw new Error(NOT_READY);
  const path = `${uid}/${newId()}.jpg`;
  const { error } = await supabase.storage.from(bucket).upload(path, await readBytes(uri), { contentType: 'image/jpeg' });
  if (error) throw new Error(error.message);
  return path;
}

/** Server-side quote: live Printify cost, markup and the verified Pro discount. */
export const fetchQuote = (pieces: number, shipping: ShippingTier, country: string) =>
  call<Quote>('quote-print-order', { pieces, shipping, country });

/** Uploads the full-resolution image and creates the Stripe PaymentIntent. */
export async function startPrintOrder(input: {
  imageUri: string; pieces: number; title: string; shipping: ShippingTier; address: Address | null;
  giftToken?: string; boxText?: string; giftMessage?: string; isGift?: boolean;
}) {
  const storagePath = await upload('print_uploads', input.imageUri);
  const { imageUri: _omit, ...rest } = input;
  return call<{ clientSecret: string; orderId: string; quote: Quote }>('create-payment-intent', { ...rest, storagePath });
}

export async function listOrders(): Promise<PrintOrder[]> {
  const uid = await ensureSession();
  if (!supabase || !uid) return [];
  const { data, error } = await supabase
    .from('print_orders')
    .select('id,status,piece_count,total_amount_cents,tracking_number,tracking_url,created_at,title')
    .neq('status', 'pending_payment')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as PrintOrder[];
}

export async function createGift(input: {
  imageUri: string; title: string; pieces: number; rotation: boolean; senderName: string; recipientName: string; note: string;
}): Promise<{ token: string; url: string }> {
  const uid = await ensureSession();
  if (!supabase || !uid) throw new Error(NOT_READY);
  const storagePath = await upload('puzzle_gifts', input.imageUri);
  const token = newId() + newId();
  const { error } = await supabase.from('gifts').insert({
    token, sender_id: uid, sender_name: input.senderName, recipient_name: input.recipientName, personal_note: input.note || null,
    piece_count: input.pieces, storage_path: storagePath, title: input.title, rotation: input.rotation,
  });
  if (error) throw new Error(error.message);
  return { token, url: `${env.giftBaseUrl}/${token}` };
}

export const fetchGift = (token: string) => call<Gift>('get-gift', { token });

/** Recipient of a prepaid gift supplies the delivery address; the print is then sent to production. */
export const claimGiftPrint = (token: string, address: Address) => call<{ ok: true }>('claim-gift-print', { token, address });

export const ORDER_STATUS: Record<string, string> = {
  paid: 'Payment received',
  awaiting_address: 'Waiting for recipient address',
  submitted: 'Sent to the print studio',
  in_production: 'In production',
  shipped: 'Shipped',
  delivered: 'Delivered',
  canceled: 'Canceled',
  failed: 'Needs attention — we will email you',
};
