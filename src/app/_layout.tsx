import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Newsreader_400Regular, Newsreader_500Medium, Newsreader_400Regular_Italic } from '@expo-google-fonts/newsreader';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { colors } from '../theme';
import { PaymentsProvider } from '../services/payments';
import { ensureSession } from '../services/supabase';
import { initPurchases } from '../services/purchases';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Newsreader_400Regular, Newsreader_500Medium, Newsreader_400Regular_Italic, Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
  });

  useEffect(() => {
    // Silent anonymous identity, then RevenueCat keyed to the same id. Ads are initialised lazily, only when first needed.
    ensureSession().then((id) => initPurchases(id));
  }, []);

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <PaymentsProvider>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
            <Stack.Screen name="puzzle/[id]" options={{ gestureEnabled: false }} />
            <Stack.Screen name="completed/[id]" options={{ animation: 'fade', animationDuration: 450 }} />
          </Stack>
        </PaymentsProvider>
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
