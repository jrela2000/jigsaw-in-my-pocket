import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Picture } from '../../components/Picture';
import { LinearGradientFallback } from '../../components/Scrim';
import { AppBar, Button, Card, Chip, Icon, Progress, Row, Screen, SectionTitle, T } from '../../components/ui';
import { colors, radius } from '../../theme';
import { usePuzzles, PuzzleMeta } from '../../store/puzzles';
import { isUnder13, useSettings } from '../../store/settings';
import { DailyArt, getDaily } from '../../services/daily';
import { currentStreak } from '../../lib/streak';
import { startDaily } from '../../lib/createPuzzle';
import { formatDuration, timeAgo } from '../../lib/json';
import { confirm, notify } from '../../lib/dialog';
import { deletePuzzleFiles } from '../../lib/files';

export default function Gallery() {
  const puzzles = usePuzzles((s) => s.puzzles);
  const remove = usePuzzles((s) => s.remove);
  const streak = useSettings((s) => currentStreak(s.streak));
  const printsAllowed = !useSettings((s) => isUnder13(s.birthYear));
  const [daily, setDaily] = useState<DailyArt | null>(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    getDaily().then(setDaily).catch(() => {});
  }, []);

  const active = puzzles.filter((p) => !p.completedAt);
  const finished = puzzles.filter((p) => p.completedAt);

  const openDaily = async () => {
    if (!daily || opening) return;
    setOpening(true);
    try {
      const meta = await startDaily(daily, daily.pieces);
      router.push(meta.completedAt ? `/completed/${meta.id}` : `/puzzle/${meta.id}`);
    } catch {
      notify("Today's art could not be loaded", 'Check your connection and try again.');
    } finally {
      setOpening(false);
    }
  };

  const discard = async (p: PuzzleMeta) => {
    if (!(await confirm('Remove this puzzle?', `"${p.title}" and its progress will be deleted from this device.`, 'Remove'))) return;
    remove(p.id);
    void deletePuzzleFiles(p.id);
  };

  return (
    <Screen bar={<AppBar />}>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <View style={{ height: 230, backgroundColor: colors.surfaceDim }}>
          {daily ? <Picture uri={daily.imageUrl} style={{ flex: 1 }} label={`${daily.title} by ${daily.artist}`} fade /> : null}
          <LinearGradientFallback />
          <Row style={{ position: 'absolute', top: 12, left: 12, right: 12, justifyContent: 'space-between' }}>
            <Chip label={streak > 0 ? `Day ${streak} Streak` : 'Start a streak'} icon="fire" tone="white" />
            {daily ? <Chip label={daily.museum} tone="white" /> : null}
          </Row>
          <View style={{ position: 'absolute', left: 16, right: 16, bottom: 12 }}>
            <T v="overline" color="rgba(255,255,255,0.85)">Daily masterwork • {daily?.pieces ?? 110} pieces</T>
            <T v="headline" color="#fff" numberOfLines={2}>{daily?.title ?? 'Loading today’s art…'}</T>
            {daily ? <T v="body" color="rgba(255,255,255,0.9)" numberOfLines={1}>{daily.artist} • {daily.license} Open Access</T> : null}
          </View>
        </View>
        <Row style={{ padding: 14, justifyContent: 'space-between' }} gap={12}>
          <Row style={{ flex: 1 }}>
            <Icon name="check-decagram-outline" size={20} color={colors.primary} />
            <T v="label" style={{ flex: 1 }}>Public-domain museum art</T>
          </Row>
          <Button label="Solve Today's Art" icon="play-circle-outline" onPress={openDaily} loading={opening} disabled={!daily} />
        </Row>
      </Card>

      <Row gap={12}>
        <Pressable style={{ flex: 1 }} onPress={() => router.push('/new')} accessibilityRole="button" accessibilityLabel="Custom photo puzzle">
          <Card tone="low" style={{ gap: 4 }}>
            <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <Icon name="camera-outline" size={22} color={colors.primary} />
            </View>
            <T v="titleLg">Custom Photo</T>
            <T v="small" color={colors.textSecondary}>One photo from your library</T>
          </Card>
        </Pressable>
        <Pressable style={{ flex: 1 }} onPress={() => router.push('/collage')} accessibilityRole="button" accessibilityLabel="Collage puzzle">
          <Card tone="low" style={{ gap: 4 }}>
            <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: colors.linen, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <Icon name="view-grid-plus-outline" size={22} color={colors.onLinen} />
            </View>
            <T v="titleLg">Collage</T>
            <T v="small" color={colors.textSecondary}>2–9 photos in one puzzle</T>
          </Card>
        </Pressable>
      </Row>

      <SectionTitle title="In Progress" sub="Puzzles on your workbench" right={<T v="label">{active.length} Active</T>} />
      {active.length === 0 ? (
        <Card tone="low"><T v="body">Nothing on the workbench yet. Pick a photo or solve today’s art to begin.</T></Card>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
          {active.map((p) => {
            const total = p.cols * p.rows;
            return (
              <Pressable key={p.id} onPress={() => router.push(`/puzzle/${p.id}`)} onLongPress={() => discard(p)} accessibilityRole="button" accessibilityLabel={`Resume ${p.title}`}>
                <Card style={{ width: 264, padding: 10, gap: 8 }}>
                  <View style={{ height: 132, borderRadius: radius.base, overflow: 'hidden', backgroundColor: colors.surfaceDim }}>
                    <Picture uri={p.imageUri} style={{ flex: 1 }} />
                    <Chip label={`${p.pieces} Pieces`} tone="dark" style={{ position: 'absolute', top: 8, left: 8 }} />
                    <Chip label="Resume" icon="refresh" tone="sage" style={{ position: 'absolute', bottom: 8, right: 8 }} />
                  </View>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T v="title" style={{ flex: 1 }} numberOfLines={1}>{p.title}</T>
                    <T v="label" color={colors.primary}>{Math.round((p.placed / total) * 100)}%</T>
                  </Row>
                  <Row><Progress value={p.placed / total} /></Row>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T v="small">{p.placed} of {total} assembled</T>
                    <T v="small">{timeAgo(p.updatedAt)}</T>
                  </Row>
                </Card>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <SectionTitle title="Completed Archive" sub={printsAllowed ? 'Finished puzzles, ready to order as prints' : 'Your finished puzzles'} right={<T v="label">{finished.length} Total</T>} />
      {finished.length === 0 ? (
        <Card tone="low"><T v="body">Finished puzzles appear here{printsAllowed ? ', where you can order the real thing or send one as a gift' : ''}.</T></Card>
      ) : (
        finished.map((p) => (
          <Pressable key={p.id} onPress={() => router.push(`/completed/${p.id}`)} onLongPress={() => discard(p)} accessibilityRole="button" accessibilityLabel={`Open ${p.title}`}>
            <Card style={{ padding: 12, gap: 10 }}>
              <View style={{ height: 170, borderRadius: radius.base, overflow: 'hidden', backgroundColor: colors.surfaceDim }}>
                <Picture uri={p.imageUri} style={{ flex: 1 }} />
                <Chip label={`Completed in ${formatDuration(p.elapsedMs)}`} icon="check-circle-outline" tone="white" style={{ position: 'absolute', top: 8, right: 8 }} />
              </View>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <T v="titleLg" numberOfLines={1}>{p.title}</T>
                  <T v="small">{p.pieces} Pieces{p.credit ? ` • ${p.credit}` : ''}</T>
                </View>
                <Button label="Gift" icon="gift-outline" kind="tonal" size="sm" onPress={() => router.push(`/send-gift/${p.id}`)} />
                {printsAllowed ? <Button label="Print" icon="printer-outline" kind="linen" size="sm" onPress={() => router.push(`/checkout/${p.id}`)} /> : null}
              </Row>
            </Card>
          </Pressable>
        ))
      )}
      {puzzles.length > 0 ? <T v="small" center>Press and hold a puzzle to remove it.</T> : null}
    </Screen>
  );
}
