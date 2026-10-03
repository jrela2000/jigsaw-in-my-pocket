import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Picture } from '../../components/Picture';
import { AppBar, Button, Card, Chip, Notice, Screen, T } from '../../components/ui';
import { colors, fonts, radius } from '../../theme';
import { fetchGift, Gift } from '../../services/commerce';
import { createPuzzle, imageSize } from '../../lib/createPuzzle';
import { cacheRemote } from '../../lib/files';
import { usePuzzles } from '../../store/puzzles';
import { useSettings } from '../../store/settings';

/** Deep-link target: https://studiojigsaw.app/gift/<token> and studiojigsaw://gift/<token>. */
export default function OpenGift() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const onboarded = useSettings((s) => s.onboarded);
  const existing = usePuzzles((s) => s.puzzles.find((p) => p.giftToken === token));
  const [gift, setGift] = useState<Gift | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchGift(String(token)).then(setGift).catch((e) => setError(e?.message ?? 'This gift could not be opened.'));
  }, [token]);

  const start = async () => {
    if (!gift) return;
    if (existing) return router.replace(existing.completedAt ? `/completed/${existing.id}` : `/puzzle/${existing.id}`);
    setBusy(true);
    try {
      const uri = await cacheRemote(`gift-${gift.token}`, gift.imageUrl);
      const { width, height } = await imageSize(uri);
      // Gifted puzzles are playable at the sent piece count on the free tier: no ad gate.
      const meta = await createPuzzle({
        uri, width, height, title: gift.title, kind: 'gift', pieces: gift.pieces, framing: 'original', rotation: gift.rotation,
        extra: { giftToken: gift.token, giftFrom: gift.senderName, giftPrepaid: gift.prepaid },
      });
      router.replace(`/puzzle/${meta.id}`);
    } catch {
      setError('The puzzle image could not be downloaded. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!onboarded) {
    return (
      <Screen bar={<AppBar title="A Gift for You" right={<></>} />}>
        <Notice icon="gift-outline" title="Someone sent you a puzzle" body="One quick step first, then your gift opens." />
        <Button label="Continue" size="lg" onPress={() => router.replace('/onboarding')} />
      </Screen>
    );
  }

  return (
    <Screen bar={<AppBar title="A Gift for You" back />}>
      {error ? (
        <Notice tone="warn" icon="alert-outline" title="This gift could not be opened" body={`${error} Gift links expire after 90 days.`} />
      ) : !gift ? (
        <View style={{ paddingVertical: 80 }}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Chip label="A PUZZLE, JUST FOR YOU" icon="gift-outline" tone="linen" style={{ alignSelf: 'center' }} />
            <T v="display" center>Dear {gift.recipientName},</T>
          </View>
          <Card style={{ backgroundColor: '#fbf6ec', gap: 12 }}>
            {gift.note ? <T v="bodyLg" style={{ fontFamily: fonts.serifItalic, fontSize: 19, lineHeight: 28, color: colors.text }}>“{gift.note}”</T> : null}
            <T v="title" style={{ textAlign: 'right' }}>— {gift.senderName}</T>
          </Card>
          <Card style={{ padding: 10, gap: 10 }}>
            <Picture uri={gift.imageUrl} style={{ aspectRatio: 1.3, borderRadius: radius.base, backgroundColor: colors.surfaceDim }} label="Blurred preview of your gifted puzzle" blur={18} />
            <T v="headlineSm">{gift.title}</T>
            <T v="small">{gift.pieces} pieces · the picture is revealed as you solve it</T>
          </Card>
          {gift.prepaid ? <Notice icon="package-variant-closed" title="A printed puzzle is included" body={`${gift.senderName} has prepaid the real, printed version. Finish the puzzle and tell us where to send it.`} /> : null}
          <Button label={existing ? 'Continue Puzzle' : 'Open My Puzzle'} icon="puzzle-outline" size="lg" onPress={start} loading={busy} />
        </>
      )}
    </Screen>
  );
}
