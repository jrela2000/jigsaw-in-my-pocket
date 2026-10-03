import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { AppBar, Button, Card, Screen, T } from '../../components/ui';
import { env, LEGAL_NOTICE } from '../../config/env';

const DOCS = {
  terms: { title: 'Terms of Service', url: env.termsUrl },
  privacy: { title: 'Privacy Policy', url: env.privacyUrl },
} as const;

const SUMMARY: Record<keyof typeof DOCS, string[]> = {
  terms: [
    LEGAL_NOTICE,
    'Pro memberships renew automatically until cancelled in your App Store or Google Play account settings.',
    'Physical puzzles are made to order. Contact support within 30 days if your order arrives damaged or misprinted.',
  ],
  privacy: [
    'Photos you turn into puzzles stay on your device. A photo is uploaded only when you choose to gift a puzzle or order a print, and you are told before it happens.',
    'Gift photos are deleted after 90 days. Print photos are deleted 30 days after delivery.',
    'No account is required. An anonymous identifier keeps your purchases, streak and orders together.',
    'The free version shows ads from Google AdMob. You can review your ad choices any time in Settings.',
  ],
};

export default function Legal() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const key = doc === 'privacy' ? 'privacy' : 'terms';
  const d = DOCS[key];
  return (
    <Screen bar={<AppBar title={d.title} back right={<></>} />}>
      <Card>
        <T v="headlineSm">{d.title}</T>
        {SUMMARY[key].map((p) => <T key={p} v="body" style={{ marginTop: 10 }}>{p}</T>)}
      </Card>
      {d.url ? (
        <Button label={`Read the full ${d.title}`} icon="open-in-new" kind="secondary" onPress={() => WebBrowser.openBrowserAsync(d.url)} />
      ) : (
        <T v="small" center>The full document will be linked here before release.</T>
      )}
    </Screen>
  );
}
