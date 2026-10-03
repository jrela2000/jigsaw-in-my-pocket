// Returns the authoritative price for a print: retail (or live cost x markup), verified Pro discount, shipping and tax.
import { quote, type ShippingTier } from '../_shared/pricing.ts';
import { costFor } from '../_shared/printify.ts';
import { HttpError, isPro, json, serve, userOf } from '../_shared/util.ts';

serve(async (req) => {
  const user = await userOf(req);
  if (!user) throw new HttpError(401, 'Please restart the app and try again.');
  const { pieces, shipping } = await req.json();
  const tier: ShippingTier = shipping === 'express' ? 'express' : 'standard';
  return json(quote(Number(pieces), await isPro(user.id), tier, costFor(Number(pieces))));
});
