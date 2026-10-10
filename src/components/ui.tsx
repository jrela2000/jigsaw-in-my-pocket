import React from 'react';
import {
  ActivityIndicator, PressableProps, ScrollView, StyleProp, StyleSheet, Switch, Text, TextInput, TextInputProps,
  TextProps, TextStyle, View, ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors, fonts, radius, shadow, space, type } from '../theme';
import { useIsPro } from '../store/entitlement';
import { haptic } from '../lib/haptics';
import { PressableScale, Reveal } from './motion';

export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
export const Icon = ({ name, size = 20, color = colors.text }: { name: IconName; size?: number; color?: string }) => (
  <MaterialCommunityIcons name={name} size={size} color={color} />
);

type Variant = keyof typeof type;
export function T({ v = 'body', color, center, style, ...rest }: TextProps & { v?: Variant; color?: string; center?: boolean }) {
  return <Text {...rest} style={[type[v], color ? { color } : null, center ? { textAlign: 'center' } : null, style]} />;
}

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Rect width={120} height={120} rx={28} fill="#3E6B5C" />
      <Path
        d="M 38 32 C 45 32 45 22 56 22 C 67 22 67 32 74 32 L 88 32 L 88 46 C 88 53 98 53 98 64 C 98 75 88 75 88 82 L 88 88 L 74 88 C 67 88 67 98 56 98 C 45 98 45 88 38 88 L 32 88 L 32 74 C 32 67 22 67 22 56 C 22 45 32 45 32 38 Z"
        fill="rgba(255,255,255,0.08)" stroke="#fff" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round"
      />
      <Circle cx={56} cy={60} r={14} stroke="#fff" strokeWidth={3.5} fill="none" />
      <Circle cx={56} cy={60} r={5} fill="#fff" />
      <Circle cx={82} cy={38} r={3.5} fill="#E2E8E5" />
    </Svg>
  );
}

type ButtonProps = Omit<PressableProps, 'style'> & {
  label: string;
  icon?: IconName;
  iconRight?: IconName;
  kind?: 'primary' | 'secondary' | 'tonal' | 'linen' | 'ghost' | 'dark';
  size?: 'lg' | 'md' | 'sm';
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};
const KIND: Record<NonNullable<ButtonProps['kind']>, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, fg: colors.onPrimary },
  secondary: { bg: colors.surface, fg: colors.text, border: colors.hairline },
  tonal: { bg: colors.surfaceMid, fg: colors.text },
  linen: { bg: colors.linen, fg: colors.onLinen },
  ghost: { bg: 'transparent', fg: colors.primary },
  dark: { bg: '#000', fg: '#fff' },
};
export function Button({ label, icon, iconRight, kind = 'primary', size = 'md', loading, disabled, style, ...rest }: ButtonProps) {
  const k = KIND[kind];
  const h = size === 'lg' ? 54 : size === 'md' ? 44 : 34;
  const fs = size === 'lg' ? 17 : size === 'md' ? 15 : 13;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={h < 44 ? Math.ceil((44 - h) / 2) : 0}
      disabled={disabled || loading}
      {...rest}
      onPressIn={(e) => { haptic.light(); rest.onPressIn?.(e); }}
      style={[
        styles.button,
        { backgroundColor: k.bg, height: h, paddingHorizontal: size === 'sm' ? 12 : 18, opacity: disabled ? 0.45 : 1 },
        k.border ? { borderWidth: 1, borderColor: k.border } : null,
        kind === 'primary' && size === 'lg' ? shadow.card : null,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={k.fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={fs + 3} color={k.fg} /> : null}
          <Text style={{ fontFamily: fonts.sansSemi, fontSize: fs, color: k.fg }} numberOfLines={1}>{label}</Text>
          {iconRight ? <Icon name={iconRight} size={fs + 3} color={k.fg} /> : null}
        </>
      )}
    </PressableScale>
  );
}

export function IconButton({ name, onPress, label, bg = colors.surfaceMid, color = colors.text, size = 40 }: {
  name: IconName; onPress?: () => void; label: string; bg?: string; color?: string; size?: number;
}) {
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={Math.max(6, Math.ceil((44 - size) / 2))} pressedScale={0.92}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} size={size * 0.5} color={color} />
    </PressableScale>
  );
}

export const Card = ({ style, children, tone = 'surface' }: { style?: StyleProp<ViewStyle>; children: React.ReactNode; tone?: 'surface' | 'low' | 'mid' }) => (
  <View style={[styles.card, tone === 'surface' ? shadow.card : null, { backgroundColor: tone === 'surface' ? colors.surface : tone === 'low' ? colors.surfaceLow : colors.surfaceMid }, style]}>
    {children}
  </View>
);

export function Chip({ label, tone = 'neutral', icon, style }: { label: string; tone?: 'neutral' | 'sage' | 'brass' | 'linen' | 'warn' | 'dark' | 'white'; icon?: IconName; style?: StyleProp<ViewStyle> }) {
  const t = {
    neutral: [colors.surfaceMid, colors.textSecondary], sage: [colors.sageTint, colors.primary], brass: [colors.brassTint, colors.brassDeep],
    linen: [colors.linen, colors.onLinen], warn: [colors.warningTint, colors.warning], dark: ['rgba(20,27,43,0.72)', '#fff'], white: ['rgba(255,255,255,0.94)', colors.text],
  }[tone];
  return (
    <View style={[styles.chip, { backgroundColor: t[0] }, style]}>
      {icon ? <Icon name={icon} size={13} color={t[1]} /> : null}
      <Text style={{ fontFamily: fonts.sansSemi, fontSize: 11, letterSpacing: 0.3, color: t[1] }}>{label}</Text>
    </View>
  );
}

export const Toggle = ({ value, onValueChange, label }: { value: boolean; onValueChange: (v: boolean) => void; label: string }) => (
  <Switch accessibilityLabel={label} value={value} onValueChange={(v) => { haptic.select(); onValueChange(v); }} trackColor={{ false: colors.surfaceDim, true: colors.primary }} thumbColor="#fff"
    {...({ activeThumbColor: '#fff' } as object)} />
);

export function Field({ label, hint, style, ...rest }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={[{ gap: 6 }, style as StyleProp<ViewStyle>]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T v="small" color={colors.textSecondary} style={{ fontFamily: fonts.sansMedium }}>{label}</T>
        {hint ? <T v="small">{hint}</T> : null}
      </View>
      <TextInput accessibilityLabel={label} placeholderTextColor={colors.textMuted} {...rest}
        style={[styles.input, rest.multiline ? { height: 84, textAlignVertical: 'top', paddingTop: 12 } : null]} />
    </View>
  );
}

/** Top app bar: logo + title on tab screens, back arrow on pushed screens. */
export function AppBar({ title = 'Jigsaw In My Pocket', back, right }: { title?: string; back?: boolean; right?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const isPro = useIsPro();
  return (
    <View style={[styles.appBar, { paddingTop: insets.top + 8 }]}>
      {back ? <IconButton name="arrow-left" label="Back" bg="transparent" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} /> : null}
      <Logo size={32} />
      <Text style={[type.headlineSm, { flex: 1 }]} numberOfLines={1}>{title}</Text>
      {isPro && !back ? <Chip label="PRO" tone="sage" /> : null}
      {right ?? <IconButton name="cog-outline" label="Settings" onPress={() => router.push('/settings')} />}
    </View>
  );
}

export function Screen({ children, bar, footer, scroll = true, pad = true, stagger = true }: {
  children: React.ReactNode; bar?: React.ReactNode; footer?: React.ReactNode; scroll?: boolean; pad?: boolean; stagger?: boolean;
}) {
  const insets = useSafeAreaInsets();
  // Each top-level block fades in 140ms after the one before it (first six only; the rest arrive with the last).
  const staged = !stagger ? children : React.Children.toArray(children).map((c, i) => <Reveal key={(c as React.ReactElement).key ?? i} index={i}>{c}</Reveal>);
  const body = { paddingHorizontal: pad ? space.margin : 0, paddingBottom: 28, gap: space.md, width: '100%' as const, maxWidth: 560, alignSelf: 'center' as const };
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {bar}
      {scroll ? (
        <ScrollView contentContainerStyle={body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{staged}</ScrollView>
      ) : (
        <View style={[body, { flex: 1 }]}>{staged}</View>
      )}
      {footer ? <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>{footer}</View> : null}
    </View>
  );
}

export const Row = ({ children, style, gap = 8 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>
);

export const SectionTitle = ({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) => (
  <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 8 }}>
    <View style={{ flex: 1 }}>
      <T v="headlineSm">{title}</T>
      {sub ? <T v="small" color={colors.textSecondary}>{sub}</T> : null}
    </View>
    {right}
  </Row>
);

export const Notice = ({ icon, title, body, tone = 'low', style }: { icon: IconName; title?: string; body: string; tone?: 'low' | 'warn'; style?: StyleProp<ViewStyle> }) => (
  <View style={[styles.notice, { backgroundColor: tone === 'warn' ? colors.warningTint : colors.surfaceLow }, style]}>
    <Icon name={icon} size={20} color={tone === 'warn' ? colors.warning : colors.primary} />
    <View style={{ flex: 1, gap: 2 }}>
      {title ? <T v="title" style={{ fontSize: 14 }}>{title}</T> : null}
      <T v="small" color={colors.textSecondary} style={{ lineHeight: 18 } as TextStyle}>{body}</T>
    </View>
  </View>
);

export const Progress = ({ value, height = 5 }: { value: number; height?: number }) => (
  <View style={{ height, borderRadius: height, backgroundColor: colors.surfaceHigh, overflow: 'hidden', flex: 1 }}>
    <View style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`, height, borderRadius: height, backgroundColor: colors.sage }} />
  </View>
);

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.base },
  card: { borderRadius: radius.lg, padding: space.md },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.full, alignSelf: 'flex-start' },
  input: { backgroundColor: colors.surfaceMid, borderRadius: radius.base, paddingHorizontal: 14, height: 46, fontFamily: fonts.sans, fontSize: 15, color: colors.text },
  appBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: space.margin, paddingBottom: 12, backgroundColor: colors.bg },
  footer: { paddingHorizontal: space.margin, paddingTop: 12, backgroundColor: colors.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline, gap: 8 },
  notice: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: radius.md, alignItems: 'flex-start' },
});
