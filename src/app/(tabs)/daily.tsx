import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { PressableScale as Pressable } from '../../components/motion';
import { router } from 'expo-router';
import { Picture } from '../../components/Picture';
import { AppBar, Button, Card, Chip, Icon, Row, Screen, SectionTitle, T } from '../../components/ui';
import { colors, radius } from '../../theme';
import { archiveDates, DailyArt, dailyPreview, getDaily } from '../../services/daily';
import { startDaily } from '../../lib/createPuzzle';
import { currentStreak } from '../../lib/streak';
import { useSettings } from '../../store/settings';
import { useIsPro } from '../../store/entitlement';
import { usePuzzles } from '../../store/puzzles';
import { PUZZLE_SIZES } from '../../config/printify';
import { notify } from '../../lib/dialog';

export default function DailyArtScreen() {
  const isPro = useIsPro();
  const streak = useSettings((s) => s.streak);
  const puzzles = usePuzzles((s) => s.puzzles);
  const [art, setArt] = useState<DailyArt | null>(null);
  const [pieces, setPieces] = useState(110);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    getDaily().then(setArt).catch(() => {});
  }, []);

  const open = async (a: DailyArt, count: number) => {
    if (busy) return;
    setBusy(a.date);
    try {
      const meta = await startDaily(a, count);
      router.push(meta.completedAt ? `/completed/${meta.id}` : `/puzzle/${meta.id}`);
    } catch {
      notify('This artwork could not be loaded', 'Check your connection and try again.');
    } finally {
      setBusy(null);
    }
  };

  const doneToday = art ? puzzles.some((p) => p.dailyDate === art.date && p.completedAt) : false;
  const archive = archiveDates(isPro ? 60 : 6);

  return (
    <Screen bar={<AppBar />}>
      <View><T v="overline">Daily art</T><T v="headline">Today’s Masterwork</T></View>
      <Card style={{ padding: 12, gap: 12 }}>
        <View style={{ aspectRatio: 1.3, borderRadius: radius.base, overflow: 'hidden', backgroundColor: colors.surfaceDim }}>
          {art ? <Picture uri={art.imageUrl} style={{ flex: 1 }} label={`${art.title} by ${art.artist}`} fade /> : null}
          {doneToday ? <Chip label="Solved today" icon="check-circle-outline" tone="white" style={{ position: 'absolute', top: 8, right: 8 }} /> : null}
        </View>
        <View>
          <T v="headlineSm">{art?.title ?? 'Loading…'}</T>
          {art ? <T v="body">{art.artist}</T> : null}
          {art ? <T v="small" style={{ marginTop: 4 }}>{art.credit}</T> : null}
        </View>
        {isPro ? (
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            {PUZZLE_SIZES.map((s) => (
              <Pressable key={s.pieces} onPress={() => setPieces(s.pieces)} accessibilityRole="radio" accessibilityState={{ selected: pieces === s.pieces }}
                style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, backgroundColor: pieces === s.pieces ? colors.ink : colors.surfaceMid }}>
                <T v="label" color={pieces === s.pieces ? '#fff' : colors.text}>{s.pieces}</T>
              </Pressable>
            ))}
          </Row>
        ) : null}
        <Button label={doneToday ? 'View Solved Art' : `Solve Today's Art (${isPro ? pieces : 110} Pieces)`} icon="play-circle-outline" size="lg"
          disabled={!art} loading={!!art && busy === art.date} onPress={() => art && open(art, isPro ? pieces : 110)} />
      </Card>

      <Row gap={12}>
        <Card tone="low" style={{ flex: 1, alignItems: 'center' }}><Icon name="fire" size={22} color={colors.brassDeep} /><T v="headline">{currentStreak(streak)}</T><T v="small">Day streak</T></Card>
        <Card tone="low" style={{ flex: 1, alignItems: 'center' }}><Icon name="trophy-outline" size={22} color={colors.brassDeep} /><T v="headline">{streak.best}</T><T v="small">Best streak</T></Card>
        <Card tone="low" style={{ flex: 1, alignItems: 'center' }}><Icon name="image-frame" size={22} color={colors.brassDeep} /><T v="headline">{streak.dailyCompleted}</T><T v="small">Solved</T></Card>
      </Row>

      <SectionTitle title="Museum Archive" sub={isPro ? 'The last 60 days of daily art' : 'Recent daily art'} />
      {archive.map((date, i) => {
        const a = dailyPreview(date);
        const lockedRow = !isPro && i >= 3;
        return (
          <Pressable key={date} accessibilityRole="button" accessibilityLabel={`${a.title}, ${date}`} onPress={() => (lockedRow ? router.push('/paywall') : open(a, isPro ? pieces : 110))}>
            <Row gap={12} style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: 10, borderWidth: 1, borderColor: colors.hairline, opacity: lockedRow ? 0.6 : 1 }}>
              <Picture uri={a.imageUrl.replace('/full/1686,', '/full/200,')} style={{ width: 64, height: 52, borderRadius: 6, backgroundColor: colors.surfaceDim }} />
              <View style={{ flex: 1 }}>
                <T v="title" numberOfLines={1}>{a.title}</T>
                <T v="small" numberOfLines={1}>{a.artist} · {date}</T>
              </View>
              <Icon name={lockedRow ? 'lock-outline' : 'chevron-right'} size={20} color={colors.textMuted} />
            </Row>
          </Pressable>
        );
      })}
      {!isPro ? <Button label="Unlock the 60-day archive with Pro" kind="ghost" icon="infinity" onPress={() => router.push('/paywall')} /> : null}
    </Screen>
  );
}
