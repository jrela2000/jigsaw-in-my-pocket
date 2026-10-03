import React from 'react';
import { Platform, type ColorValue } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts } from '../../theme';
import { useSettings } from '../../store/settings';

const icon = (name: React.ComponentProps<typeof MaterialCommunityIcons>['name']) =>
  ({ color }: { color: ColorValue }) => <MaterialCommunityIcons name={name} size={24} color={color as string} />;

export default function TabsLayout() {
  const onboarded = useSettings((s) => s.onboarded);
  if (!onboarded) return <Redirect href="/onboarding" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontFamily: fonts.sansMedium, fontSize: 11 },
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.hairline, ...(Platform.OS === 'web' ? { height: 62, paddingBottom: 8 } : null) },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Gallery', tabBarIcon: icon('view-grid-outline') }} />
      <Tabs.Screen name="new" options={{ title: 'New Puzzle', tabBarIcon: icon('image-plus') }} />
      <Tabs.Screen name="daily" options={{ title: 'Daily Art', tabBarIcon: icon('creation') }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders', tabBarIcon: icon('package-variant-closed') }} />
    </Tabs>
  );
}
