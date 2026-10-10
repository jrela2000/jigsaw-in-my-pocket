// Creates the pending order row and the Stripe PaymentIntent. The amount is always computed here, never trusted from the app.
// The delivery address is handed straight to Stripe (PaymentIntent.shipping) and is never written to our database.
import { quote, type ShippingTier } from '../_shared/pricing.ts';
import { costFor } from '../_shared/printify.ts';
import { admin, cleanAddress, HttpError, isPro, json, serve, stripe, userOf } from '../_shared/util.ts';

serve(async (req) => {
  const user = await userOf(req);
  if (!user) throw new HttpError(401, 'Please restart the app and try again.');
  const body = await req.json();
  const db = admin();

  const storagePath = String(body.storagePath ?? '');
  if (!storagePath.startsWith(`${user.id}/`)) throw new HttpError(400, 'The print image is missing.');

  const pieces = Number(body.pieces);
  const tier: ShippingTier = body.shipping === 'express' ? 'express' : 'standard';
  const q = quote(pieces, await isPro(user.id), tier, costFor(pieces));
  const address = cleanAddress(body.address);

  const { data: order, error } = await db.from('print_orders').insert({
    user_id: user.id, piece_count: pieces, shipping_tier: tier, storage_upload_path: storagePath, total_amount_cents: q.totalCents,
  }).select('id').single();
  if (error || !order) throw new Error(error?.message ?? 'order insert failed');

  const intent = await stripe('payment_intents', {
    amount: String(q.totalCents), currency: 'usd', 'automatic_payment_methods[enabled]': 'true',
    'metadata[order_id]': order.id, description: `Jigsaw In My Pocket ${pieces}-piece puzzle`,
    'shipping[name]': address.name,
    'shipping[address][line1]': address.line1,
    ...(address.line2 ? { 'shipping[address][line2]': address.line2 } : {}),
    'shipping[address][city]': address.city,
    'shipping[address][state]': address.region,
    'shipping[address][postal_code]': address.postalCode,
    'shipping[address][country]': address.country,
    ...(address.email ? { receipt_email: address.email } : {}),
  });
  await db.from('print_orders').update({ stripe_payment_intent_id: intent.id }).eq('id', order.id);
  return json({ clientSecret: intent.client_secret, orderId: order.id, quote: q });
});
