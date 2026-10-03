import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

export type PictureProps = { uri: string; style?: StyleProp<ImageStyle>; label?: string; blur?: number; fade?: boolean };

export function Picture({ uri, style, label, blur }: PictureProps) {
  return <Image source={{ uri }} style={style} resizeMode="cover" blurRadius={blur} accessibilityLabel={label} />;
}
