import { useEffect } from 'react';
import { Easing, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

// Shared motion tokens (from the UX Reference Library moodboard). Every animation uses these.
export const DURATION = { fast: 150, base: 250, slow: 450, count: 800, seams: 1200 } as const;
export const EASE = {
  /** Things entering: fast start, long settle. */
  decelerate: Easing.bezier(0.05, 0.7, 0.1, 1),
  /** Things moving within the screen. */
  standard: Easing.bezier(0.2, 0, 0, 1),
};

/** Gap between stages of a staggered screen entry. */
export const STAGGER_MS = 140;
/** Past this many items, everything else appears together so long lists never feel slow. */
export const MAX_STAGGERED = 6;

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/** Delay before the item at `index` starts its entrance. */
export const revealDelay = (index: number, base = 0) => base + Math.min(Math.max(index, 0), MAX_STAGGERED) * STAGGER_MS;

/** Pick a variant index that differs from the last one played (last < 0 means none yet). */
export function pickVariant(count: number, last: number, rand: () => number = Math.random): number {
  if (count <= 1) return 0;
  if (last < 0 || last >= count) return Math.min(count - 1, Math.floor(rand() * count));
  const n = Math.min(count - 2, Math.floor(rand() * (count - 1)));
  return n >= last ? n + 1 : n;
}

/** 0 -> 1 progress after an optional delay; jumps straight to 1 when reduced motion is on. */
export function useProgress(duration: number = DURATION.slow, delay = 0) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    p.value = reduce ? 1 : withDelay(delay, withTiming(1, { duration, easing: EASE.decelerate }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);
  return p;
}

export { useReducedMotion };
