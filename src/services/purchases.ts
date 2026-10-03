import Purchases, { CustomerInfo, PurchasesPackage, LOG_LEVEL } from 'react-native-purchases';
import { configured, env } from '../config/env';
import { useEntitlement } from '../store/entitlement';

export const ENTITLEMENT = 'pro';
export type PlanId = 'pro_yearly' | 'pro_monthly';
export type Plan = { id: PlanId; priceString: string; perMonth: string | null; trialDays: number | null; pkg: unknown };

// Shown only while RevenueCat is not configured (development / design review).
const PLACEHOLDER: Plan[] = [
  { id: 'pro_yearly', priceString: '$24.99', perMonth: '$2.08', trialDays: null, pkg: null },
  { id: 'pro_monthly', priceString: '$3.99', perMonth: null, trialDays: null, pkg: null },
];

let ready = false;

function apply(info: CustomerInfo) {
  const ent = info.entitlements.active[ENTITLEMENT];
  useEntitlement.getState().setStore({
    storePro: !!ent,
    managementUrl: info.managementURL,
    expiresAt: ent?.expirationDate ?? null,
    planId: ent?.productIdentifier ?? null,
  });
}

/** Configures RevenueCat with the Supabase user id as the app user id (anonymous RevenueCat id if none). */
export async function initPurchases(appUserId: string | null) {
  if (!configured.purchases || ready) return;
  try {
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN);
    Purchases.configure({ apiKey: env.revenueCatKey, appUserID: appUserId ?? undefined });
    ready = true;
    Purchases.addCustomerInfoUpdateListener(apply);
    apply(await Purchases.getCustomerInfo());
  } catch (err) {
    console.warn('[purchases] init failed', err);
  }
}

export async function getPlans(): Promise<{ plans: Plan[]; live: boolean }> {
  if (!ready) return { plans: PLACEHOLDER, live: false };
  try {
    const offerings = await Purchases.getOfferings();
    const packages = offerings.current?.availablePackages ?? [];
    const plans: Plan[] = [];
    for (const pkg of packages) {
      const id = pkg.product.identifier.split(':')[0];
      if (id !== 'pro_yearly' && id !== 'pro_monthly') continue;
      const intro = pkg.product.introPrice;
      const trialDays = intro && intro.price === 0 ? intro.periodNumberOfUnits * ({ DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 }[intro.periodUnit] ?? 1) : null;
      plans.push({
        id,
        priceString: pkg.product.priceString,
        perMonth: id === 'pro_yearly' ? (pkg.product.pricePerMonthString ?? null) : null,
        trialDays,
        pkg,
      });
    }
    plans.sort((a) => (a.id === 'pro_yearly' ? -1 : 1));
    return plans.length ? { plans, live: true } : { plans: PLACEHOLDER, live: false };
  } catch (err) {
    console.warn('[purchases] offerings failed', err);
    return { plans: PLACEHOLDER, live: false };
  }
}

export type PurchaseOutcome = { ok: boolean; cancelled?: boolean; message?: string };

export async function purchasePlan(plan: Plan): Promise<PurchaseOutcome> {
  if (!ready || !plan.pkg) return { ok: false, message: 'Subscriptions are not available in this build yet.' };
  try {
    const { customerInfo } = await Purchases.purchasePackage(plan.pkg as PurchasesPackage);
    apply(customerInfo);
    return { ok: !!customerInfo.entitlements.active[ENTITLEMENT] };
  } catch (err: any) {
    if (err?.userCancelled) return { ok: false, cancelled: true };
    return { ok: false, message: err?.message ?? 'The purchase could not be completed.' };
  }
}

export async function restorePurchases(): Promise<PurchaseOutcome> {
  if (!ready) return { ok: false, message: 'Subscriptions are not available in this build yet.' };
  try {
    const info = await Purchases.restorePurchases();
    apply(info);
    const ok = !!info.entitlements.active[ENTITLEMENT];
    return { ok, message: ok ? 'Your Pro membership has been restored.' : 'No active membership was found for this store account.' };
  } catch (err: any) {
    return { ok: false, message: err?.message ?? 'Restore failed. Please try again.' };
  }
}
