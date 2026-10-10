import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { DURATION, EASE, revealDelay, useProgress } from '../lib/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle> | ((s: { pressed: boolean }) => StyleProp<ViewStyle>);
  /** Scale while pressed. */
  pressedScale?: number;
};

/** Drop-in Pressable: shrinks slightly on touch-down (well inside 100ms) and springs back. */
export function PressableScale({ style, pressedScale = 0.97, onPressIn, onPressOut, ...rest }: Props) {
  const reduce = useReducedMotion();
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const resolved = typeof style === 'function' ? style({ pressed: false }) : style;
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        if (!reduce) s.value = withTiming(pressedScale, { duration: 80, easing: EASE.standard });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!reduce) s.value = withTiming(1, { duration: DURATION.base, easing: EASE.decelerate });
        onPressOut?.(e);
      }}
      style={[resolved, anim]}
    />
  );
}

/** Fade + short upward drift. `index` staggers siblings 140ms apart (capped). */
export function Reveal({ index = 0, base = 0, children, style }: { index?: number; base?: number; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const p = useProgress(DURATION.slow, revealDelay(index, base));
  const anim = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: interpolate(p.value, [0, 1], [14, 0]) }] }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

/** Board build-in: scales 0.96 -> 1 while fading up over 450ms, starting when it mounts. */
export function BuildIn({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const p = useProgress(DURATION.slow);
  const anim = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ scale: interpolate(p.value, [0, 1], [0.96, 1]) }] }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}
