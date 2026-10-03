import { Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { showRewarded } from '../services/ads';

/**
 * Offers the free-tier choice: watch a rewarded ad, or see Pro.
 * Resolves true only when the reward was earned.
 */
export function offerRewarded(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web') return showRewarded();
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Go Pro', onPress: () => { router.push('/paywall'); resolve(false); } },
      {
        text: 'Watch ad',
        onPress: async () => {
          const earned = await showRewarded();
          if (!earned) Alert.alert('No ad available', 'We could not load an ad right now. Please try again in a moment.');
          resolve(earned);
        },
      },
    ]);
  });
}
