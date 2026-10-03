import { Platform, TextStyle, ViewStyle } from 'react-native';

// "Gallery Slate & Sage" design tokens (see ../stitch_mobile_app_style_exploration/gallery_slate_sage/DESIGN.md)
export const colors = {
  bg: '#f9f9ff',
  surface: '#ffffff',
  surfaceLow: '#f1f3ff',
  surfaceMid: '#e9edff',
  surfaceHigh: '#e1e8fd',
  surfaceDim: '#d3daef',
  outline: '#717975',
  hairline: '#e2e5e9',
  outlineVariant: '#c0c8c3',
  text: '#141b2b',
  textSecondary: '#404945',
  textMuted: '#707973',
  primary: '#255345',
  sage: '#3e6b5c',
  sageTint: '#d4ece2',
  onPrimary: '#ffffff',
  linen: '#edddc9',
  onLinen: '#6c6151',
  brass: '#c49b5c',
  brassDeep: '#8c6729',
  brassTint: '#ffdead',
  warning: '#b45309',
  warningTint: '#fef3c7',
  error: '#ba1a1a',
  errorTint: '#ffdad6',
  ink: '#111827',
};

export const fonts = {
  serif: 'Newsreader_400Regular',
  serifMedium: 'Newsreader_500Medium',
  serifItalic: 'Newsreader_400Regular_Italic',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemi: 'Inter_600SemiBold',
};

export const radius = { sm: 4, base: 8, md: 12, lg: 16, xl: 24, full: 999 };
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 36, margin: 20 };

export const type: Record<string, TextStyle> = {
  display: { fontFamily: fonts.serif, fontSize: 32, lineHeight: 40, letterSpacing: -0.5, color: colors.text },
  headline: { fontFamily: fonts.serif, fontSize: 26, lineHeight: 34, letterSpacing: -0.3, color: colors.text },
  headlineSm: { fontFamily: fonts.serifMedium, fontSize: 21, lineHeight: 28, color: colors.text },
  titleLg: { fontFamily: fonts.sansSemi, fontSize: 18, lineHeight: 24, color: colors.text },
  title: { fontFamily: fonts.sansSemi, fontSize: 16, lineHeight: 22, color: colors.text },
  bodyLg: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 24, color: colors.textSecondary },
  body: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  small: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 16, color: colors.textMuted },
  label: { fontFamily: fonts.sansMedium, fontSize: 13, lineHeight: 16, letterSpacing: 0.2, color: colors.text },
  overline: { fontFamily: fonts.sansSemi, fontSize: 11, lineHeight: 14, letterSpacing: 1.1, color: colors.onLinen, textTransform: 'uppercase' },
};

export const shadow: Record<'card' | 'float', ViewStyle> = {
  card: Platform.select({
    web: { boxShadow: '0 2px 8px -2px rgba(17,24,39,0.06), 0 1px 3px rgba(17,24,39,0.03)' } as ViewStyle,
    default: { shadowColor: '#111827', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  })!,
  float: Platform.select({
    web: { boxShadow: '0 8px 24px -4px rgba(17,24,39,0.10), 0 2px 6px -1px rgba(17,24,39,0.04)' } as ViewStyle,
    default: { shadowColor: '#111827', shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  })!,
};

export const BOARD_TEXTURES = [
  { id: 'paper', name: 'Paper', color: '#f6f5f1', dark: false },
  { id: 'linen', name: 'Linen', color: '#ebe4d6', dark: false },
  { id: 'slate', name: 'Slate', color: '#2b303b', dark: true },
  { id: 'oak', name: 'Oak', color: '#c4a47c', dark: false },
  { id: 'felt', name: 'Felt', color: '#2f5241', dark: true },
] as const;
export type TextureId = (typeof BOARD_TEXTURES)[number]['id'];
