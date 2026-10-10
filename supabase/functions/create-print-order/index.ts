// Stripe webhook (payment_intent.succeeded). Deploy with --no-verify-jwt; authenticity comes from the Stripe signature.
// The delivery address is read from the Stripe event and passed to Printify; it is never stored by us.
import { submitToPrintify } from '../_shared/printify.ts';
import { admin, type Address, env, hmacHex, json, safeEqual } from '../_shared/util.ts';

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
  const intent = event.data.object;
  const db = admin();
  // Idempotent: Stripe retries webhooks, so claim the order only while it is still unpaid.
  const { data: order } = await db.from('print_orders')
    .update({ status: 'paid', updated_at: new Date().toISOString() })
    .eq('id', intent.metadata?.order_id).eq('status', 'pending_payment').select('*').maybeSingle();
  if (!order) return json({ received: true });

  try {
    const s = intent.shipping;
    if (!s?.address?.line1) throw new Error('PaymentIntent has no shipping address');
    const address: Address = {
      name: s.name, line1: s.address.line1, line2: s.address.line2 ?? '', city: s.address.city, region: s.address.state,
      postalCode: s.address.postal_code, country: s.address.country, email: intent.receipt_email ?? '',
    };
    await submitToPrintify(db, order, address);
  } catch (err) {
    console.error('Printify submission failed', err);
    await db.from('print_orders').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', order.id);
  }
  return json({ received: true });
});
