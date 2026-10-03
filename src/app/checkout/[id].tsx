import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Picture } from '../../components/Picture';
import { AppBar, Button, Card, Chip, Field, Icon, Notice, Row, Screen, T, Toggle } from '../../components/ui';
import { colors, fonts, radius } from '../../theme';
import { usePuzzles } from '../../store/puzzles';
import { useIsPro } from '../../store/entitlement';
import { isMinor, isUnder13, useSettings } from '../../store/settings';
import { formatCents, quote as localQuote, Quote, ShippingTier } from '../../../supabase/functions/_shared/pricing';
import { Address, claimGiftPrint, fetchQuote, startPrintOrder } from '../../services/commerce';
import { pay } from '../../services/payments';
import { preparePrintImage, printQuality } from '../../lib/print';
import { configured, PRINT_PERSONALIZATION } from '../../config/env';
import { readJson, writeJson } from '../../lib/json';
import { notify } from '../../lib/dialog';

const EMPTY: Address = { name: '', line1: '', line2: '', city: '', region: '', postalCode: '', country: 'US', email: '' };
const TIERS: { id: ShippingTier; title: string; sub: string }[] = [
  { id: 'standard', title: 'Standard Tracked', sub: 'Usually 4–8 business days after printing' },
  { id: 'express', title: 'Express', sub: 'Usually 2–4 business days after printing' },
];

export default function Checkout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const meta = usePuzzles((s) => s.puzzles.find((p) => p.id === id));
  const isPro = useIsPro();
  const birthYear = useSettings((s) => s.birthYear);
  const [address, setAddress] = useState<Address>(() => readJson('address.v1', EMPTY));
  const [shipping, setShipping] = useState<ShippingTier>('standard');
  const [boxText, setBoxText] = useState(meta?.title ?? '');
  const [giftMessage, setGiftMessage] = useState('');
  const [isGift, setIsGift] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [estimated, setEstimated] = useState(true);
  const [busy, setBusy] = useState(false);

  const claim = !!meta?.giftPrepaid && !!meta.giftToken;

  useEffect(() => {
    if (!meta) return;
    setQuote(localQuote(meta.pieces, isPro, shipping));
    setEstimated(true);
    if (!configured.supabase) return;
    let live = true;
    fetchQuote(meta.pieces, shipping, address.country)
      .then((q) => { if (live) { setQuote(q); setEstimated(false); } })
      .catch(() => {});
    return () => { live = false; };
  }, [meta, isPro, shipping, address.country]);

  if (!meta) return <Screen bar={<AppBar title="Order Print" back />}><T v="body">This puzzle is no longer on this device.</T></Screen>;
  if (isUnder13(birthYear)) return <Screen bar={<AppBar title="Order Print" back />}><Notice icon="information-outline" body="Print ordering is not available for this profile." /></Screen>;

  const quality = printQuality(meta);
  const set = (k: keyof Address) => (v: string) => setAddress((a) => ({ ...a, [k]: v }));
  const missing = (['name', 'line1', 'city', 'region', 'postalCode', 'country'] as const).filter((k) => !address[k].trim());
  const emailOk = claim || /^\S+@\S+\.\S+$/.test(address.email.trim());

  const submit = async () => {
    if (missing.length || !emailOk) {
      notify('Please complete the delivery details', !emailOk ? 'Enter an email address so we can send your receipt and tracking.' : 'Some address fields are still empty.');
      return;
    }
    setBusy(true);
    try {
      writeJson('address.v1', address);
      if (claim) {
        await claimGiftPrint(meta.giftToken!, address);
        usePuzzles.getState().update(meta.id, { giftPrepaid: false });
        notify('Your puzzle is on its way to the printer', 'We will show tracking in Orders once it ships.');
        router.replace('/');
        return;
      }
      const imageUri = await preparePrintImage(meta);
      const order = await startPrintOrder({ imageUri, pieces: meta.pieces, title: meta.title, shipping, address, boxText, giftMessage, isGift });
      const res = await pay(order.clientSecret, address.name);
      if (res.ok) {
        notify('Order placed', 'Thank you. Your puzzle is being sent to the print studio.');
        router.replace('/orders');
      } else if (!res.cancelled) {
        notify('Payment was not completed', res.message);
      }
    } catch (err: any) {
      notify('We could not place this order', err?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const line = (label: string, value: string, strong?: boolean, tone?: string) => (
    <Row style={{ justifyContent: 'space-between' }}>
      <T v={strong ? 'titleLg' : 'body'} color={tone}>{label}</T>
      <T v={strong ? 'headline' : 'body'} color={tone ?? (strong ? colors.primary : colors.text)} style={strong ? { fontFamily: fonts.sansSemi } : undefined}>{value}</T>
    </Row>
  );

  return (
    <Screen bar={<AppBar title={claim ? 'Claim Your Print' : 'Order Print'} back />} footer={
      quality.grade === 'blocked' ? null : claim ? (
        <Button label="Confirm Delivery Address" icon="truck-check-outline" size="lg" onPress={submit} loading={busy} />
      ) : (
        <>
          <Button label={quote ? `Pay ${formatCents(quote.totalCents)}` : 'Pay'} icon="credit-card-outline" size="lg" onPress={submit} loading={busy} />
          <T v="small" center>Apple Pay, Google Pay and cards. Payments are processed securely by Stripe.</T>
        </>
      )
    }>
      <Card>
        <Row gap={14} style={{ alignItems: 'flex-start' }}>
          <Picture uri={meta.imageUri} style={{ width: 96, height: 78, borderRadius: radius.base, backgroundColor: colors.surfaceDim }} />
          <View style={{ flex: 1, gap: 4 }}>
            <T v="headlineSm" numberOfLines={2}>{meta.title}</T>
            <T v="small">{meta.pieces} pieces · {quality.size.widthIn}" × {quality.size.heightIn}"</T>
            <Chip label={`${quality.dpi} DPI • ${quality.grade === 'excellent' ? 'Print ready' : quality.grade === 'warning' ? 'May print soft' : 'Too small'}`}
              icon={quality.grade === 'excellent' ? 'check-circle-outline' : 'alert-outline'} tone={quality.grade === 'excellent' ? 'sage' : 'warn'} />
          </View>
        </Row>
      </Card>

      {quality.grade === 'blocked' ? (
        <Notice tone="warn" icon="alert-outline" title="This photo is too small for this print size"
          body={`At ${quality.size.widthIn}" × ${quality.size.heightIn}" it would print at about ${quality.dpi} DPI and look blurry. Start the puzzle with fewer pieces, or use a larger original photo.`} />
      ) : (
        <>
          {quality.grade === 'warning' ? <Notice tone="warn" icon="alert-outline" title="Heads up on sharpness" body={`This photo prints at about ${quality.dpi} DPI at this size. It will look good from arm's length but not razor sharp.`} /> : null}
          <Notice icon="crop" body="The print uses your full original photo, centred and cropped to the puzzle's shape." />

          {PRINT_PERSONALIZATION && !claim ? (
            <Card style={{ gap: 12 }}>
              <Row><Icon name="pencil-outline" size={18} /><T v="titleLg">Personalize</T></Row>
              <Field label="Box title" hint={`${boxText.length}/32`} value={boxText} onChangeText={(v) => setBoxText(v.slice(0, 32))} />
              <Field label="Gift message" value={giftMessage} onChangeText={(v) => setGiftMessage(v.slice(0, 200))} multiline />
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}><T v="title">This order is a gift</T><T v="small">Leave prices off the packing slip</T></View>
                <Toggle label="This order is a gift" value={isGift} onValueChange={setIsGift} />
              </Row>
            </Card>
          ) : null}

          <Card style={{ gap: 12 }}>
            <Row><Icon name="truck-outline" size={18} /><T v="titleLg">Shipping Address</T></Row>
            <Field label="Full name" value={address.name} onChangeText={set('name')} autoComplete="name" textContentType="name" />
            {!claim ? <Field label="Email for receipt and tracking" value={address.email} onChangeText={set('email')} autoComplete="email" keyboardType="email-address" autoCapitalize="none" /> : null}
            <Field label="Address line 1" value={address.line1} onChangeText={set('line1')} autoComplete="address-line1" textContentType="streetAddressLine1" />
            <Row gap={12}>
              <Field label="Apt / Suite (optional)" value={address.line2} onChangeText={set('line2')} style={{ flex: 1 }} />
              <Field label="Postal code" value={address.postalCode} onChangeText={set('postalCode')} autoComplete="postal-code" style={{ flex: 1 }} />
            </Row>
            <Row gap={12}>
              <Field label="City" value={address.city} onChangeText={set('city')} style={{ flex: 1 }} />
              <Field label="State / Region" value={address.region} onChangeText={set('region')} style={{ flex: 1 }} />
            </Row>
            <Field label="Country code" hint="e.g. US, CA, GB" value={address.country} onChangeText={(v) => set('country')(v.toUpperCase().slice(0, 2))} autoCapitalize="characters" />
          </Card>

          {!claim ? (
            <>
              <Card style={{ gap: 10 }}>
                <T v="titleLg">Delivery</T>
                {TIERS.map((t) => {
                  const on = shipping === t.id;
                  return (
                    <Pressable key={t.id} onPress={() => setShipping(t.id)} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                      <Row gap={12} style={{ padding: 12, borderRadius: radius.base, backgroundColor: colors.surfaceLow, borderWidth: 1, borderColor: on ? colors.primary : 'transparent' }}>
                        <Icon name={on ? 'radiobox-marked' : 'radiobox-blank'} size={20} color={on ? colors.primary : colors.outline} />
                        <View style={{ flex: 1 }}><T v="title" style={{ fontSize: 14 }}>{t.title}</T><T v="small">{t.sub}</T></View>
                        <T v="title">{formatCents(localQuote(meta.pieces, isPro, t.id).shippingCents)}</T>
                      </Row>
                    </Pressable>
                  );
                })}
              </Card>

              {quote ? (
                <Card style={{ gap: 8 }}>
                  <Row><Icon name="receipt-text-outline" size={18} /><T v="titleLg">Order Summary</T></Row>
                  {line(`Jigsaw puzzle (${meta.pieces} pieces)`, formatCents(quote.baseCents))}
                  {quote.discountCents ? line('Studio Pro membership (15% off)', formatCents(-quote.discountCents), false, colors.primary) : null}
                  {line('Packaging & shipping', formatCents(quote.shippingCents))}
                  {line(estimated ? 'Estimated sales tax' : 'Sales tax', formatCents(quote.taxCents))}
                  <View style={{ height: 1, backgroundColor: colors.hairline, marginVertical: 4 }} />
                  {line('Total', formatCents(quote.totalCents), true)}
                  {estimated ? <T v="small">Estimate. The final total is confirmed before you pay.</T> : null}
                </Card>
              ) : null}
            </>
          ) : null}

          {isMinor(birthYear) ? <Notice icon="account-supervisor-outline" body="If you are under 18, you need a parent or guardian's permission to make purchases." /> : null}
          <T v="small" center>Printed to order by our print partner. Your photo is uploaded securely for printing and deleted 30 days after delivery.</T>
        </>
      )}
    </Screen>
  );
}
