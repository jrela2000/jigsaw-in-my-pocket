import React from 'react';
import { View } from 'react-native';

/** Bottom-weighted dark scrim so white text stays legible over artwork. */
export function LinearGradientFallback() {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '70%' }}>
      {[0.04, 0.1, 0.18, 0.28, 0.4, 0.52, 0.62].map((o, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: `rgba(15,20,30,${o})` }} />
      ))}
    </View>
  );
}
