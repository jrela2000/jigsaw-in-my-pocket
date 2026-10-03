import { quote, margin, formatCents, PRICING } from '../supabase/functions/_shared/pricing';

describe('print pricing', () => {
  it('matches the designed 252-piece Pro checkout', () => {
    const q = quote(252, true, 'standard');
    expect(q.baseCents).toBe(3400);
    expect(q.discountCents).toBe(510);
    expect(q.shippingCents).toBe(499);
    expect(q.taxCents).toBe(246);
    expect(q.totalCents).toBe(3400 - 510 + 499 + 246);
  });
  it('charges full price on the free tier', () => {
    const q = quote(252, false);
    expect(q.discountCents).toBe(0);
    expect(q.totalCents).toBe(3400 + 499 + Math.round(3400 * PRICING.taxRate));
  });
  it('never discounts shipping', () => {
    expect(quote(500, true, 'express').shippingCents).toBe(1299);
  });
  it('keeps 500-1000 piece retail within the $35-45 target', () => {
    for (const n of [500, 1000]) {
      expect(quote(n, false).baseCents).toBeGreaterThanOrEqual(3500);
      expect(quote(n, false).baseCents).toBeLessThanOrEqual(4500);
    }
  });
  it('raises retail when the live Printify cost would break the markup', () => {
    expect(quote(252, false, 'standard', 1750).baseCents).toBe(3400);
    expect(quote(252, false, 'standard', 3000).baseCents).toBe(4800);
  });
  it('rejects unknown sizes', () => {
    expect(() => quote(123, false)).toThrow();
  });
  it('computes margin after cost and fees', () => {
    const m = margin(252, false);
    expect(m.profit).toBe(m.revenue - m.cost);
    expect(margin(252, true).margin).toBeLessThan(m.margin);
  });
  it('formats money', () => {
    expect(formatCents(3634)).toBe('$36.34');
    expect(formatCents(-510)).toBe('-$5.10');
  });
});
