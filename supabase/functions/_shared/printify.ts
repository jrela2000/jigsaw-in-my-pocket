import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { type Address, env } from './util.ts';

const API = 'https://api.printify.com/v1';

async function printify(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env('PRINTIFY_API_TOKEN')}`, 'Content-Type': 'application/json', 'User-Agent': 'StudioJigsaw' },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Printify ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}

/** Variant id for a piece count, from the PRINTIFY_VARIANTS secret, e.g. {"30":111,"110":222,...}. */
export function variantFor(pieces: number): number {
  const map = JSON.parse(env('PRINTIFY_VARIANTS')) as Record<string, number>;
  const id = map[String(pieces)];
  if (!id) throw new Error(`No Printify variant configured for ${pieces} pieces`);
  return id;
}

/** Optional live cost table (cents) from the PRINTIFY_COSTS secret, e.g. {"252":1750}. */
export function costFor(pieces: number): number | undefined {
  const raw = env('PRINTIFY_COSTS', false);
  if (!raw) return undefined;
  const v = (JSON.parse(raw) as Record<string, number>)[String(pieces)];
  return typeof v === 'number' ? v : undefined;
}

/** Sends a paid order to Printify: image by signed URL, variant by piece count, then into production. */
export async function submitToPrintify(db: SupabaseClient, order: {
  id: string; piece_count: number; storage_upload_path: string; shipping_tier: string; shipping_address: Address;
}) {
  const signed = await db.storage.from('print_uploads').createSignedUrl(order.storage_upload_path, 60 * 60 * 24);
  if (signed.error || !signed.data) throw new Error(`Could not sign print image: ${signed.error?.message}`);
  const upload = await printify('/uploads/images.json', { method: 'POST', body: JSON.stringify({ file_name: `${order.id}.jpg`, url: signed.data.signedUrl }) });

  const a = order.shipping_address;
  const [first, ...rest] = a.name.split(' ');
  const shop = env('PRINTIFY_SHOP_ID');
  const created = await printify(`/shops/${shop}/orders.json`, {
    method: 'POST',
    body: JSON.stringify({
      external_id: order.id,
      label: `SJ-${order.id.slice(0, 8)}`,
      line_items: [{
        print_provider_id: Number(env('PRINTIFY_PROVIDER_ID')),
        blueprint_id: Number(env('PRINTIFY_BLUEPRINT_ID')),
        variant_id: variantFor(order.piece_count),
        print_areas: { front: upload.preview_url ?? signed.data.signedUrl },
        quantity: 1,
      }],
      shipping_method: order.shipping_tier === 'express' ? 2 : 1,
      send_shipping_notification: !!a.email,
      address_to: {
        first_name: first, last_name: rest.join(' ') || first, email: a.email || undefined, country: a.country, region: a.region,
        address1: a.line1, address2: a.line2 || undefined, city: a.city, zip: a.postalCode,
      },
    }),
  });
  await printify(`/shops/${shop}/orders/${created.id}/send_to_production.json`, { method: 'POST' });
  await db.from('print_orders').update({ printify_order_id: created.id, status: 'submitted', updated_at: new Date().toISOString() }).eq('id', order.id);
  return created.id as string;
}
