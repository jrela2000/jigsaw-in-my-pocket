import React from 'react';
import { StripeProvider, initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';
import { APP_NAME, configured, env } from '../config/env';

export function PaymentsProvider({ children }: { children: React.ReactElement }) {
  if (!configured.stripe) return children;
  return (
    <StripeProvider publishableKey={env.stripePublishableKey} merchantIdentifier="merchant.com.jigsawinmypocket.app" urlScheme="jigsawinmypocket">
      {children}
    </StripeProvider>
  );
}

export type PayOutcome = { ok: boolean; cancelled?: boolean; message?: string };

/** Presents the Stripe Payment Sheet (cards, Apple Pay, Google Pay) for a PaymentIntent created by our Edge Function. */
export async function pay(clientSecret: string, name?: string): Promise<PayOutcome> {
  if (!configured.stripe) return { ok: false, message: 'Print checkout is not configured in this build yet.' };
  const init = await initPaymentSheet({
    merchantDisplayName: APP_NAME,
    paymentIntentClientSecret: clientSecret,
    applePay: { merchantCountryCode: 'US' },
    googlePay: { merchantCountryCode: 'US', testEnv: __DEV__ },
    returnURL: 'jigsawinmypocket://stripe-redirect',
    defaultBillingDetails: name ? { name } : undefined,
  });
  if (init.error) return { ok: false, message: init.error.message };
  const { error } = await presentPaymentSheet();
  if (!error) return { ok: true };
  if (error.code === 'Canceled') return { ok: false, cancelled: true };
  return { ok: false, message: error.message };
}
