import { Platform } from 'react-native';

// Only public, client-safe values belong here. Secrets (Printify token, Stripe secret key,
// Supabase service role key, RevenueCat secret key) live in Supabase function secrets.
const e = process.env;

export const env = {
  supabaseUrl: e.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: e.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  revenueCatKey: (Platform.OS === 'ios' ? e.EXPO_PUBLIC_REVENUECAT_IOS_KEY : e.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY) ?? '',
  stripePublishableKey: e.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
  admobRewardedId: (Platform.OS === 'ios' ? e.EXPO_PUBLIC_ADMOB_IOS_REWARDED_ID : e.EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_ID) ?? '',
  admobInterstitialId: (Platform.OS === 'ios' ? e.EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_ID : e.EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_ID) ?? '',
  termsUrl: e.EXPO_PUBLIC_TERMS_URL ?? '',
  privacyUrl: e.EXPO_PUBLIC_PRIVACY_URL ?? '',
};

export const configured = {
  supabase: !!env.supabaseUrl && !!env.supabaseAnonKey,
  purchases: !!env.revenueCatKey,
  stripe: !!env.stripePublishableKey,
};

export const APP_NAME = 'Jigsaw In My Pocket';
export const LEGAL_NOTICE =
  'Jigsaw In My Pocket is intended for users 13 and older (16 in the EU/UK). By using the app you confirm you meet this age requirement. Users under 18 need a parent or guardian\'s permission to make purchases. Only upload photos you own or have permission to use.';
export const FREE_HINTS = 3;
