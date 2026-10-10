import React, { useEffect, useMemo, useState } from 'react';
import { Share, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Picture } from '../../components/Picture';
import Svg, { Path } from 'react-native-svg';
import { AppBar, Button, Card, Chip, Icon, IconName, Notice, Row, Screen, T } from '../../components/ui';
import { colors, fonts, radius } from '../../theme';
import { usePuzzles } from '../../store/puzzles';
import { isUnder13, useSettings } from '../../store/settings';
import { useIsPro } from '../../store/entitlement';
import { generateGeometry } from '../../engine/geometry';
import { accuracy } from '../../engine/state';
import { formatDuration } from '../../lib/json';
import { formatCents, quote } from '../../../supabase/functions/_shared/pricing';
import { printQuality } from '../../lib/print';
import { maybeShowInterstitial } from '../../services/ads';
import { setDailyReminder } from '../../services/notifications';
import { confirm } from '../../lib/dialog';

const SPECS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'texture-box', title: 'Sturdy chipboard pieces', body: 'Your image printed edge to edge with a smooth finish.' },
  { icon: 'content-cut', title: 'The same piece count you just solved', body: 'Cut as a classic interlocking jigsaw.' },
  { icon: 'archive-outline', title: 'Boxed with your picture on the lid', body: 'Printed to order and shipped to your door.' },
];

export default function Completed() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const meta = usePuzzles((s) => s.puzzles.find((p) => p.id === id));
  const isPro = useIsPro();
  const under13 = useSettings((s) => isUnder13(s.birthYear));
  const [cutLines, setCutLines] = useState(true);

  const lines = useMemo(() => {
    if (!meta) return '';
    return generateGeometry(meta.cols, meta.rows, meta.boardW / meta.cols, meta.boardH / meta.rows, meta.seed).cutLines;
  }, [meta]);

  useEffect(() => {
    if (!meta?.completedAt || Date.now() - meta.completedAt > 15000) return;
    // Only ever after a completion, never during play; frequency caps live in the ads service.
    void maybeShowInterstitial();
    const s = useSettings.getState();
    if (meta.dailyDate && s.streak.dailyCompleted >= 3 && !s.reminderOffered) {
      s.set({ reminderOffered: true });
      confirm('A gentle daily reminder?', 'Would you like one quiet notification each morning when the new artwork is ready? You can turn it off any time in Settings.', 'Turn on')
        .then(async (yes) => { if (yes && (await setDailyReminder(true))) useSettings.getState().set({ reminders: true }); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta?.id]);

  if (!meta) return <Screen bar={<AppBar title="Completed" back />}><T v="body">This puzzle is no longer on this device.</T></Screen>;

  const total = meta.cols * meta.rows;
  const q = quote(meta.pieces, isPro);
  const quality = printQuality(meta);

  return (
    <Screen bar={<AppBar title="Completed" back />}>
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Chip label="MASTERPIECE ASSEMBLED" icon="seal-variant" tone="linen" style={{ alignSelf: 'center' }} />
        <T v="display" center>Puzzle Solved!</T>
        <T v="bodyLg" center>A quiet stretch of focus, and {meta.title} is whole again.</T>
      </View>

      <Card tone="low">
        <Row>
          {[['Time', formatDuration(meta.elapsedMs)], ['Pieces', String(total)], ['Accuracy', `${accuracy(total, meta.moves)}%`]].map(([k, v], i) => (
            <View key={k} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i ? 1 : 0, borderLeftColor: colors.outlineVariant }}>
              <T v="overline">{k}</T>
              <T v="titleLg" style={{ fontSize: 20, lineHeight: 28 }}>{v}</T>
            </View>
          ))}
        </Row>
      </Card>

      <Card style={{ padding: 10, gap: 10 }}>
        <View style={{ aspectRatio: meta.boardW / meta.boardH, borderRadius: radius.base, overflow: 'hidden', backgroundColor: colors.surfaceDim }}>
          <Picture uri={meta.imageUri} style={{ flex: 1 }} label={`Completed puzzle: ${meta.title}`} />
          {cutLines ? (
            <Svg viewBox={`0 0 ${meta.boardW} ${meta.boardH}`} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} width="100%" height="100%">
              <Path d={lines} stroke="rgba(255,255,255,0.55)" strokeWidth={meta.boardW / 500} fill="none" />
            </Svg>
          ) : null}
        </View>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <T v="title" numberOfLines={1}>{meta.title}</T>
            {meta.credit ? <T v="small" numberOfLines={2}>{meta.credit}</T> : null}
          </View>
          <Button label={cutLines ? 'Hide Cut Lines' : 'Show Cut Lines'} icon={cutLines ? 'eye-outline' : 'eye-off-outline'} kind="tonal" size="sm" onPress={() => setCutLines(!cutLines)} />
        </Row>
      </Card>

      {!under13 ? (
        <Card style={{ gap: 12 }}>
          <Row style={{ justifyContent: 'space-between' }}><T v="overline">Printed edition</T><Chip label={`${quality.size.widthIn}" × ${quality.size.heightIn}"`} /></Row>
          <T v="headline">Bring Your Solved Art Home</T>
          <T v="bodyLg">Order this exact picture as a real {meta.pieces}-piece jigsaw, made to order.</T>
          <View style={{ backgroundColor: colors.surfaceLow, borderRadius: radius.md, padding: 12, gap: 10 }}>
            {SPECS.map((s) => (
              <Row key={s.title} gap={10} style={{ alignItems: 'flex-start' }}>
                <Icon name={s.icon} size={18} color={colors.primary} />
                <View style={{ flex: 1 }}><T v="title" style={{ fontSize: 14 }}>{s.title}</T><T v="small" color={colors.textSecondary}>{s.body}</T></View>
              </Row>
            ))}
          </View>
          <Row style={{ alignItems: 'flex-end' }} gap={10}>
            <T v="display" style={{ fontFamily: fonts.sansSemi }}>{formatCents(q.baseCents - q.discountCents)}</T>
            {isPro ? <T v="bodyLg" style={{ textDecorationLine: 'line-through' }}>{formatCents(q.baseCents)}</T> : null}
            {isPro ? <Chip label={`Save ${formatCents(q.discountCents)}`} tone="sage" style={{ marginLeft: 'auto' }} /> : null}
          </Row>
          <T v="small" color={colors.primary}>{isPro ? 'Pro member 15% discount applied' : 'Pro members save 15% on every print'} · plus shipping</T>
          {quality.grade === 'blocked' ? (
            <Notice tone="warn" icon="alert-outline" title="This photo is too small to print at this size" body={`It would print at about ${quality.dpi} DPI. Start the puzzle again with fewer pieces, or use a larger original, to order a print.`} />
          ) : (
            <Button label="Customize & Order Print" icon="shopping-outline" size="lg" onPress={() => router.push(`/checkout/${meta.id}`)} />
          )}
        </Card>
      ) : null}

      {/* Shares the time and piece count only, never the photo. */}
      <Button label="Share My Time" icon="share-variant-outline" kind="secondary"
        onPress={() => Share.share({ message: `I just finished a ${meta.pieces}-piece puzzle in ${formatDuration(meta.elapsedMs)} on Jigsaw In My Pocket.` }).catch(() => {})} />
      <Button label="Back to Gallery" kind="ghost" onPress={() => router.replace('/')} />
    </Screen>
  );
}
