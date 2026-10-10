import React, { useMemo, useRef, useState } from 'react';
import { FlatList, NativeScrollEvent, NativeSyntheticEvent, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Chip, Icon, IconButton, Notice, Row, Screen, T } from '../components/ui';
import { colors, fonts, radius } from '../theme';
import { LEGAL_NOTICE } from '../config/env';
import { useSettings } from '../store/settings';
import { haptic } from '../lib/haptics';

const ROW = 56;
const VISIBLE = 5;

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const thisYear = new Date().getFullYear();
  const years = useMemo(() => Array.from({ length: 101 }, (_, i) => thisYear - 100 + i), [thisYear]);
  // The reel opens on a neutral adult year; nothing about the UI hints at a "right" answer.
  const [index, setIndex] = useState(years.indexOf(1995));
  const list = useRef<FlatList<number>>(null);

  const scrollTo = (i: number) => {
    const next = Math.max(0, Math.min(years.length - 1, i));
    setIndex(next);
    list.current?.scrollToOffset({ offset: next * ROW, animated: true });
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.y / ROW);
    if (i !== index && i >= 0 && i < years.length) {
      setIndex(i);
      haptic.select();
    }
  };

  const submit = () => {
    const birthYear = years[index];
    useSettings.getState().set({ birthYear, onboarded: true });
    router.replace('/');
  };

  return (
    <Screen footer={
      <>
        <Button label="Continue" iconRight="arrow-right" size="lg" onPress={submit} />
        <Row style={{ justifyContent: 'center', gap: 16, paddingTop: 4 }}>
          <Pressable onPress={() => router.push('/legal/terms')}><T v="label" style={{ textDecorationLine: 'underline' }}>Terms of Service</T></Pressable>
          <T v="small">•</T>
          <Pressable onPress={() => router.push('/legal/privacy')}><T v="label" style={{ textDecorationLine: 'underline' }}>Privacy Policy</T></Pressable>
        </Row>
      </>
    }>
      <View style={{ alignItems: 'center', paddingTop: insets.top + 20, gap: 6 }}>
        <View style={{ width: 60, height: 60, borderRadius: 14, backgroundColor: colors.surfaceMid, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="puzzle-outline" size={30} color={colors.primary} />
        </View>
        <T v="overline" style={{ marginTop: 8 }}>Jigsaw In My Pocket</T>
        <T v="display" center>Select Your Birth Year</T>
        <T v="bodyLg" center>This sets the right ad and purchase settings for you. It stays on this phone.</T>
      </View>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row><Icon name="calendar-blank-outline" size={18} color={colors.onLinen} /><T v="label" color={colors.onLinen}>Year of Birth</T></Row>
          <Chip label="Private" />
        </Row>
        <View style={{ height: ROW * VISIBLE, marginTop: 8 }}>
          <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, top: ROW * 2, height: ROW, borderRadius: radius.base, backgroundColor: colors.surfaceLow }} />
          <FlatList
            ref={list}
            data={years}
            keyExtractor={(y) => String(y)}
            getItemLayout={(_, i) => ({ length: ROW, offset: ROW * i, index: i })}
            initialScrollIndex={index}
            snapToInterval={ROW}
            decelerationRate="fast"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: ROW * 2 }}
            onScroll={onScroll}
            scrollEventThrottle={16}
            accessibilityLabel="Birth year"
            renderItem={({ item, index: i }) => {
              const d = Math.abs(i - index);
              return (
                <Pressable onPress={() => scrollTo(i)} style={{ height: ROW, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: d === 0 ? fonts.serifMedium : fonts.serif, fontSize: d === 0 ? 38 : 32, color: d === 0 ? colors.primary : colors.textMuted, opacity: d === 0 ? 1 : d === 1 ? 0.7 : 0.25 }}>
                    {item}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>
        <Row style={{ justifyContent: 'center', gap: 20, marginTop: 8 }}>
          <IconButton name="chevron-up" label="Earlier year" onPress={() => scrollTo(index - 1)} />
          <T v="overline">Swipe or tap to adjust</T>
          <IconButton name="chevron-down" label="Later year" onPress={() => scrollTo(index + 1)} />
        </Row>
      </Card>

      <Notice icon="lock-outline" title="Stored on this device"
        body="Your birth year never leaves this phone. It only decides which ad and purchase settings apply." />

      <View style={{ backgroundColor: colors.surfaceLow, borderRadius: radius.md, padding: 16 }}>
        <T v="body" center style={{ fontFamily: fonts.serifItalic, fontSize: 15, lineHeight: 22 }}>“{LEGAL_NOTICE}”</T>
      </View>
    </Screen>
  );
}
