import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Picture } from '../components/Picture';
import * as ImagePicker from 'expo-image-picker';
import { AppBar, Button, Card, Chip, Field, Icon, Notice, Row, Screen, SectionTitle, T, Toggle } from '../components/ui';
import { SkiaGate } from '../components/SkiaGate';
import type { CollageJob } from '../components/CollageRender';
import { colors, fonts, radius } from '../theme';
import { CAPTION_FRAC, COLLAGE_ASPECT, COLLAGE_LAYOUTS, MATTING } from '../config/collage';
import { PUZZLE_SIZES } from '../config/printify';
import { cellDpi } from '../engine/dpi';
import { useIsPro } from '../store/entitlement';
import { useDraft } from '../lib/createPuzzle';
import { notify } from '../lib/dialog';

type Photo = { uri: string; width: number; height: number };
const loadRenderer = () => import('../components/CollageRender');
// Cells are checked against the 252-piece print (14" x 11"), the collage canvas shape.
const REFERENCE = PUZZLE_SIZES[2];

export default function Collage() {
  const isPro = useIsPro();
  const setDraft = useDraft((s) => s.setDraft);
  const [layoutId, setLayoutId] = useState('split2');
  const [photos, setPhotos] = useState<(Photo | null)[]>([]);
  const [matting, setMatting] = useState<(typeof MATTING)[number]['id']>('thin');
  const [captionOn, setCaptionOn] = useState(false);
  const [caption, setCaption] = useState('');
  const [job, setJob] = useState<CollageJob | null>(null);

  const layout = COLLAGE_LAYOUTS.find((l) => l.id === layoutId)!;
  const slots = layout.cells.map((_, i) => photos[i] ?? null);
  const filled = slots.filter(Boolean).length;
  const areaFrac = captionOn ? 1 - CAPTION_FRAC : 1;

  const quality = useMemo(() => slots.map((p, i) => (p ? cellDpi(p.width, p.height, layout.cells[i][2], layout.cells[i][3] * areaFrac, REFERENCE) : null)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [photos, layoutId, areaFrac]);
  const weak = quality.map((q, i) => (q && q.grade === 'blocked' ? i + 1 : 0)).filter(Boolean);

  const pickFor = async (index: number | null) => {
    const multiple = index == null;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsMultipleSelection: multiple, selectionLimit: multiple ? layout.cells.length - filled : 1, exif: false });
    if (res.canceled) return;
    const picked = res.assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height }));
    setPhotos((prev) => {
      const next = layout.cells.map((_, i) => prev[i] ?? null);
      if (index != null) next[index] = picked[0];
      else for (const p of picked) { const empty = next.findIndex((x) => !x); if (empty >= 0) next[empty] = p; }
      return next;
    });
  };

  const choose = (id: string, pro: boolean) => {
    if (pro && !isPro) return router.push('/paywall');
    setLayoutId(id);
  };

  const reorder = () => setPhotos((prev) => { const f = prev.filter(Boolean); return f.length > 1 ? [...f.slice(1), f[0]] : prev; });

  const proceed = () => {
    if (filled < layout.cells.length) return notify('Add a photo to every cell', `This layout needs ${layout.cells.length} photos.`);
    setJob({ photos: slots as Photo[], cells: layout.cells, mattingFrac: MATTING.find((m) => m.id === matting)!.frac, caption: captionOn && caption.trim() ? caption.trim() : null });
  };

  const gap = { flush: 0, thin: 2, classic: 5 }[matting];

  return (
    <Screen bar={<AppBar title="Collage Studio" back />} footer={
      <Row gap={10}>
        <Button label="Reorder" icon="shuffle-variant" kind="tonal" size="lg" onPress={reorder} disabled={filled < 2} />
        <Button label="Continue to Setup" iconRight="arrow-right" size="lg" style={{ flex: 1 }} onPress={proceed} loading={!!job} />
      </Row>
    }>
      <View><T v="overline">Step 1 of 2</T><T v="headline">Layout & Photos</T></View>

      <Card style={{ padding: 10 }}>
        <View style={{ aspectRatio: COLLAGE_ASPECT, backgroundColor: '#f6f3ec', borderRadius: 4, overflow: 'hidden' }}>
          <View style={{ flex: areaFrac }}>
            {layout.cells.map(([x, y, w, h], i) => {
              const p = slots[i];
              const q = quality[i];
              return (
                <Pressable key={i} onPress={() => pickFor(i)} accessibilityRole="button" accessibilityLabel={p ? `Replace photo ${i + 1}` : `Add photo ${i + 1}`}
                  style={{ position: 'absolute', left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%`, padding: gap }}>
                  <View style={{ flex: 1, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {p ? <Picture uri={p.uri} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} /> : <Icon name="plus" size={24} color={colors.textMuted} />}
                    {q ? (
                      <Chip label={q.grade === 'blocked' ? `${q.dpi} DPI • Swap` : `${q.dpi} DPI`} icon={q.grade === 'excellent' ? 'check-circle-outline' : 'alert-outline'}
                        tone={q.grade === 'excellent' ? 'white' : 'warn'} style={{ position: 'absolute', top: 5, left: 5 }} />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
          {captionOn ? (
            <View style={{ flex: CAPTION_FRAC, alignItems: 'center', justifyContent: 'center' }}>
              <Text numberOfLines={1} style={{ fontFamily: fonts.serifItalic, fontSize: 14, color: colors.text }}>{caption || 'Your caption'}</Text>
            </View>
          ) : null}
        </View>
      </Card>

      {weak.length ? (
        <Notice tone="warn" icon="alert-outline" title={`Print check: ${weak.length} weak ${weak.length === 1 ? 'cell' : 'cells'}`}
          body={`Photo ${weak.join(', ')} would print under 150 DPI on a ${REFERENCE.widthIn}" × ${REFERENCE.heightIn}" puzzle. Tap the cell to swap in a larger original. It is still fine to play.`} />
      ) : null}

      <SectionTitle title="Choose Layout" right={<T v="label">2 – 9 photos</T>} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
        {COLLAGE_LAYOUTS.map((l) => {
          const on = l.id === layoutId;
          return (
            <Pressable key={l.id} onPress={() => choose(l.id, l.pro)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${l.name} layout${l.pro && !isPro ? ', Pro' : ''}`}>
              <View style={{ width: 112, padding: 10, borderRadius: radius.md, backgroundColor: on ? colors.surfaceHigh : colors.surfaceLow, borderWidth: 1.5, borderColor: on ? colors.primary : 'transparent', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 88, height: 69, backgroundColor: colors.surfaceDim, borderRadius: 4 }}>
                  {l.cells.map(([x, y, w, h], i) => (
                    <View key={i} style={{ position: 'absolute', left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%`, padding: 2 }}>
                      <View style={{ flex: 1, backgroundColor: on ? colors.sage : '#fff', borderRadius: 2 }} />
                    </View>
                  ))}
                </View>
                <T v="title" style={{ fontSize: 14 }}>{l.name}</T>
                <T v="small">{l.sub}</T>
                {l.pro && !isPro ? <Chip label="PRO" tone="linen" style={{ position: 'absolute', top: -8, right: 6 }} /> : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <Card tone="low" style={{ gap: 14 }}>
        <T v="titleLg">Borders</T>
        <Row gap={2} style={{ backgroundColor: colors.surfaceMid, borderRadius: radius.base, padding: 3 }}>
          {MATTING.map((m) => (
            <Pressable key={m.id} onPress={() => setMatting(m.id)} accessibilityRole="radio" accessibilityState={{ selected: matting === m.id }}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 6, backgroundColor: matting === m.id ? colors.surface : 'transparent' }}>
              <Text style={{ fontFamily: matting === m.id ? fonts.sansSemi : fonts.sans, fontSize: 14, color: colors.text }}>{m.name}</Text>
            </Pressable>
          ))}
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}><T v="titleLg">Caption Strip</T><T v="small">Printed along the bottom edge</T></View>
          <Toggle label="Caption strip" value={captionOn} onValueChange={setCaptionOn} />
        </Row>
        {captionOn ? <Field label="Caption" hint={`${caption.length}/48`} value={caption} onChangeText={(v) => setCaption(v.slice(0, 48))} placeholder="Tuscan Sunsets • 2024" /> : null}
      </Card>

      <Row style={{ justifyContent: 'space-between' }}>
        <Row><Icon name="image-multiple-outline" size={18} /><T v="body">{filled} of {layout.cells.length} photos added</T></Row>
        <Button label="Add Photos" icon="plus" kind="ghost" size="sm" onPress={() => pickFor(null)} disabled={filled >= layout.cells.length} />
      </Row>

      {job ? (
        <SkiaGate load={loadRenderer} props={{
          job,
          onDone: (r) => {
            setJob(null);
            setDraft({ uri: r.uri, width: r.width, height: r.height, title: caption.trim() || 'My Collage', kind: 'collage' });
            router.replace('/new');
          },
          onError: () => { setJob(null); notify('The collage could not be created', 'Please try again with different photos.'); },
        }} />
      ) : null}
    </Screen>
  );
}
