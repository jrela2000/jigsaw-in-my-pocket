// Printify webhook. Deploy with --no-verify-jwt; authenticity comes from the X-Pfy-Signature HMAC.
import { admin, env, hmacHex, json, safeEqual } from '../_shared/util.ts';

const STATUS: Record<string, string> = {
  'order:sent-to-production': 'in_production',
  'order:shipment:created': 'shipped',
  'order:shipment:delivered': 'delivered',
};

Deno.serve(async (req) => {
  const raw = await req.text();
  const sig = (req.headers.get('X-Pfy-Signature') ?? '').replace(/^sha256=/, '');
  if (!sig || !safeEqual(await hmacHex(env('PRINTIFY_WEBHOOK_SECRET'), raw), sig)) return json({ error: 'bad signature' }, 401);

  const event = JSON.parse(raw);
  const status = STATUS[event.type];
  if (!status) return json({ received: true });
  const carrier = event.resource?.data?.carrier ?? {};
  await admin().from('print_orders').update({
    status,
    ...(carrier.tracking_number ? { tracking_number: carrier.tracking_number, tracking_url: carrier.tracking_url ?? null } : {}),
    ...(status === 'delivered' ? { delivered_at: new Date().toISOString() } : {}),
    updated_at: new Date().toISOString(),
  }).eq('printify_order_id', String(event.resource?.id));
  return json({ received: true });
});
