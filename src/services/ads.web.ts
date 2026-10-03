// The web preview has no ad SDK. Rewarded unlocks resolve immediately so flows stay testable.
export async function initAds(): Promise<boolean> {
  return false;
}
export async function showRewarded(): Promise<boolean> {
  return true;
}
export async function maybeShowInterstitial(): Promise<void> {}
export async function openConsentOptions(): Promise<string> {
  return 'Consent options are available in the iOS and Android apps.';
}
export async function trackingStatus(): Promise<string> {
  return 'Not applicable';
}
export const adsAvailable = false;
