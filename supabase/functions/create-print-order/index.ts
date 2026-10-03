// Stripe webhook (payment_intent.succeeded). Deploy with --no-verify-jwt; authenticity comes from the Stripe signature.
import { submitToPrintify } from '../_shared/printify.ts';
import { admin, env, hmacHex, json, safeEqual } from '../_shared/util.ts';

Deno.serve(async (req) => {
  const raw = await req.text();
  const header = req.headers.get('Stripe-Signature') ?? '';
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]));
  const expected = await hmacHex(env('STRIPE_WEBHOOK_SECRET'), `${parts.t}.${raw}`);
  if (!parts.t || !parts.v1 || !safeEqual(expected, parts.v1) || Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) {
    return json({ error: 'bad signature' }, 400);
  }

  const event = JSON.parse(raw);
  if (event.type !== 'payment_intent.succeeded') return json({ received: true });
  const orderId = event.data.object.metadata?.order_id;
  const db = admin();
  const { data: order } = await db.from('print_orders').select('*').eq('id', orderId).maybeSingle();
  // Idempotent: Stripe retries webhooks, so only act on an order that is still unpaid.
  if (!order || order.status !== 'pending_payment') return json({ received: true });

  if (order.gift_token && !order.shipping_address) {
    await db.from('print_orders').update({ status: 'awaiting_address', updated_at: new Date().toISOString() }).eq('id', order.id);
    await db.from('gifts').update({ is_prepaid_print: true, print_order_id: order.id }).eq('token', order.gift_token);
    return json({ received: true });
  }

  await db.from('print_orders').update({ status: 'paid', updated_at: new Date().toISOString() }).eq('id', order.id);
  try {
    await submitToPrintify(db, order);
  } catch (err) {
    console.error('Printify submission failed', err);
    await db.from('print_orders').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', order.id);
  }
  return json({ received: true });
});
