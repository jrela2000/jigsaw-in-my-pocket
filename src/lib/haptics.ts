import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSettings } from '../store/settings';

// Studio haptic map: one haptic per kind of moment, used consistently. Off when the user turns haptics off; no-op on web.
const on = () => Platform.OS !== 'web' && useSettings.getState().haptics;
const run = (fn: () => Promise<void>) => {
  if (on()) fn().catch(() => {});
};

export const haptic = {
  /** Toggle, tab, picker detent. */
  select: () => run(() => Haptics.selectionAsync()),
  /** Button press, piece placed. */
  light: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Drag pickup. */
  medium: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Puzzle complete. */
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Validation problem. */
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
