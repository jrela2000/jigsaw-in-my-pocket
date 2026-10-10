import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { BuildIn, PressableScale as Pressable } from '../motion';
import { BrandedLoader } from '../feedback';
import { sound } from '../../lib/sound';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic } from '../../lib/haptics';
import { useImage } from '@shopify/react-native-skia';
import { BoardAssets, buildBoardAssets, COLOR_FAMILIES } from './assets';
import { BoardStats, CHIPS_H, DropEvent, PuzzleBoard, PuzzleBoardHandle, TRAY_H, TrayFilter } from './PuzzleBoard';
import { createState, PuzzleState } from '../../engine/state';
import { BOARD_TEXTURES, colors, fonts, radius, shadow } from '../../theme';
import { Button, Icon, IconButton, Logo, Progress, Row, T } from '../ui';
import { loadPuzzleState, savePuzzleState, usePuzzles } from '../../store/puzzles';
import { useSettings } from '../../store/settings';
import { useIsPro } from '../../store/entitlement';
import { clock } from '../../lib/json';
import { offerRewarded } from '../../lib/gates';
import { FREE_HINTS } from '../../config/env';

export default function BoardScreen({ id }: { id: string }) {
  const insets = useSafeAreaInsets();
  const meta = usePuzzles((s) => s.puzzles.find((p) => p.id === id));
  const update = usePuzzles((s) => s.update);
  const isPro = useIsPro();
  const hintsLeft = useSettings((s) => s.hintsLeft);
  const image = useImage(meta?.imageUri);
  const board = useRef<PuzzleBoardHandle>(null);

  const [assets, setAssets] = useState<BoardAssets | null>(null);
  const [failed, setFailed] = useState(false);
  const [stats, setStats] = useState<BoardStats>({ placed: meta?.placed ?? 0, trayAll: 0, trayEdges: 0, families: [], zoom: 1 });
  const [filter, setFilter] = useState<TrayFilter>({ kind: 'all' });
  const [sortingUnlocked, setSortingUnlocked] = useState(false);
  const [reference, setReference] = useState(true);
  const [elapsed, setElapsed] = useState(meta?.elapsedMs ?? 0);
  const [done, setDone] = useState(false);
  const elapsedRef = useRef(elapsed);
  const moves = useRef(meta?.moves ?? 0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneRef = useRef(false);

  const total = meta ? meta.cols * meta.rows : 0;
  const initial = useMemo<PuzzleState | null>(() => {
    if (!meta) return null;
    const saved = loadPuzzleState(meta.id);
    return saved && saved.where.length === total ? saved : createState(total, meta.seed, meta.rotation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta?.id]);

  // Cutting 1,000 pieces takes a moment, so it runs after the loading state has painted.
  useEffect(() => {
    if (!image || !meta || assets) return;
    const t = setTimeout(() => {
      try {
        setAssets(buildBoardAssets(image, meta.cols, meta.rows, meta.seed));
      } catch (err) {
        console.warn('[board] could not cut puzzle', err);
        setFailed(true);
      }
    }, 30);
    return () => clearTimeout(t);
  }, [image, meta, assets]);

  // Callbacks read the latest meta through a ref so saving progress never re-creates them.
  const metaRef = useRef(meta);
  metaRef.current = meta;
  const ready = !!assets;

  const persist = useCallback((state?: PuzzleState, placed?: number) => {
    if (!metaRef.current) return;
    const s = state ?? board.current?.snapshot();
    if (s) savePuzzleState(id, s);
    update(id, { elapsedMs: elapsedRef.current, moves: moves.current, updatedAt: Date.now(), ...(placed != null ? { placed } : {}) });
  }, [id, update]);

  // Timer runs only while this screen is focused and the puzzle is unfinished; leaving auto-saves.
  useFocusEffect(
    useCallback(() => {
      if (done || !ready) return;
      const t = setInterval(() => {
        elapsedRef.current += 1000;
        setElapsed(elapsedRef.current);
      }, 1000);
      return () => {
        clearInterval(t);
        if (!doneRef.current) persist();
      };
    }, [done, ready, persist]),
  );

  const onDrop = useCallback((e: DropEvent, state: PuzzleState) => {
    const meta = metaRef.current;
    if (!meta) return;
    moves.current += 1;
    if (e.merged) { sound.merge(); haptic.light(); } else if (e.locked) { sound.snap(); haptic.light(); }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (e.complete) {
      doneRef.current = true;
      setDone(true);
      savePuzzleState(meta.id, state);
      update(meta.id, { completedAt: Date.now(), placed: total, elapsedMs: elapsedRef.current, moves: moves.current, updatedAt: Date.now() });
      const settings = useSettings.getState();
      settings.set({ completions: settings.completions + 1 });
      if (meta.dailyDate) settings.recordDaily(meta.dailyDate);
      // The solved sound and success haptic play on the Completed screen, timed to the final count-up.
      setTimeout(() => router.replace(`/completed/${meta.id}`), 900);
      return;
    }
    saveTimer.current = setTimeout(() => persist(state, state.where.filter((w) => w === 2).length), 500);
  }, [update, total, persist]);

  const pickFilter = async (next: TrayFilter) => {
    if (next.kind !== 'all' && !isPro && !sortingUnlocked) {
      const ok = await offerRewarded('Sorting trays', 'Watch a short ad to unlock edge and colour sorting for this puzzle, or go Pro for unlimited sorting.');
      if (!ok) return;
      setSortingUnlocked(true);
    }
    setFilter(next);
  };

  const useHint = async () => {
    if (!isPro && hintsLeft <= 0) {
      const ok = await offerRewarded('Out of hints', `Watch a short ad for ${FREE_HINTS} more hints, or go Pro for unlimited hints.`);
      if (!ok) return;
      useSettings.getState().set({ hintsLeft: FREE_HINTS });
    }
    if (board.current?.hint() && !isPro) useSettings.getState().set({ hintsLeft: Math.max(0, useSettings.getState().hintsLeft - 1) });
  };

  const cycleTexture = () => {
    if (!meta) return;
    const i = BOARD_TEXTURES.findIndex((t) => t.id === meta.texture);
    update(meta.id, { texture: BOARD_TEXTURES[(i + 1) % BOARD_TEXTURES.length].id });
  };

  if (!meta || !initial) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.bg }}>
        <T v="headlineSm">This puzzle is no longer on this device.</T>
        <Button label="Back to gallery" onPress={() => router.replace('/')} />
      </View>
    );
  }

  const texture = BOARD_TEXTURES.find((t) => t.id === meta.texture) ?? BOARD_TEXTURES[3];
  const pct = total ? stats.placed / total : 0;
  const chip = (label: string, n: number, active: boolean, onPress: () => void, swatch?: string, locked?: boolean) => (
    <Pressable key={label} hitSlop={{ top: 5, bottom: 5 }} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}, ${n} pieces`} accessibilityState={{ selected: active }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: radius.full, backgroundColor: active ? colors.ink : colors.surfaceMid }}>
      {swatch ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: swatch }} /> : null}
      {locked ? <Icon name="lock-outline" size={12} color={colors.textMuted} /> : null}
      <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: active ? '#fff' : colors.text }}>{label}</Text>
      <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: active ? 'rgba(255,255,255,0.75)' : colors.textMuted }}>{n}</Text>
    </Pressable>
  );
  const locked = !isPro && !sortingUnlocked;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 16, paddingBottom: 10, gap: 8 }}>
        <Row gap={10}>
          <IconButton name="arrow-left" label="Save and go back" bg="transparent" onPress={() => { persist(); router.canGoBack() ? router.back() : router.replace('/'); }} />
          <Logo size={30} />
          <T v="headlineSm" style={{ flex: 1 }} numberOfLines={1}>{meta.title}</T>
        </Row>
        <Row gap={8}>
          <Row gap={6} style={{ flex: 1, backgroundColor: colors.surfaceMid, borderRadius: radius.full, paddingHorizontal: 12, height: 38 }}>
            <Icon name="timer-outline" size={16} color={colors.primary} />
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] }}>{clock(elapsed)}</Text>
            <T v="overline" numberOfLines={1} style={{ flex: 1 }}>• Serene mode</T>
          </Row>
          <IconButton name={reference ? 'eye-outline' : 'eye-off-outline'} label={reference ? 'Hide reference image' : 'Show reference image'} bg={colors.surface} onPress={() => setReference(!reference)} size={38} />
          <IconButton name="fit-to-screen-outline" label="Fit board to screen" bg={colors.surface} onPress={() => board.current?.fit()} size={38} />
          <Pressable hitSlop={{ top: 3, bottom: 3 }} onPress={useHint} accessibilityRole="button" accessibilityLabel="Hint"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: radius.full, paddingHorizontal: 12, height: 38 }}>
            <Icon name="lightbulb-on-outline" size={17} color={colors.brassDeep} />
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.text }}>Hint</Text>
            <View style={{ minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.linen, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: 11, color: colors.onLinen }}>{isPro ? '∞' : hintsLeft}</Text>
            </View>
          </Pressable>
        </Row>
        <Row gap={10}>
          <Text style={{ fontFamily: fonts.sansSemi, fontSize: 22, color: colors.text }}>{stats.placed}</Text>
          <T v="body">/ {total} assembled</T>
          <T v="label" style={{ marginLeft: 'auto' }}>{Math.round(pct * 100)}% complete</T>
          <View style={{ width: 84 }}><Progress value={pct} /></View>
        </Row>
      </View>

      <View style={{ flex: 1 }}>
        {assets && image ? (
          <>
            <BuildIn style={{ flex: 1 }}>
            <PuzzleBoard ref={board} assets={assets} image={image} initial={initial} background={texture.color} wood={texture.id === 'oak'} showReference={reference}
              filter={filter} allowRotate={meta.rotation} onStats={setStats} onDrop={onDrop} onPickup={haptic.medium} />
            </BuildIn>
            <View pointerEvents="box-none" style={{ position: 'absolute', left: 12, bottom: TRAY_H + CHIPS_H + 10 }}>
              <Row gap={2} style={[{ backgroundColor: colors.surface, borderRadius: radius.full, paddingLeft: 12, paddingRight: 4, height: 38 }, shadow.card]}>
                <Icon name="hand-back-right-outline" size={15} color={colors.textSecondary} />
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: colors.text, marginHorizontal: 6 }}>{Math.round(stats.zoom * 100)}%</Text>
                <IconButton name="minus" label="Zoom out" bg="transparent" size={32} onPress={() => board.current?.zoomBy(1 / 1.5)} />
                <IconButton name="plus" label="Zoom in" bg="transparent" size={32} onPress={() => board.current?.zoomBy(1.5)} />
              </Row>
            </View>
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: TRAY_H, height: CHIPS_H, justifyContent: 'center' }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 8, alignItems: 'center' }}>
                {chip('All', stats.trayAll, filter.kind === 'all', () => pickFilter({ kind: 'all' }))}
                {chip('Edges', stats.trayEdges, filter.kind === 'edges', () => pickFilter({ kind: 'edges' }), undefined, locked)}
                {stats.families.slice(0, 4).map((f) =>
                  chip(COLOR_FAMILIES[f.family].name, f.count, filter.kind === 'family' && filter.family === f.family,
                    () => pickFilter({ kind: 'family', family: f.family }), COLOR_FAMILIES[f.family].swatch, locked))}
              </ScrollView>
            </View>
          </>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            {failed ? (
              <>
                <T v="title">We could not open this image.</T>
                <Button label="Back to gallery" kind="secondary" onPress={() => router.replace('/')} />
              </>
            ) : (
              <>
                <BrandedLoader label={`Carving ${total} pieces…`} />
              </>
            )}
          </View>
        )}
      </View>

      <Row style={{ justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 10), backgroundColor: colors.surface }}>
        <Pressable onPress={cycleTexture} accessibilityRole="button" accessibilityLabel={`Board background: ${texture.name}. Tap to change.`} hitSlop={{ top: 4, bottom: 4 }} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 36 }}>
          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: texture.color, borderWidth: 1, borderColor: colors.outlineVariant }} />
          <T v="body">{texture.name} board</T>
        </Pressable>
        {done ? <T v="label" color={colors.primary}>Puzzle solved</T> : <Button label="Rearrange" icon="shuffle-variant" kind="tonal" size="sm" onPress={() => board.current?.scatter()} />}
      </Row>
    </View>
  );
}
