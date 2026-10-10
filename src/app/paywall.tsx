import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { PressableScale as Pressable } from '../components/motion';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Chip, Icon, IconButton, IconName, Logo, Row, Screen, T } from '../components/ui';
import { colors, fonts, radius, shadow } from '../theme';
import { getPlans, Plan, purchasePlan, restorePurchases } from '../services/purchases';
import { useIsPro } from '../store/entitlement';
import { isMinor, useSettings } from '../store/settings';
import { notify } from '../lib/dialog';

const PERKS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'cancel', title: 'Zero Ads', body: 'Never see an ad or wait for rewarded unlocks.' },
  { icon: 'grid', title: 'All Sizes Unlocked', body: 'Play 252, 500 and 1,000 piece puzzles any time.' },
  { icon: 'archive-outline', title: '15% Off All Physical Prints', body: 'A built-in discount on every printed puzzle you order.' },
  { icon: 'lightbulb-on-outline', title: 'Unlimited Hints & Sorting', body: 'Edge and colour trays plus as many hints as you like.' },
  { icon: 'image-multiple-outline', title: 'Collage Studio & Daily Archive', body: 'Every collage layout and 60 days of museum art in any size.' },
];

export default function Paywall() {
  const insets = useSafeAreaInsets();
  const isPro = useIsPro();
  const minor = useSettings((s) => isMinor(s.birthYear));
  const [plans, setPlans] = useState<Plan[]>([]);
  const [live, setLive] = useState(false);
  const [selected, setSelected] = useState<Plan['id']>('pro_yearly');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPlans().then((r) => { setPlans(r.plans); setLive(r.live); });
  }, []);
  useEffect(() => {
    if (isPro) router.back();
  }, [isPro]);

  const plan = plans.find((p) => p.id === selected);
  const buy = async () => {
    if (!plan) return;
    setBusy(true);
    const res = await purchasePlan(plan);
    setBusy(false);
    if (!res.ok && !res.cancelled) notify('Membership', res.message ?? 'The purchase could not be completed.');
  };
  const restore = async () => {
    setBusy(true);
    const res = await restorePurchases();
    setBusy(false);
    notify('Restore Purchases', res.message ?? '');
  };

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', paddingTop: insets.top + 10 }}>
        <Logo size={36} />
        <IconButton name="close" label="Close" onPress={() => router.back()} />
      </Row>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Chip label="PRO MEMBERSHIP" icon="star-outline" style={{ alignSelf: 'center' }} />
        <T v="display" center>Unlock Jigsaw In My Pocket Pro</T>
        <T v="bodyLg" center>Unhurried puzzle solving, and a discount on every print.</T>
      </View>

      {PERKS.map((p) => (
        <Row key={p.title} gap={14} style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, alignItems: 'flex-start' }, shadow.card]}>
          <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: colors.surfaceMid, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={p.icon} size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}><T v="titleLg">{p.title}</T><T v="body">{p.body}</T></View>
        </Row>
      ))}

      {plans.map((p) => {
        const on = p.id === selected;
        const yearly = p.id === 'pro_yearly';
        return (
          <Pressable key={p.id} onPress={() => setSelected(p.id)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${yearly ? 'Yearly' : 'Monthly'} plan, ${p.priceString}`}>
            <Row gap={14} style={[{ borderRadius: radius.md, padding: 16, backgroundColor: on ? colors.surface : colors.surfaceLow, borderWidth: 1.5, borderColor: on ? colors.primary : 'transparent' }, on ? shadow.card : null]}>
              <Icon name={on ? 'radiobox-marked' : 'radiobox-blank'} size={24} color={on ? colors.primary : colors.outlineVariant} />
              <View style={{ flex: 1 }}>
                <T v="titleLg">{yearly ? 'Yearly Plan' : 'Monthly Plan'}</T>
                <T v="body" color={yearly ? colors.primary : colors.textSecondary}>{yearly ? (p.perMonth ? `${p.perMonth} / month equivalent` : 'Billed once a year') : 'Billed monthly'}</T>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontFamily: fonts.sansSemi, fontSize: 20, color: colors.text }}>{p.priceString}</Text>
                <T v="small">/ {yearly ? 'year' : 'month'}</T>
              </View>
              {yearly ? <Chip label="BEST VALUE" tone="brass" style={{ position: 'absolute', top: -11, right: 14 }} /> : null}
            </Row>
          </Pressable>
        );
      })}

      <T v="body" center>Fair and transparent. No weekly plans. Cancel any time in your store account.</T>
      <Button size="lg" icon="lock-open-outline" loading={busy} disabled={!plan}
        label={plan?.trialDays ? `Start ${plan.trialDays}-Day Free Trial` : 'Continue'} onPress={buy} />
      <Button label="Restore Purchases" kind="ghost" onPress={restore} />
      {!live ? <T v="small" center>Prices shown are indicative. Purchasing is enabled once the store products are connected.</T> : null}
      {minor ? <T v="small" center>If you are under 18, ask a parent or guardian before purchasing.</T> : null}
      <T v="small" center>
        {plan?.trialDays ? 'After the free trial, the ' : 'The '}subscription renews automatically at the price shown until cancelled at least 24 hours before the end of the current period. Manage or cancel in your App Store or Google Play account settings.
      </T>
      <Row style={{ justifyContent: 'center', gap: 16 }}>
        <Pressable onPress={() => router.push('/legal/terms')}><T v="label" style={{ textDecorationLine: 'underline' }}>Terms of Service</T></Pressable>
        <T v="small">•</T>
        <Pressable onPress={() => router.push('/legal/privacy')}><T v="label" style={{ textDecorationLine: 'underline' }}>Privacy Policy</T></Pressable>
      </Row>
    </Screen>
  );
}
