import React from 'react';
import { ImageStyle, StyleProp } from 'react-native';
import { Image } from 'expo-image';

export type PictureProps = { uri: string; style?: StyleProp<ImageStyle>; label?: string; blur?: number; fade?: boolean };

/** Cover-fit image with disk caching (expo-image). */
export function Picture({ uri, style, label, blur, fade }: PictureProps) {
  return <Image source={{ uri }} style={style} contentFit="cover" blurRadius={blur} transition={fade ? 200 : 0} accessibilityLabel={label} accessible={!!label} />;
}
