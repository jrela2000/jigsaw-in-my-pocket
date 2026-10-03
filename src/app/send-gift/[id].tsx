import React, { useState } from 'react';
import { Pressable, Share, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Picture } from '../../components/Picture';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { AppBar, Button, Card, Chip, Field, Icon, Notice, Row, Screen, SectionTitle, T } from '../../components/ui';
import { colors, fonts, radius } from '../../theme';
import { usePuzzles } from '../../store/puzzles';
import { useIsPro } from '../../store/entitlement';
import { isUnder13, useSettings } from '../../store/settings';
import { sizeFor } from '../../config/printify';
import { formatCents, quote } from '../../../supabase/functions/_shared/pricing';
import { createGift, startPrintOrder } from '../../services/commerce';
import { pay } from '../../services/payments';
import { preparePrintImage, printQuality } from '../../lib/print';
import { notify } from '../../lib/dialog';

export default function SendGift() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const meta = usePuzzles((s) => s.puzzles.find((p) => p.id === id));
  const isPro = useIsPro();
  const under13 = useSettings((s) => isUnder13(s.birthYear));
  const [sender, setSender] = useState('');
  const [recipient, setRecipient] = useState('');
  const [note, setNote] = useState('');
  const [format, setFormat] = useState<'digital' | 'physical'>('digital');
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  if (!meta) return <Screen bar={<AppBar title="Gift a Puzzle" back />}><T v="body">This puzzle is no longer on this device.</T></Screen>;

  const size = sizeFor(meta.pieces);
  const q = quote(meta.pieces, isPro);
  const physicalOk = !under13 && printQuality(meta).grade !== 'blocked';

  const create = async () => {
    if (!sender.trim() || !recipient.trim()) {
      notify('Add both names', 'Your recipient will see who the puzzle is from.');
      return;
    }
    setBusy(true);
    try {
      const gift = await createGift({ imageUri: meta.imageUri, title: meta.title, pieces: meta.pieces, rotation: meta.rotation, senderName: sender.trim(), recipientName: recipient.trim(), note: note.trim() });
      if (format === 'physical') {
        const imageUri = await preparePrintImage(meta);
        const order = await startPrintOrder({ imageUri, pieces: meta.pieces, title: meta.title, shipping: 'standard', address: null, giftToken: gift.token, isGift: true, giftMessage: note.trim() });
        const res = await pay(order.clientSecret, sender.trim());
        if (!res.ok) {
          if (!res.cancelled) notify('Payment was not completed', res.message);
          notify('Digital gift created', 'The puzzle link is ready to share. The printed puzzle was not paid for, so it is not included.');
        }
      }
      setLink(gift.url);
    } catch (err: any) {
      notify('We could not create this gift', err?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const option = (key: 'digital' | 'physical', title: string, badge: string, body: string, foot: string, disabled?: boolean) => {
    const on = format === key;
    return (
      <Pressable onPress={() => !disabled && setFormat(key)} accessibilityRole="radio" accessibilityState={{ selected: on, disabled }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, gap: 8, borderWidth: 1.5, borderColor: on ? colors.primary : colors.hairline, opacity: disabled ? 0.5 : 1 }}>
          <Row>
            <Icon name={on ? 'radiobox-marked' : 'radiobox-blank'} size={22} color={on ? colors.primary : colors.outlineVariant} />
            <T v="titleLg">{title}</T>
            <Chip label={badge} tone={key === 'digital' ? 'sage' : 'brass'} />
          </Row>
          <T v="body">{body}</T>
          <T v="small">{foot}</T>
        </View>
      </Pressable>
    );
  };

  if (link) {
    return (
      <Screen bar={<AppBar title="Gift a Puzzle" back />}>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Chip label="GIFT READY" icon="gift-outline" tone="linen" style={{ alignSelf: 'center' }} />
          <T v="display" center>Share with {recipient.trim()}</T>
          <T v="bodyLg" center>Anyone with this link can play the puzzle. No account needed.</T>
        </View>
        <Card style={{ alignItems: 'center', gap: 14 }}>
          <QRCode value={link} size={170} color={colors.primary} backgroundColor="#fff" />
          <T v="body" selectable style={{ fontFamily: fonts.sansMedium }}>{link}</T>
          <Row gap={10}>
            <Button label="Copy" icon="content-copy" kind="secondary" onPress={async () => { await Clipboard.setStringAsync(link); notify('Link copied'); }} />
            <Button label="Share Link" icon="share-variant-outline" onPress={() => Share.share({ message: `${sender.trim()} sent you a puzzle: ${link}` }).catch(() => {})} />
          </Row>
        </Card>
        <Notice icon="clock-outline" body="The gift link and its photo are deleted after 90 days unless the puzzle is ordered as a print." />
      </Screen>
    );
  }

  return (
    <Screen bar={<AppBar title="Gift a Puzzle" back />} footer={<Button label={format === 'physical' ? `Pay ${formatCents(q.totalCents)} & Create Gift` : 'Create Gift & Share Link'} icon="gift-outline" size="lg" onPress={create} loading={busy} />}>
      <View>
        <T v="overline">Gifting</T>
        <T v="headline">Gift This Puzzle</T>
        <T v="body">Send it as a puzzle to play, or prepay the printed edition too.</T>
      </View>

      <Card>
        <Row gap={14}>
          <Picture uri={meta.imageUri} style={{ width: 92, height: 76, borderRadius: radius.base, backgroundColor: colors.surfaceDim }} />
          <View style={{ flex: 1, gap: 4 }}>
            <T v="headlineSm" numberOfLines={2}>{meta.title}</T>
            <T v="small">{meta.pieces} Pieces • {size.estimate}</T>
          </View>
        </Row>
      </Card>

      <SectionTitle title="Personalize Your Gift" />
      <Card style={{ gap: 12 }}>
        <Row gap={12}>
          <Field label="Your name" value={sender} onChangeText={(v) => setSender(v.slice(0, 40))} style={{ flex: 1 }} />
          <Field label="Recipient's name" value={recipient} onChangeText={(v) => setRecipient(v.slice(0, 40))} style={{ flex: 1 }} />
        </Row>
        <Field label="Personal note" hint={`${note.length} / 200`} value={note} onChangeText={(v) => setNote(v.slice(0, 200))} multiline placeholder="Happy birthday! Solve this to relive our trip." />
        <Notice icon="email-open-outline" body="Your note is shown to the recipient when they open the link." />
      </Card>

      <SectionTitle title="Choose Gifting Format" />
      {option('digital', 'Digital Puzzle', 'Free', `${recipient.trim() || 'Your recipient'} plays straight away at ${meta.pieces} pieces. No account, and no ad gate.`, 'Link works on iPhone and Android')}
      {option('physical', 'Printed Puzzle Too', `+${formatCents(q.baseCents - q.discountCents)}`,
        'You pay for the printed puzzle now. Once they finish the digital one, they just confirm their delivery address.',
        physicalOk ? `${size.widthIn}" × ${size.heightIn}" · standard shipping included at checkout${isPro ? ' · Pro 15% discount applied' : ''}` : under13 ? 'Not available for this profile' : 'This photo is too small to print at this size',
        !physicalOk)}

      <Notice icon="shield-check-outline" title="This photo will be uploaded"
        body="To share the puzzle, this one photo is uploaded to our secure storage so your recipient can load it. It is deleted automatically after 90 days unless it is ordered as a print." />
    </Screen>
  );
}
