// Single source of truth for print pricing. Imported by the Edge Functions (authoritative)
// and by the app (display only). Keep this file dependency-free so both Deno and Metro can load it.

export type ShippingTier = 'standard' | 'express';

export const PRICING = {
  currency: 'usd',
  /** Retail price per piece count, in cents. */
  retailCents: { 30: 2400, 110: 2800, 252: 3400, 500: 3900, 1000: 4500 } as Record<number, number>,
  /** Pro members get this fraction off the puzzle price (not shipping). */
  proDiscount: 0.15,
  shippingCents: { standard: 499, express: 1299 } as Record<ShippingTier, number>,
  /** Estimated sales tax rate applied to the discounted puzzle price. Replace with Stripe Tax when enabled. */
  taxRate: 0.085,
  /** Estimated Printify cost per piece count (base + US shipping), in cents. Verify with scripts/fetch-printify-catalog.mjs. */
  estimatedCostCents: { 30: 1350, 110: 1500, 252: 1750, 500: 2050, 1000: 2500 } as Record<number, number>,
  estimatedPrintifyShippingCents: 700,
  /** Markup used when a live Printify cost is available: retail = max(table price, cost * markup). */
  markup: 1.6,
};

export type Quote = {
  pieces: number;
  baseCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  isPro: boolean;
  shipping: ShippingTier;
};

export function quote(pieces: number, isPro: boolean, shipping: ShippingTier = 'standard', liveCostCents?: number): Quote {
  const table = PRICING.retailCents[pieces];
  if (table == null) throw new Error(`No print size for ${pieces} pieces`);
  const baseCents = liveCostCents != null ? Math.max(table, Math.ceil((liveCostCents * PRICING.markup) / 100) * 100) : table;
  const discountCents = isPro ? Math.round(baseCents * PRICING.proDiscount) : 0;
  const shippingCents = PRICING.shippingCents[shipping];
  const taxCents = Math.round((baseCents - discountCents) * PRICING.taxRate);
  return { pieces, baseCents, discountCents, shippingCents, taxCents, totalCents: baseCents - discountCents + shippingCents + taxCents, isPro, shipping };
}

/** Margin after Printify cost and Stripe fees (2.9% + 30c), as a fraction of what the customer pays before tax. */
export function margin(pieces: number, isPro: boolean) {
  const q = quote(pieces, isPro);
  const revenue = q.baseCents - q.discountCents + q.shippingCents;
  const stripeFee = Math.round((revenue + q.taxCents) * 0.029) + 30;
  const cost = PRICING.estimatedCostCents[pieces] + PRICING.estimatedPrintifyShippingCents + stripeFee;
  return { revenue, cost, profit: revenue - cost, margin: (revenue - cost) / revenue };
}

export const formatCents = (cents: number) => `${cents < 0 ? '-' : ''}$${(Math.abs(cents) / 100).toFixed(2)}`;
