import React, { ComponentType } from 'react';
import { View } from 'react-native';
import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { colors } from '../theme';
import { BrandedLoader } from './feedback';

export const SkiaFallback = () => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
    <BrandedLoader />
  </View>
);

export function SkiaGate<P extends object>({ load, props }: { load: () => Promise<{ default: ComponentType<P> }>; props: P }) {
  const Any = WithSkiaWeb as unknown as ComponentType<any>;
  return <Any getComponent={load} componentProps={props} fallback={<SkiaFallback />} opts={{ locateFile: (file: string) => `${process.env.EXPO_BASE_URL ?? ''}/${file}` }} />;
}
