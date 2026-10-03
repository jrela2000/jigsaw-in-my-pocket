import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Picture } from '../../components/Picture';
import * as ImagePicker from 'expo-image-picker';
import { AppBar, Button, Card, Chip, Icon, IconButton, Notice, Row, Screen, SectionTitle, T, Toggle } from '../../components/ui';
import { BOARD_TEXTURES, colors, fonts, radius, TextureId } from '../../theme';
import { FREE_MAX_PIECES, PUZZLE_SIZES } from '../../config/printify';
import { dpiForSize } from '../../engine/dpi';
import { aspectFor, createPuzzle, Framing, useDraft } from '../../lib/createPuzzle';
import { useIsPro } from '../../store/entitlement';
import { useSettings } from '../../store/settings';
import { showRewarded } from '../../services/ads';
import { recordUnlock } from '../../services/supabase';
import { notify } from '../../lib/dialog';

const FRAMINGS: { id: Framing; label: string }[] = [
  { id: 'print', label: 'Print fit' }, { id: '4:3', label: '4:3' }, { id: '16:9', label: '16:9' }, { id: '1:1', label: '1:1' },
];

export default function NewPuzzle() {
  const { draft, setDraft } = useDraft();
  const isPro = useIsPro();
  const savedTexture = useSettings((s) => s.texture);
  const [pieces, setPieces] = useState(110);
  const [framing, setFraming] = useState<Framing | null>(null);
  const [rotation, setRotation] = useState(false);
  const [texture, setTexture] = useState<TextureId>(savedTexture);
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, exif: false });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    setFraming(null);
    setDraft({ uri: a.uri, width: a.width, height: a.height, title: (a.fileName ?? 'My Photo').replace(/\.[a-z0-9]+$/i, '').slice(0, 40) || 'My Photo', kind: 'photo' });
  };

  const frame: Framing = framing ?? (draft?.kind === 'collage' ? 'original' : 'print');
  const size = PUZZLE_SIZES.find((s) => s.pieces === pieces)!;
  const locked = pieces > FREE_MAX_PIECES && !isPro;
  const quality = draft ? dpiForSize(draft.width, draft.height, size) : null;
  const aspect = draft ? aspectFor(frame, draft.width, draft.height, pieces) : 4 / 3;

  const start = async (viaAd: boolean) => {
    if (!draft || busy) return;
    setBusy(true);
    try {
      if (viaAd) {
        const earned = await showRewarded();
        if (!earned) {
          notify('No ad available', 'We could not load an ad right now. Try again in a moment, or choose a free size.');
          return;
        }
      }
      const meta = await createPuzzle({ ...draft, pieces, framing: frame, rotation, texture });
      if (viaAd) void recordUnlock(meta.id, pieces);
      useSettings.getState().set({ texture });
      setDraft(null);
      router.push(`/puzzle/${meta.id}`);
    } catch (err) {
      console.warn(err);
      notify('Could not prepare this photo', 'Please try a different image.');
    } finally {
      setBusy(false);
    }
  };

  if (!draft) {
    return (
      <Screen bar={<AppBar />}>
        <View><T v="overline">Step 1 of 2 · Choose a photo</T><T v="headline">Curate Board</T></View>
        <Pressable onPress={pick} accessibilityRole="button" accessibilityLabel="Choose a photo">
          <Card style={{ alignItems: 'center', paddingVertical: 44, gap: 10, borderWidth: 1, borderColor: colors.outlineVariant, borderStyle: 'dashed' }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.sageTint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="image-plus" size={30} color={colors.primary} />
            </View>
            <T v="titleLg">Choose a photo</T>
            <T v="body" center>Any picture from your library becomes a puzzle.</T>
          </Card>
        </Pressable>
        <Button label="Make a collage instead" icon="view-grid-plus-outline" kind="secondary" onPress={() => router.push('/collage')} />
        <Notice icon="shield-lock-outline" title="Your photos stay on this device" body="A photo is only uploaded if you later choose to gift the puzzle or order a print, and we ask first." />
      </Screen>
    );
  }

  return (
    <Screen bar={<AppBar />} footer={
      locked ? (
        <>
          <Button label={`Watch Ad to Play (${pieces} Pieces)`} icon="play-circle-outline" size="lg" onPress={() => start(true)} loading={busy} />
          <Button label="Go Pro — all sizes, no ads" icon="infinity" kind="ghost" onPress={() => router.push('/paywall')} />
        </>
      ) : (
        <Button label={`Start Solving (${pieces.toLocaleString()} Pieces)`} icon="puzzle-outline" size="lg" onPress={() => start(false)} loading={busy} />
      )
    }>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}><T v="overline">Step 2 of 2 · Studio canvas</T><T v="headline">Curate Board</T></View>
        <IconButton name="image-multiple-outline" label="Choose a different photo" onPress={pick} />
      </Row>

      <Card style={{ padding: 10, gap: 12 }}>
        <View style={{ alignSelf: 'center', width: aspect >= 1 ? '100%' : '70%', aspectRatio: aspect, borderRadius: radius.base, overflow: 'hidden', backgroundColor: colors.surfaceDim }}>
          <Picture uri={draft.uri} style={{ flex: 1 }} label="Selected photo preview" />
        </View>
        <Row style={{ justifyContent: 'space-between', paddingHorizontal: 4 }}>
          <T v="overline">Framing</T>
          <Row gap={2} style={{ backgroundColor: colors.surfaceLow, borderRadius: radius.base, padding: 3 }}>
            {(draft.kind === 'collage' ? [{ id: 'original' as Framing, label: 'As designed' }, ...FRAMINGS.slice(0, 1)] : FRAMINGS).map((f) => (
              <Pressable key={f.id} onPress={() => setFraming(f.id)} accessibilityRole="button" accessibilityState={{ selected: frame === f.id }}
                style={{ paddingHorizontal: 11, paddingVertical: 7, borderRadius: 6, backgroundColor: frame === f.id ? colors.surface : 'transparent' }}>
                <Text style={{ fontFamily: frame === f.id ? fonts.sansSemi : fonts.sans, fontSize: 13, color: colors.text }}>{f.label}</Text>
              </Pressable>
            ))}
          </Row>
        </Row>
      </Card>

      {quality ? (
        <View style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: radius.md, alignItems: 'center', backgroundColor: quality.grade === 'excellent' ? colors.sageTint : colors.warningTint }}>
          <Icon name={quality.grade === 'excellent' ? 'check-decagram' : 'alert-outline'} size={26} color={quality.grade === 'excellent' ? colors.primary : colors.warning} />
          <View style={{ flex: 1 }}>
            <T v="title">{quality.dpi} DPI at {size.widthIn}" × {size.heightIn}"</T>
            <T v="small" color={colors.textSecondary}>
              {quality.grade === 'excellent' ? 'Sharp enough to print at this size.' : quality.grade === 'warning' ? 'Fine to play. A print at this size may look a little soft.' : 'Fine to play. Too small to print at this size — choose fewer pieces or a larger photo if you want a print.'}
            </T>
          </View>
        </View>
      ) : null}

      <SectionTitle title="Piece Count" sub="Sizes match the printed puzzles you can order" />
      {PUZZLE_SIZES.map((s) => {
        const on = s.pieces === pieces;
        const free = s.pieces <= FREE_MAX_PIECES;
        return (
          <Pressable key={s.pieces} onPress={() => setPieces(s.pieces)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${s.pieces} pieces, ${s.label}`}>
            <Row gap={14} style={{ padding: 12, borderRadius: radius.md, backgroundColor: on ? colors.surfaceHigh : colors.surface, borderWidth: 1, borderColor: on ? colors.sage : colors.hairline }}>
              <View style={{ width: 52, height: 52, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.primary : colors.surfaceMid }}>
                <Text style={{ fontFamily: fonts.sansSemi, fontSize: 17, color: on ? '#fff' : colors.text }}>{s.pieces >= 1000 ? '1k' : s.pieces}</Text>
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 9, letterSpacing: 0.6, color: on ? 'rgba(255,255,255,0.8)' : colors.textMuted }}>PCS</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Row><T v="title">{s.label}</T><Chip label={free ? 'Free' : isPro ? 'Pro' : 'Ad / Pro'} tone={free ? 'neutral' : 'linen'} /></Row>
                <T v="small" color={colors.textSecondary}>{s.estimate} · {s.blurb}</T>
              </View>
              <Icon name={on ? 'check-circle' : 'circle-outline'} size={22} color={on ? colors.primary : colors.outlineVariant} />
            </Row>
          </Pressable>
        );
      })}

      <SectionTitle title="Crafting Nuances" sub="How the puzzle behaves on the board" />
      <Card>
        <Row style={{ justifyContent: 'space-between' }} gap={12}>
          <View style={{ flex: 1 }}>
            <T v="title">Piece Rotation</T>
            <T v="small" color={colors.textSecondary}>Harder: pieces arrive turned. Tap a piece to rotate it.</T>
          </View>
          <Toggle label="Piece rotation" value={rotation} onValueChange={setRotation} />
        </Row>
      </Card>
      <Card style={{ gap: 12 }}>
        <View><T v="title">Board Texture</T><T v="small" color={colors.textSecondary}>{BOARD_TEXTURES.find((t) => t.id === texture)?.name} background</T></View>
        <Row style={{ justifyContent: 'space-between' }}>
          {BOARD_TEXTURES.map((t) => (
            <Pressable key={t.id} onPress={() => setTexture(t.id)} style={{ alignItems: 'center', gap: 6 }} accessibilityRole="radio" accessibilityState={{ selected: texture === t.id }} accessibilityLabel={`${t.name} board`}>
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: t.color, borderWidth: texture === t.id ? 2.5 : 1, borderColor: texture === t.id ? colors.primary : colors.outlineVariant, alignItems: 'center', justifyContent: 'center' }}>
                {texture === t.id ? <Icon name="check" size={18} color={t.dark ? '#fff' : colors.primary} /> : null}
              </View>
              <T v="small" color={texture === t.id ? colors.primary : colors.textSecondary}>{t.name}</T>
            </Pressable>
          ))}
        </Row>
      </Card>
    </Screen>
  );
}
