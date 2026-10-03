import React, { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { AppBar, Button, Card, Chip, Field, Icon, IconName, Notice, Row, Screen, T, Toggle } from '../components/ui';
import { colors, radius } from '../theme';
import { useSettings, ageOf } from '../store/settings';
import { useEntitlement, useIsPro } from '../store/entitlement';
import { restorePurchases } from '../services/purchases';
import { openConsentOptions, trackingStatus } from '../services/ads';
import { setDailyReminder } from '../services/notifications';
import { currentUserId, ensureSession, linkEmail, supabase } from '../services/supabase';
import { cacheSizeBytes, clearCache } from '../lib/files';
import { confirm, notify } from '../lib/dialog';
import { configured, LEGAL_NOTICE } from '../config/env';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={{ gap: 8 }}>
    <T v="overline">{title}</T>
    {children}
  </View>
);

const LinkRow = ({ icon, title, sub, onPress }: { icon: IconName; title: string; sub?: string; onPress: () => void }) => (
  <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
    <Row gap={12} style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, borderWidth: 1, borderColor: colors.hairline }}>
      <Icon name={icon} size={20} color={colors.textSecondary} />
      <View style={{ flex: 1 }}><T v="title" style={{ fontSize: 15 }}>{title}</T>{sub ? <T v="small">{sub}</T> : null}</View>
      <Icon name="chevron-right" size={20} color={colors.textMuted} />
    </Row>
  </Pressable>
);

export default function Settings() {
  const s = useSettings();
  const isPro = useIsPro();
  const ent = useEntitlement();
  const [userId, setUserId] = useState(currentUserId());
  const [email, setEmail] = useState('');
  const [att, setAtt] = useState('…');
  const [cache, setCache] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    ensureSession().then(setUserId);
    trackingStatus().then(setAtt);
    cacheSizeBytes().then(setCache);
  }, []);

  const age = ageOf(s.birthYear);
  const ageBand = age == null ? '' : age < 13 ? 'under 13' : age < 18 ? '13–17' : '18+';

  const link = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return notify('Enter a valid email address');
    setBusy(true);
    const res = await linkEmail(email.trim());
    setBusy(false);
    if (res.ok) s.set({ linkedEmail: email.trim() });
    notify(res.ok ? 'Almost there' : 'Could not link email', res.message);
  };

  const toggleReminders = async (on: boolean) => {
    const ok = await setDailyReminder(on);
    if (on && !ok) return notify('Notifications are off', 'Allow notifications for Studio Jigsaw in your device settings to get the daily reminder.');
    s.set({ reminders: on });
  };

  const erase = async () => {
    if (!(await confirm('Erase my cloud data?', 'This permanently deletes your anonymous profile, gift links, order history and uploaded photos from our servers. Puzzles on this device are kept. Active subscriptions must be cancelled in your store account.', 'Erase'))) return;
    try {
      if (!supabase) throw new Error('offline');
      const { error } = await supabase.functions.invoke('delete-account', { body: {} });
      if (error) throw error;
      await supabase.auth.signOut();
      s.set({ linkedEmail: null });
      notify('Your cloud data has been erased');
    } catch {
      notify('Could not erase data right now', 'Please try again later.');
    }
  };

  return (
    <Screen bar={<AppBar title="Settings" back right={<></>} />}>
      <Section title="Membership">
        <View style={{ backgroundColor: colors.primary, borderRadius: radius.lg, padding: 18, gap: 10 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="overline" color="rgba(255,255,255,0.75)">{isPro ? 'Collector tier' : 'Free tier'}</T>
            <Chip label={isPro ? 'Active' : 'Ad-supported'} tone="linen" />
          </Row>
          <T v="headline" color="#fff">{isPro ? 'Studio Jigsaw Pro' : 'Studio Jigsaw'}</T>
          <T v="body" color="rgba(255,255,255,0.88)">
            {isPro ? 'Ad-free solving, every puzzle size, unlimited hints and collage layouts, plus 15% off printed puzzles.' : 'Free puzzles up to 110 pieces. Go Pro for no ads, every size and 15% off prints.'}
          </T>
          {isPro && ent.expiresAt ? <T v="small" color="rgba(255,255,255,0.75)">Renews {new Date(ent.expiresAt).toLocaleDateString()}</T> : null}
          <Row gap={10}>
            {isPro ? (
              <Button label="Manage" icon="credit-card-outline" kind="secondary" style={{ flex: 1 }}
                onPress={() => Linking.openURL(ent.managementUrl ?? (Platform.OS === 'ios' ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions'))} />
            ) : (
              <Button label="See Pro" icon="star-outline" kind="secondary" style={{ flex: 1 }} onPress={() => router.push('/paywall')} />
            )}
            <Button label="Restore" icon="history" kind="tonal" style={{ flex: 1 }} onPress={async () => notify('Restore Purchases', (await restorePurchases()).message)} />
          </Row>
        </View>
      </Section>

      <Section title="Cloud identity">
        <Card tone="low" style={{ gap: 12 }}>
          <Row gap={12} style={{ backgroundColor: colors.surface, borderRadius: radius.base, padding: 12 }}>
            <Icon name="fingerprint" size={22} color={colors.textSecondary} />
            <View style={{ flex: 1 }}>
              <T v="overline">Anonymous ID</T>
              <T v="body" numberOfLines={1}>{userId ? `${userId.slice(0, 8)}…${userId.slice(-4)}` : configured.supabase ? 'Not connected' : 'On this device only'}</T>
            </View>
            <Chip label={s.linkedEmail ? 'Email linked' : 'Anonymous'} tone={s.linkedEmail ? 'sage' : 'linen'} />
          </Row>
          <View><T v="title">Save purchases across devices</T><T v="small" color={colors.textSecondary}>Optional. Link an email to keep your orders, streak and membership if you change phones.</T></View>
          {s.linkedEmail ? <T v="body">{s.linkedEmail}</T> : (
            <Row gap={8} style={{ alignItems: 'flex-end' }}>
              <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" style={{ flex: 1 }} />
              <Button label="Link" iconRight="arrow-right" onPress={link} loading={busy} disabled={!userId} style={{ height: 46 }} />
            </Row>
          )}
        </Card>
      </Section>

      <Section title="Privacy & consent">
        <Card tone="low" style={{ gap: 8 }}>
          <Row gap={12} style={{ backgroundColor: colors.surface, borderRadius: radius.base, padding: 12 }}>
            <View style={{ flex: 1 }}><T v="title" style={{ fontSize: 15 }}>Ad choices</T><T v="small">{isPro ? 'No ads are shown on Pro' : 'Review your Google ad consent'}</T></View>
            <Button label="Review" icon="tune-variant" kind="tonal" size="sm" disabled={isPro} onPress={async () => notify('Ad choices', await openConsentOptions())} />
          </Row>
          {Platform.OS === 'ios' ? (
            <Row gap={12} style={{ backgroundColor: colors.surface, borderRadius: radius.base, padding: 12 }}>
              <View style={{ flex: 1 }}><T v="title" style={{ fontSize: 15 }}>App tracking</T><T v="small">Change in iOS Settings › Privacy › Tracking</T></View>
              <Pressable onPress={() => Linking.openSettings()}><Chip label={att} /></Pressable>
            </Row>
          ) : null}
          <Row gap={12} style={{ backgroundColor: colors.surface, borderRadius: radius.base, padding: 12 }}>
            <View style={{ flex: 1 }}><T v="title" style={{ fontSize: 15 }}>Birth year</T><T v="small">Sets the ad and purchase rules for this profile</T></View>
            <Chip label={s.birthYear ? `${s.birthYear} (${ageBand})` : 'Not set'} tone="sage" />
          </Row>
        </Card>
      </Section>

      <Section title="Sensory & storage">
        <Card tone="low" style={{ gap: 14 }}>
          <Row gap={12}>
            <Icon name="bell-outline" size={20} color={colors.textSecondary} />
            <View style={{ flex: 1 }}><T v="title" style={{ fontSize: 15 }}>Daily art reminder</T><T v="small">One quiet notification each morning (off by default)</T></View>
            <Toggle label="Daily art reminder" value={s.reminders} onValueChange={toggleReminders} />
          </Row>
          <Row gap={12}>
            <Icon name="vibrate" size={20} color={colors.textSecondary} />
            <View style={{ flex: 1 }}><T v="title" style={{ fontSize: 15 }}>Haptic snap feedback</T><T v="small">A subtle click when pieces lock together</T></View>
            <Toggle label="Haptic snap feedback" value={s.haptics} onValueChange={(haptics) => s.set({ haptics })} />
          </Row>
          <Row gap={12} style={{ backgroundColor: colors.surface, borderRadius: radius.base, padding: 12 }}>
            <Icon name="cloud-download-outline" size={20} color={colors.textSecondary} />
            <View style={{ flex: 1 }}><T v="title" style={{ fontSize: 15 }}>Offline art cache</T><T v="small">{(cache / 1048576).toFixed(1)} MB of downloaded daily artworks</T></View>
            <Button label="Clear" kind="tonal" size="sm" onPress={async () => { await clearCache(); setCache(0); }} />
          </Row>
        </Card>
      </Section>

      <Section title="Legal">
        <Notice icon="gavel" title="Age requirement" body={LEGAL_NOTICE} />
        <LinkRow icon="file-document-outline" title="Terms of Service" onPress={() => router.push('/legal/terms')} />
        <LinkRow icon="shield-account-outline" title="Privacy Policy" onPress={() => router.push('/legal/privacy')} />
        <LinkRow icon="bank-outline" title="Museum art credits" sub="Art Institute of Chicago and The Met — CC0 public-domain works"
          onPress={() => notify('Museum art credits', 'Daily puzzles use artworks released into the public domain (CC0) by the Art Institute of Chicago and The Metropolitan Museum of Art Open Access programs. Each puzzle shows its own credit line.')} />
        <LinkRow icon="archive-clock-outline" title="Photo retention" sub="Print photos are deleted 30 days after delivery; gift photos after 90 days"
          onPress={() => router.push('/legal/privacy')} />
        {configured.supabase ? <LinkRow icon="delete-outline" title="Erase my cloud data" sub="Delete your anonymous profile, gifts and uploads" onPress={erase} /> : null}
      </Section>

      {__DEV__ ? (
        <Section title="Developer (not in store builds)">
          <Card tone="low" style={{ gap: 12 }}>
            <Row gap={12}>
              <View style={{ flex: 1 }}><T v="title" style={{ fontSize: 15 }}>Preview as Pro</T><T v="small">Simulates the Pro entitlement without a purchase</T></View>
              <Toggle label="Preview as Pro" value={s.demoPro} onValueChange={(demoPro) => s.set({ demoPro })} />
            </Row>
            <Button label="Show age screen again" kind="secondary" size="sm" onPress={() => { s.set({ onboarded: false }); router.replace('/onboarding'); }} />
          </Card>
        </Section>
      ) : null}

      <View style={{ alignItems: 'center', gap: 2, paddingTop: 8 }}>
        <T v="headlineSm" style={{ fontSize: 16 }}>Studio Jigsaw</T>
        <T v="small">Version {Constants.expoConfig?.version ?? '1.0.0'}</T>
      </View>
    </Screen>
  );
}
