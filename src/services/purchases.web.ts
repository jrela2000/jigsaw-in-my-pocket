// Web preview has no store billing: plans are placeholders and purchases are unavailable.
export const ENTITLEMENT = 'pro';
export type PlanId = 'pro_yearly' | 'pro_monthly';
export type Plan = { id: PlanId; priceString: string; perMonth: string | null; trialDays: number | null; pkg: unknown };
export type PurchaseOutcome = { ok: boolean; cancelled?: boolean; message?: string };

const PLACEHOLDER: Plan[] = [
  { id: 'pro_yearly', priceString: '$24.99', perMonth: '$2.08', trialDays: null, pkg: null },
  { id: 'pro_monthly', priceString: '$3.99', perMonth: null, trialDays: null, pkg: null },
];
const unavailable = 'Subscriptions are only available in the iOS and Android apps.';

export async function initPurchases(_appUserId: string | null) {}
export async function getPlans(): Promise<{ plans: Plan[]; live: boolean }> {
  return { plans: PLACEHOLDER, live: false };
}
export async function purchasePlan(_plan: Plan): Promise<PurchaseOutcome> {
  return { ok: false, message: unavailable };
}
export async function restorePurchases(): Promise<PurchaseOutcome> {
  return { ok: false, message: unavailable };
}
