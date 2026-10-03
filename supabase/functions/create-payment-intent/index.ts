// Creates the pending order row and the Stripe PaymentIntent. The amount is always computed here, never trusted from the app.
import { quote, type ShippingTier } from '../_shared/pricing.ts';
import { costFor } from '../_shared/printify.ts';
import { admin, cleanAddress, HttpError, isPro, json, serve, stripe, userOf } from '../_shared/util.ts';

serve(async (req) => {
  const user = await userOf(req);
  if (!user) throw new HttpError(401, 'Please restart the app and try again.');
  const body = await req.json();
  const db = admin();

  const { data: profile } = await db.from('profiles').select('birth_year').eq('id', user.id).maybeSingle();
  if (profile?.birth_year && profile.birth_year > new Date().getFullYear() - 13) throw new HttpError(403, 'Print ordering is not available for this profile.');

  const storagePath = String(body.storagePath ?? '');
  if (!storagePath.startsWith(`${user.id}/`)) throw new HttpError(400, 'The print image is missing.');

  const pieces = Number(body.pieces);
  const tier: ShippingTier = body.shipping === 'express' ? 'express' : 'standard';
  const q = quote(pieces, await isPro(user.id), tier, costFor(pieces));

  let giftToken: string | null = null;
  if (body.giftToken) {
    const { data: gift } = await db.from('gifts').select('token,sender_id').eq('token', String(body.giftToken)).maybeSingle();
    if (!gift || gift.sender_id !== user.id) throw new HttpError(400, 'This gift could not be found.');
    giftToken = gift.token;
  }
  // A prepaid gift has no address yet: the recipient supplies it later.
  const address = giftToken ? null : cleanAddress(body.address);

  const { data: order, error } = await db.from('print_orders').insert({
    user_id: user.id, piece_count: pieces, title: String(body.title ?? '').slice(0, 80) || null, shipping_tier: tier,
    shipping_address: address, gift_token: giftToken, storage_upload_path: storagePath, total_amount_cents: q.totalCents,
    personalization: { boxText: String(body.boxText ?? '').slice(0, 32), giftMessage: String(body.giftMessage ?? '').slice(0, 200), isGift: !!body.isGift },
  }).select('id').single();
  if (error || !order) throw new Error(error?.message ?? 'order insert failed');

  const intent = await stripe('payment_intents', {
    amount: String(q.totalCents), currency: 'usd', 'automatic_payment_methods[enabled]': 'true',
    'metadata[order_id]': order.id, description: `Studio Jigsaw ${pieces}-piece puzzle`,
    ...(address?.email ? { receipt_email: address.email } : {}),
  });
  await db.from('print_orders').update({ stripe_payment_intent_id: intent.id }).eq('id', order.id);
  return json({ clientSecret: intent.client_secret, orderId: order.id, quote: q });
});
