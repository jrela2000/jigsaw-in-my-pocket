import { Platform } from 'react-native';
import mobileAds, {
  AdEventType, AdsConsent, AdsConsentPrivacyOptionsRequirementStatus, InterstitialAd, MaxAdContentRating,
  RewardedAd, RewardedAdEventType, TestIds,
} from 'react-native-google-mobile-ads';
import { getTrackingPermissionsAsync, requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import { env } from '../config/env';
import { getIsPro } from '../store/entitlement';
import { isUnder13, useSettings } from '../store/settings';
import { syncProfile } from './supabase';

// Development builds always use Google's test units; real IDs only come from production env vars.
const rewardedId = __DEV__ || !env.admobRewardedId ? TestIds.REWARDED : env.admobRewardedId;
const interstitialId = __DEV__ || !env.admobInterstitialId ? TestIds.INTERSTITIAL : env.admobInterstitialId;

const INTERSTITIAL_EVERY = 3;
const MIN_AD_GAP_MS = 3 * 60 * 1000;

let initialized = false;
let initializing: Promise<boolean> | null = null;
let nonPersonalized = true;

/**
 * Consent first (Google UMP, then Apple ATT), then the SDK. Never runs for Pro members,
 * so the ad SDK is not even initialized for them.
 */
export function initAds(): Promise<boolean> {
  if (getIsPro()) return Promise.resolve(false);
  if (initialized) return Promise.resolve(true);
  initializing ??= (async () => {
    try {
      const child = isUnder13(useSettings.getState().birthYear);
      const consent = await AdsConsent.gatherConsent({ tagForUnderAgeOfConsent: child }).catch(() => AdsConsent.getConsentInfo());
      let att = 'unavailable';
      if (Platform.OS === 'ios' && !child) {
        const current = await getTrackingPermissionsAsync();
        att = current.canAskAgain && !current.granted ? (await requestTrackingPermissionsAsync()).status : current.status;
      }
      nonPersonalized = child || (Platform.OS === 'ios' && att !== 'granted');
      void syncProfile({ ump_consent_status: String(consent.status).toLowerCase(), att_status: att });
      if (!consent.canRequestAds) return false;
      await mobileAds().setRequestConfiguration({
        tagForChildDirectedTreatment: child,
        tagForUnderAgeOfConsent: child,
        maxAdContentRating: child ? MaxAdContentRating.G : MaxAdContentRating.PG,
      });
      await mobileAds().initialize();
      initialized = true;
      return true;
    } catch (err) {
      console.warn('[ads] init failed', err);
      return false;
    } finally {
      initializing = null;
    }
  })();
  return initializing;
}

/** Shows a rewarded ad. Resolves true only if the reward was earned. */
export async function showRewarded(): Promise<boolean> {
  if (!(await initAds())) return false;
  return new Promise((resolve) => {
    const ad = RewardedAd.createForAdRequest(rewardedId, { requestNonPersonalizedAdsOnly: nonPersonalized });
    let earned = false;
    const subs = [
      ad.addAdEventListener(RewardedAdEventType.LOADED, () => ad.show()),
      ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => (earned = true)),
      ad.addAdEventListener(AdEventType.CLOSED, () => finish(earned)),
      ad.addAdEventListener(AdEventType.ERROR, () => finish(false)),
    ];
    const finish = (ok: boolean) => {
      subs.forEach((off) => off());
      if (ok) useSettings.getState().set({ lastAdAt: Date.now() });
      resolve(ok);
    };
    ad.load();
  });
}

/**
 * Call after a puzzle is completed. Shows an interstitial at most once every three
 * completions and never within three minutes of the previous ad.
 */
export async function maybeShowInterstitial(): Promise<void> {
  const s = useSettings.getState();
  if (getIsPro()) return;
  if (s.completions - s.completionsAtLastAd < INTERSTITIAL_EVERY) return;
  if (Date.now() - s.lastAdAt < MIN_AD_GAP_MS) return;
  if (!(await initAds())) return;
  await new Promise<void>((resolve) => {
    const ad = InterstitialAd.createForAdRequest(interstitialId, { requestNonPersonalizedAdsOnly: nonPersonalized });
    const subs = [
      ad.addAdEventListener(AdEventType.LOADED, () => {
        useSettings.getState().set({ lastAdAt: Date.now(), completionsAtLastAd: useSettings.getState().completions });
        ad.show();
      }),
      ad.addAdEventListener(AdEventType.CLOSED, () => finish()),
      ad.addAdEventListener(AdEventType.ERROR, () => finish()),
    ];
    const finish = () => {
      subs.forEach((off) => off());
      resolve();
    };
    ad.load();
  });
}

/** Re-opens the Google consent choices (Settings > Manage consent). */
export async function openConsentOptions(): Promise<string> {
  try {
    const info = await AdsConsent.requestInfoUpdate();
    if (info.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED) {
      await AdsConsent.showPrivacyOptionsForm();
      return 'Your ad choices have been updated.';
    }
    return 'No consent choices are required in your region. Ads are not personalized unless you allow tracking.';
  } catch {
    return 'Consent options are not available right now.';
  }
}

export async function trackingStatus(): Promise<string> {
  if (Platform.OS !== 'ios') return 'Not applicable';
  const { status } = await getTrackingPermissionsAsync();
  return status === 'granted' ? 'Allowed' : status === 'denied' ? 'Opted out' : 'Not asked yet';
}

export const adsAvailable = true;
