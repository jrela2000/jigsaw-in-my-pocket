import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { colors } from '../theme';
import { Button, Card, Icon, IconName, Logo, T } from './ui';
import { EASE } from '../lib/motion';

/** Branded loading: the logo breathes above a sweeping bar. Replaces bare spinners. */
export function BrandedLoader({ label }: { label?: string }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    t.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(t);
  }, [reduce, t]);
  const logo = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(t.value, [0, 1], [0.94, 1.04]) }] }));
  const bar = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(t.value, [0, 1], [-40, 80]) }] }));
  return (
    <View style={{ alignItems: 'center', gap: 16 }} accessibilityRole="progressbar" accessibilityLabel={label ?? 'Loading'}>
      <Animated.View style={logo}><Logo size={56} /></Animated.View>
      <View style={{ width: 120, height: 4, borderRadius: 2, backgroundColor: colors.surfaceHigh, overflow: 'hidden' }}>
        <Animated.View style={[{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.sage }, bar]} />
      </View>
      {label ? <T v="body" color={colors.textSecondary}>{label}</T> : null}
    </View>
  );
}

/** Empty state: a gently floating icon, one sentence of context, one clear next action. */
export function EmptyState({ icon, title, body, cta, onCta }: { icon: IconName; title: string; body: string; cta: string; onCta: () => void }) {
  const reduce = useReducedMotion();
  const f = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    f.value = withRepeat(withSequence(withTiming(1, { duration: 1800, easing: EASE.standard }), withTiming(0, { duration: 1800, easing: EASE.standard })), -1);
    return () => cancelAnimation(f);
  }, [reduce, f]);
  const float = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(f.value, [0, 1], [0, -6]) }] }));
  return (
    <Card tone="low" style={{ alignItems: 'center', gap: 10, paddingVertical: 28 }}>
      <Animated.View style={[{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.sageTint, alignItems: 'center', justifyContent: 'center' }, float]}>
        <Icon name={icon} size={30} color={colors.primary} />
      </Animated.View>
      <T v="title" center>{title}</T>
      <T v="body" center color={colors.textSecondary}>{body}</T>
      <Button label={cta} onPress={onCta} />
    </Card>
  );
}

