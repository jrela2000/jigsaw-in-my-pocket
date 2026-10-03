# Print margins

> **These Printify costs are estimates.** I could not query your Printify account, so the base costs and Printify shipping below are placeholders taken from typical catalog prices. Run `node scripts/fetch-printify-catalog.mjs`, check the real cost of each variant in the Printify dashboard, then update `estimatedCostCents` in `supabase/functions/_shared/pricing.ts` and re-check this table.

Assumptions: customer pays standard shipping $4.99; Printify charges about $7.00 to ship one puzzle in the US; Stripe takes 2.9% + $0.30; sales tax is collected and passed through, so it is not revenue. Margin = profit / (puzzle price + shipping charged).

| Pieces | Retail | Pro price (15% off) | Printify base (est.) | Free-tier profit | Free-tier margin | Pro profit | Pro margin |
|---|---|---|---|---|---|---|---|
| 30 | $24.00 | $20.40 | $13.50 | $7.29 | 25% | $3.80 | 15% ⚠️ |
| 110 | $28.00 | $23.80 | $15.00 | $9.66 | 29% | $5.60 | 19% ⚠️ |
| 252 | $34.00 | $28.90 | $17.50 | $12.98 | 33% | $8.04 | 24% ⚠️ |
| 500 | $39.00 | $33.15 | $20.50 | $14.82 | 34% | $9.15 | 24% ⚠️ |
| 1000 | $45.00 | $38.25 | $25.00 | $16.13 | 32% | $9.59 | 22% ⚠️ |

## Flagged: Pro margin below 30%

With the estimated costs, the Pro price falls below a 30% margin at: **30, 110, 252, 500, 1000 pieces**.

Options, in the order I would consider them:

1. **Raise shipping, not the puzzle price.** Charging $6.99 instead of $4.99 covers Printify shipping and lifts every row by about 4 points while keeping the headline prices under Walgreens ($34.99 for 252) and MakeYourPuzzles ($39.99 for 1000).
2. **Lower the Pro discount to 10%.** It is one constant (`proDiscount`).
3. **Accept the thinner margin on Pro orders** as the cost of the subscription perk; subscription revenue offsets it.

Retail prices sit inside the $35–45 target for 500 and 1000 pieces. The server never sells below cost × 1.6: if you add real costs via the `PRINTIFY_COSTS` secret, the quote rises automatically when a cost increase would break the markup.
