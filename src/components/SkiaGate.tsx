import React, { ComponentType, Suspense, useMemo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '../theme';

export const SkiaFallback = () => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
    <ActivityIndicator color={colors.primary} />
  </View>
);

/** Lazily loads a component that uses Skia. On web this also loads CanvasKit first (see SkiaGate.web.tsx). */
export function SkiaGate<P extends object>({ load, props }: { load: () => Promise<{ default: ComponentType<P> }>; props: P }) {
  const Lazy = useMemo(() => React.lazy(load), [load]);
  return (
    <Suspense fallback={<SkiaFallback />}>
      <Lazy {...props} />
    </Suspense>
  );
}
